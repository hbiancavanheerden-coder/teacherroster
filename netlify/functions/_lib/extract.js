// Claude-powered extraction of duty rosters and timetables from uploaded documents.
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-opus-5-5';

// JSON schema for structured output. Every object lists all keys as required and forbids extras.
const str = { type: 'string' };
export const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['documentType', 'duties', 'lessons', 'warnings'],
  properties: {
    documentType: { type: 'string', enum: ['duty_roster', 'timetable', 'both', 'other'] },
    duties: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'dutyPoint', 'staffName', 'startTime', 'endTime', 'note'],
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          dutyPoint: str,
          staffName: str,
          startTime: { type: 'string', description: 'HH:MM or empty' },
          endTime: { type: 'string', description: 'HH:MM or empty' },
          note: str,
        },
      },
    },
    lessons: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['day', 'period', 'startTime', 'endTime', 'staffName', 'className', 'subject', 'room'],
        properties: {
          day: { type: 'integer', enum: [1, 2, 3, 4, 5, 6, 7] },
          period: str,
          startTime: str,
          endTime: str,
          staffName: str,
          className: str,
          subject: str,
          room: str,
        },
      },
    },
    warnings: { type: 'array', items: str },
  },
};

const SYSTEM = `You read school documents (duty rosters and timetables from South African schools, in English or Afrikaans) and turn them into structured records for a school management app. An administrator will review everything you return before it is saved, so accuracy matters more than completeness: never invent names, dates, classes or times.

Duty rosters
- One record per person per duty per date. If a cell lists several people, output one record for each.
- Output dates as YYYY-MM-DD. Work out the year from the document; if it is not stated, use the school's term dates provided below. If a roster is given per weekday or per week number ("Week 3, Tuesday"), expand it to real dates using the term dates, skipping holidays listed below. If you cannot determine a date with confidence, leave that row out and add a warning.
- dutyPoint: if a duty in the document is clearly the same as one of the school's existing duty points, use the existing name exactly; otherwise use the document's label.
- Include duty start and end times only if the document shows them.

Timetables
- One record per lesson: weekday (1 = Monday … 7 = Sunday), period, teacher, class, subject, room.
- period: use the school's existing period name when the name or start time matches; otherwise use the document's label. Include times if shown.
- Skip breaks, assemblies and empty cells.

Names
- staffName: if a name clearly refers to one of the school's existing staff (for example "Mrs Botha" for "Annette Botha", or a first name that only one staff member has), use the existing name exactly. Otherwise copy the name as written. Never guess between two possible people: copy it as written and add a warning.

Warnings
- Use short, plain-English warnings for anything unclear: unreadable cells, ambiguous dates, names you could not place, pages you skipped. Return an empty list if everything was clear.
- If the document is not a duty roster or timetable, set documentType to "other" and explain in a warning.`;

/**
 * @param {object} p
 * @param {'roster'|'timetable'} p.kind
 * @param {string} p.fileId       Anthropic Files API id
 * @param {'document'|'image'} p.blockType
 * @param {object} p.context      { schoolName, today, terms[], holidays[], dutyPoints[], staff[], periods[] }
 */
export async function extractFromDocument({ kind, fileId, blockType, context }) {
  const client = new Anthropic();
  const contextText = [
    `School: ${context.schoolName}`,
    `Today: ${context.today}`,
    `The administrator is importing a ${kind === 'roster' ? 'DUTY ROSTER' : 'TIMETABLE'}.`,
    `Term dates: ${context.terms.length ? context.terms.map((t) => `${t.name} ${t.start} to ${t.end}`).join('; ') : 'none entered'}`,
    `Holidays / closed days: ${context.holidays.length ? context.holidays.join(', ') : 'none entered'}`,
    `Existing duty points: ${context.dutyPoints.length ? context.dutyPoints.join(', ') : 'none yet'}`,
    `Existing periods: ${context.periods.length ? context.periods.map((p) => `${p.name} (${p.start}-${p.end})`).join(', ') : 'none yet'}`,
    `Existing staff: ${context.staff.length ? context.staff.join(', ') : 'none yet'}`,
  ].join('\n');

  const source = { type: 'file', file_id: fileId };
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    output_config: { effort: 'high', format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
    // On a safety decline, re-run on Anthropic's recommended fallback model instead of failing.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        blockType === 'image' ? { type: 'image', source } : { type: 'document', source, title: 'Uploaded document' },
        { type: 'text', text: `${contextText}\n\nExtract every ${kind === 'roster' ? 'duty assignment' : 'lesson'} from the document above.` },
      ],
    }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new Error('The document could not be processed. Please check it is a duty roster or timetable and try again.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('This document is too large to read in one go. Please split it into smaller parts (for example one term or one month per file).');
  }
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The document could not be read clearly. Please try again, or upload a clearer copy.');
  }
  return { data, usage: message.usage };
}
