// Step 1 of "Import from document": receives a PDF / Word / Excel / image file, prepares it for Claude
// (Word and Excel are converted to text), stores it in Anthropic's Files API with a 1-hour expiry,
// records schools/{id}/imports/{importId}, then starts the background extraction.
//
// POST {schoolId, kind: 'roster'|'timetable', fileName, mediaType, data (base64)} -> {importId}
import Anthropic, { toFile } from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import readXlsxFile from 'read-excel-file/node';
import { handler, body, requireUser, requireMember, requireActive, json, HttpError, FieldValue, appUrl } from './_lib/core.js';

export const MAX_BYTES = 4 * 1024 * 1024; // Netlify request bodies are capped at ~6 MB (base64 adds a third)
export const DAILY_LIMIT = 20; // imports per school per 24 hours (controls AI cost)

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function detectType(fileName = '', mediaType = '') {
  const ext = fileName.toLowerCase().split('.').pop();
  if (mediaType === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ext === 'docx' || mediaType.includes('wordprocessingml')) return 'docx';
  if (ext === 'doc' || mediaType === 'application/msword') return 'doc';
  if (ext === 'xlsx' || mediaType.includes('spreadsheetml')) return 'xlsx';
  if (ext === 'csv' || ext === 'txt' || mediaType === 'text/csv' || mediaType === 'text/plain') return 'text';
  if (IMAGE_TYPES.includes(mediaType) || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  return null;
}

// Keeps table structure but drops attributes/styling to save tokens.
export function slimHtml(html) {
  return html
    .replace(/<img[^>]*>/gi, '')
    .replace(/<(\w+)(\s[^>]*)?>/g, '<$1>')
    .replace(/<\/?(span|strong|em|a|u|s|sup|sub)>/gi, '')
    .replace(/\n{3,}/g, '\n\n');
}

export default handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const p = await body(req);
  const { school, member, schoolRef } = await requireMember(user.uid, p.schoolId, ['owner', 'admin']);
  requireActive(school);
  if (!['roster', 'timetable'].includes(p.kind)) throw new HttpError(400, 'Choose what you are importing.');
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'Document import is not configured on the server yet (ANTHROPIC_API_KEY).');

  const type = detectType(String(p.fileName || ''), String(p.mediaType || ''));
  if (type === 'doc') throw new HttpError(400, 'Old .doc files can’t be read. In Word, choose File → Save As → Word Document (.docx) or PDF, then upload that.');
  if (!type) throw new HttpError(400, 'Please upload a PDF, Word (.docx), Excel (.xlsx), CSV or photo of the roster.');
  const buf = Buffer.from(String(p.data || ''), 'base64');
  if (!buf.length) throw new HttpError(400, 'The file is empty.');
  if (buf.length > MAX_BYTES) throw new HttpError(413, 'That file is larger than 4 MB. Try saving it as a smaller PDF, or split it into parts.');

  const since = new Date(Date.now() - 86400000);
  const recent = await schoolRef.collection('imports').where('createdAt', '>', since).count().get();
  if (recent.data().count >= DAILY_LIMIT) throw new HttpError(429, `You’ve reached today’s limit of ${DAILY_LIMIT} document imports. Please try again tomorrow.`);

  // Prepare the content Claude will read.
  let upload;
  let blockType = 'document';
  if (type === 'pdf') {
    upload = await toFile(buf, 'upload.pdf', { type: 'application/pdf' });
  } else if (type === 'image') {
    blockType = 'image';
    const mt = IMAGE_TYPES.includes(p.mediaType) ? p.mediaType : 'image/jpeg';
    upload = await toFile(buf, 'upload.' + mt.split('/')[1], { type: mt });
  } else {
    let text;
    try {
      if (type === 'docx') text = slimHtml((await mammoth.convertToHtml({ buffer: buf })).value);
      else if (type === 'xlsx') {
        const sheets = await readXlsxFile(buf);
        text = sheets.map(({ sheet, data }) => `## Sheet: ${sheet}\n` + data.map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c ?? '')).join(' | ')).join('\n')).join('\n\n');
      } else text = buf.toString('utf8');
    } catch {
      throw new HttpError(400, 'We couldn’t open that file. Is it password-protected or damaged? Try saving it as a PDF.');
    }
    if (!text.trim()) throw new HttpError(400, 'We couldn’t find any text in that file. If it is a scan, upload it as a PDF or photo instead.');
    upload = await toFile(Buffer.from(text, 'utf8'), 'upload.txt', { type: 'text/plain' });
  }

  const client = new Anthropic();
  const file = await client.files.upload({ file: upload, expires_in_seconds: 3600 });

  const ref = schoolRef.collection('imports').doc();
  await ref.set({
    kind: p.kind,
    fileName: String(p.fileName || 'document').slice(0, 200),
    sourceType: type,
    blockType,
    fileId: file.id,
    status: 'processing',
    createdBy: user.uid,
    createdByName: member.name || '',
    createdAt: FieldValue.serverTimestamp(),
  });

  // Start the long-running extraction (Netlify background function, up to 15 minutes).
  const res = await fetch(appUrl('/.netlify/functions/import-extract-background'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('authorization') },
    body: JSON.stringify({ schoolId: school.id, importId: ref.id }),
  });
  if (!res.ok && res.status !== 202) {
    await ref.update({ status: 'failed', error: 'Could not start reading the document. Please try again.' });
    throw new HttpError(502, 'Could not start reading the document. Please try again.');
  }
  return json({ importId: ref.id });
});
