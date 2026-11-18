// Step 2 of "Import from document" (Netlify background function: responds 202 immediately, runs up to 15 min).
// Reads the uploaded file with Claude and stores the structured result on schools/{id}/imports/{importId}.
// The browser watches that document live and shows the review screen when it is ready.
import Anthropic from '@anthropic-ai/sdk';
import { requireUser, requireMember, db, FieldValue } from './_lib/core.js';
import { extractFromDocument, MODEL } from './_lib/extract.js';
import { todayISO } from '../../src/lib/dates.js';

const MAX_ROWS = 3000;

export default async (req) => {
  let ref;
  try {
    const user = await requireUser(req);
    const { schoolId, importId } = await req.json();
    const { school, schoolRef } = await requireMember(user.uid, schoolId, ['owner', 'admin']);
    ref = schoolRef.collection('imports').doc(String(importId));
    const snap = await ref.get();
    if (!snap.exists || snap.data().status !== 'processing' || snap.data().createdBy !== user.uid) return;
    const imp = snap.data();

    const [staff, cats, terms, events] = await Promise.all([
      schoolRef.collection('staff').get(),
      schoolRef.collection('dutyCategories').get(),
      schoolRef.collection('terms').get(),
      schoolRef.collection('events').where('type', '==', 'holiday').get(),
    ]);
    const context = {
      schoolName: school.name,
      today: todayISO(school.timezone || 'Africa/Johannesburg'),
      terms: terms.docs.map((d) => d.data()).sort((a, b) => a.start.localeCompare(b.start)),
      holidays: events.docs.map((d) => d.data()).map((e) => (e.end && e.end !== e.start ? `${e.start} to ${e.end}` : e.start)),
      dutyPoints: cats.docs.map((d) => d.data().name),
      staff: staff.docs.map((d) => d.data()).filter((s) => s.active !== false).map((s) => s.name),
      periods: (school.settings?.periods || []).filter((p) => !p.isBreak),
    };

    const { data, usage } = await extractFromDocument({ kind: imp.kind, fileId: imp.fileId, blockType: imp.blockType, context });
    const truncated = data.duties.length > MAX_ROWS || data.lessons.length > MAX_ROWS;
    await ref.update({
      status: 'ready',
      result: {
        documentType: data.documentType,
        duties: data.duties.slice(0, MAX_ROWS),
        lessons: data.lessons.slice(0, MAX_ROWS),
        warnings: [...data.warnings, ...(truncated ? [`Only the first ${MAX_ROWS} rows were kept. Split the document to import the rest.`] : [])].slice(0, 50),
      },
      model: MODEL,
      usage: { input: usage.input_tokens || 0, output: usage.output_tokens || 0 },
      finishedAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('import-extract failed', e);
    const message = e instanceof Anthropic.APIError
      ? (e.status === 429 || e.status >= 500 ? 'The reading service is busy right now. Please try again in a few minutes.' : 'The document could not be read. Please try a PDF or a clearer copy.')
      : e.message || 'Something went wrong while reading the document.';
    if (ref) await ref.update({ status: 'failed', error: message, finishedAt: FieldValue.serverTimestamp() }).catch(() => {});
  } finally {
    // Remove our copy of the document from Anthropic's file storage straight away (it also expires after 1 hour).
    try {
      const snap = ref && (await ref.get());
      const fileId = snap?.data()?.fileId;
      if (fileId && snap.data().status !== 'processing') {
        await new Anthropic().files.delete(fileId);
        await ref.update({ fileId: FieldValue.delete() });
      }
    } catch { /* expiry will clean up */ }
  }
};
