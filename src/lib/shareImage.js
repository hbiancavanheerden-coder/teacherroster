// Draws rosters/briefings as a branded PNG (for the staff WhatsApp group) and shares or downloads it.
import { download } from './csv.js';

const C = { bg: '#F5F7FB', card: '#FFFFFF', ink: '#0B1124', ink2: '#3A4258', muted: '#6B7287', line: '#E3E7F0', brand: '#009BFB', accent: '#0077D6', head: '#04162B' };
const FONT = 'Geist, "Segoe UI", Roboto, Arial, sans-serif';

function loadLogo() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/brand/mark-128.png';
  });
}

function fit(ctx, text, max) {
  let t = String(text ?? '');
  if (ctx.measureText(t).width <= max) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

async function frame({ title, subtitle, schoolName, contentHeight, width = 1080, draw }) {
  await (document.fonts?.ready || Promise.resolve());
  const logo = await loadLogo();
  const pad = 56, headH = 210, footH = 90;
  const height = headH + contentHeight + footH + pad;
  const canvas = document.createElement('canvas');
  const scale = 1;
  canvas.width = width * scale; canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, width, height);
  // header
  const g = ctx.createLinearGradient(0, 0, width, headH);
  g.addColorStop(0, C.head); g.addColorStop(1, '#0B4A86');
  ctx.fillStyle = g; ctx.fillRect(0, 0, width, headH);
  ctx.fillStyle = '#9FDCFF'; ctx.font = `600 24px ${FONT}`;
  ctx.fillText(fit(ctx, (schoolName || '').toUpperCase(), width - 2 * pad), pad, 70);
  ctx.fillStyle = '#FFFFFF'; ctx.font = `700 52px ${FONT}`;
  ctx.fillText(fit(ctx, title, width - 2 * pad), pad, 132);
  if (subtitle) { ctx.fillStyle = '#C7E6FF'; ctx.font = `400 28px ${FONT}`; ctx.fillText(fit(ctx, subtitle, width - 2 * pad), pad, 176); }
  draw(ctx, { x: pad, y: headH + 28, w: width - 2 * pad });
  // footer
  const fy = height - footH + 20;
  if (logo) ctx.drawImage(logo, pad, fy, 40, 40);
  ctx.fillStyle = C.muted; ctx.font = `500 24px ${FONT}`;
  ctx.fillText('Made with StaffBoard · staff duty rosters for schools', pad + (logo ? 54 : 0), fy + 29);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** Table image: head = column titles, rows = arrays of cell text. First column is the row label. */
export function tableImage({ title, subtitle, schoolName, head, rows }) {
  const rowH = 64, headRow = 56;
  const contentHeight = headRow + rows.length * rowH + 20;
  return frame({
    title, subtitle, schoolName, contentHeight,
    width: Math.max(1080, 260 + (head.length - 1) * 200),
    draw: (ctx, { x, y, w }) => {
      const firstW = Math.min(300, w * 0.32);
      const colW = (w - firstW) / Math.max(1, head.length - 1);
      ctx.fillStyle = C.card; roundRect(ctx, x - 16, y - 12, w + 32, contentHeight, 22); ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = `600 22px ${FONT}`; ctx.fillStyle = C.muted;
      head.forEach((h, i) => ctx.fillText(fit(ctx, h, i ? colW - 16 : firstW - 16), i ? x + firstW + (i - 1) * colW : x, y + 30));
      rows.forEach((r, ri) => {
        const ry = y + headRow + ri * rowH;
        ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x + w, ry); ctx.stroke();
        r.forEach((cell, ci) => {
          ctx.fillStyle = ci ? C.ink : C.ink2;
          ctx.font = ci ? `500 26px ${FONT}` : `600 24px ${FONT}`;
          ctx.fillText(fit(ctx, cell, ci ? colW - 16 : firstW - 16), ci ? x + firstW + (ci - 1) * colW : x, ry + 41);
        });
      });
    },
  });
}

/** List image: sections of lines (used for the daily briefing). */
export function listImage({ title, subtitle, schoolName, sections }) {
  const lineH = 46, secHead = 64, gap = 26;
  const contentHeight = sections.reduce((h, s) => h + secHead + Math.max(1, s.lines.length) * lineH + gap, 0);
  return frame({
    title, subtitle, schoolName, contentHeight,
    draw: (ctx, { x, y, w }) => {
      let cy = y;
      for (const s of sections) {
        const h = secHead + Math.max(1, s.lines.length) * lineH;
        ctx.fillStyle = C.card; roundRect(ctx, x - 16, cy - 8, w + 32, h, 20); ctx.fill();
        ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = C.accent; ctx.font = `700 28px ${FONT}`; ctx.fillText(s.heading, x + 8, cy + 38);
        ctx.font = `400 26px ${FONT}`; ctx.fillStyle = C.ink;
        (s.lines.length ? s.lines : ['Nothing today']).forEach((l, i) => {
          ctx.fillStyle = s.lines.length ? C.ink : C.muted;
          ctx.fillText(fit(ctx, l, w - 24), x + 8, cy + secHead + 26 + i * lineH);
        });
        cy += h + gap;
      }
    },
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Opens the phone's share sheet (WhatsApp etc.) with the image, or downloads it on desktop. */
export async function shareImage(blob, filename, text) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  download(filename, blob);
  return 'downloaded';
}
