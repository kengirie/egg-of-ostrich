/**
 * Draws the 1200x630 share card for a nest in the browser at publish time
 * (Rostrum renders its thumbnail from the PDF the same way — no server).
 */

const W = 1200;
const H = 630;

const INK = '#241a12';
const SAND = '#f7e6bf';
const SHELL = '#fffaf0';
const SPECKLE = '#c9b08a';
const ORANGE = '#f0591b';
const PINK = '#f090ac';

function eggPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - 55 * s);
  ctx.bezierCurveTo(cx - 28 * s, cy - 55 * s, cx - 42 * s, cy - 5 * s, cx - 42 * s, cy + 15 * s);
  ctx.bezierCurveTo(cx - 42 * s, cy + 40 * s, cx - 23 * s, cy + 55 * s, cx, cy + 55 * s);
  ctx.bezierCurveTo(cx + 23 * s, cy + 55 * s, cx + 42 * s, cy + 40 * s, cx + 42 * s, cy + 15 * s);
  ctx.bezierCurveTo(cx + 42 * s, cy - 5 * s, cx + 28 * s, cy - 55 * s, cx, cy - 55 * s);
  ctx.closePath();
}

function drawEgg(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, rotate: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotate);
  ctx.translate(-cx, -cy);
  // sticker shadow
  eggPath(ctx, cx + 8, cy + 8, s);
  ctx.fillStyle = INK;
  ctx.fill();
  eggPath(ctx, cx, cy, s);
  ctx.fillStyle = SHELL;
  ctx.fill();
  ctx.lineWidth = 4 + s;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = SPECKLE;
  for (const [dx, dy, r] of [[-14, -20, 3], [12, -28, 2.5], [20, 18, 3.5], [-20, 26, 2.5], [2, 40, 3], [-4, 4, 2]]) {
    ctx.beginPath();
    ctx.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Break `text` into at most `maxLines` lines that fit `maxWidth` (CJK-friendly, per character). */
export function wrapText(
  measure: (s: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of Array.from(text)) {
    if (measure(line + ch) > maxWidth && line) {
      lines.push(line);
      line = ch.trimStart();
      if (lines.length === maxLines) break;
    } else {
      line += ch;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && lines.join('').length < Array.from(text).length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/u, '…');
  }
  return lines;
}

export async function renderNestOgImage(opts: { title: string; ownerName: string }): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  try {
    await document.fonts.load('80px "Bagel Fat One"');
  } catch {
    // Falls back to the system font — the card still renders.
  }

  // Sand + sun + ground
  ctx.fillStyle = SAND;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffc94a';
  ctx.beginPath();
  ctx.arc(1080, 110, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e9cf93';
  ctx.fillRect(0, 520, W, 110);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 520);
  ctx.lineTo(W, 520);
  ctx.stroke();

  // A clutch of eggs on the right
  drawEgg(ctx, 930, 420, 2.4, 0.12);
  drawEgg(ctx, 1080, 460, 1.7, -0.2);
  drawEgg(ctx, 810, 490, 1.2, -0.3);

  // Logo
  ctx.save();
  ctx.translate(70, 120);
  ctx.rotate(-0.04);
  ctx.font = '64px "Bagel Fat One", sans-serif';
  ctx.fillStyle = INK;
  ctx.fillText('EGG of OSTRICHES', 6, 6);
  ctx.fillStyle = ORANGE;
  ctx.fillText('EGG of OSTRICHES', 0, 0);
  ctx.restore();

  // Title
  const titleFont = '800 68px "Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Yu Gothic", system-ui, sans-serif';
  ctx.font = titleFont;
  const lines = wrapText((s) => ctx.measureText(s).width, opts.title, 660, 3);
  ctx.fillStyle = INK;
  lines.forEach((line, i) => ctx.fillText(line, 70, 250 + i * 84));

  // Owner + call to action
  ctx.font = '700 34px "Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Yu Gothic", system-ui, sans-serif';
  const owner = wrapText((s) => ctx.measureText(s).width, `${opts.ownerName} の巣`, 660, 1)[0] ?? '';
  ctx.fillStyle = PINK;
  ctx.fillRect(66, 470, Math.min(ctx.measureText(owner).width + 28, 680), 52);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(66, 470, Math.min(ctx.measureText(owner).width + 28, 680), 52);
  ctx.fillStyle = INK;
  ctx.fillText(owner, 80, 508);
  ctx.font = '700 30px "Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Yu Gothic", system-ui, sans-serif';
  ctx.fillText('匿名で卵（質問）を投げつけよう 🥚', 70, 584);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode OG image'))), 'image/png'),
  );
}
