/**
 * Draws the 1200x630 share cards (nest + answered question) in the browser at
 * publish time (Rostrum renders its thumbnail from the PDF the same way — no server).
 */

const W = 1200;
const H = 630;

const INK = '#241a12';
const SAND = '#f7e6bf';
const SHELL = '#fffaf0';
const SPECKLE = '#c9b08a';
const ORANGE = '#f0591b';
const PINK = '#f090ac';

const JP_FONT = '"Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Yu Gothic", system-ui, sans-serif';

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

/**
 * Break `text` into at most `maxLines` lines that fit `maxWidth` (CJK-friendly, per character).
 * When the text doesn't fit, the last line ends with `…` (still within `maxWidth`).
 */
export function wrapText(
  measure: (s: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  let truncated = false;
  for (const ch of Array.from(text)) {
    if (measure(line + ch) > maxWidth && line) {
      lines.push(line);
      line = ch.trimStart();
      if (lines.length === maxLines) {
        truncated = true;
        break;
      }
    } else {
      line += ch;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (truncated) {
    const chars = Array.from(lines[maxLines - 1]);
    chars.pop();
    while (chars.length > 0 && measure(chars.join('') + '…') > maxWidth) chars.pop();
    lines[maxLines - 1] = chars.join('').trimEnd() + '…';
  }
  return lines;
}

function createCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  return { canvas, ctx };
}

async function loadFonts(): Promise<void> {
  try {
    await document.fonts.load('80px "Bagel Fat One"');
  } catch {
    // Falls back to the system font — the card still renders.
  }
}

/** Sand + sun + ground. */
function drawBackdrop(ctx: CanvasRenderingContext2D) {
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
}

/** "EGG of OSTRICHES" in Bagel Fat One with an ink offset shadow. */
function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const offset = Math.round(size / 10.5);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.04);
  ctx.font = `${size}px "Bagel Fat One", sans-serif`;
  ctx.fillStyle = INK;
  ctx.fillText('EGG of OSTRICHES', offset, offset);
  ctx.fillStyle = ORANGE;
  ctx.fillText('EGG of OSTRICHES', 0, 0);
  ctx.restore();
}

/** A pink sticker label with ink outline; returns its width. */
function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number): number {
  const width = Math.min(ctx.measureText(text).width + 28, maxWidth);
  ctx.fillStyle = PINK;
  ctx.fillRect(x, y, width, 52);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, 52);
  ctx.fillStyle = INK;
  ctx.fillText(text, x + 14, y + 38);
  return width;
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode OG image'))), 'image/png'),
  );
}

export async function renderNestOgImage(opts: { title: string; ownerName: string }): Promise<Blob> {
  const { canvas, ctx } = createCanvas();
  await loadFonts();

  drawBackdrop(ctx);

  // A clutch of eggs on the right
  drawEgg(ctx, 930, 420, 2.4, 0.12);
  drawEgg(ctx, 1080, 460, 1.7, -0.2);
  drawEgg(ctx, 810, 490, 1.2, -0.3);

  drawLogo(ctx, 70, 120, 64);

  // Title
  ctx.font = `800 68px ${JP_FONT}`;
  const lines = wrapText((s) => ctx.measureText(s).width, opts.title, 660, 3);
  ctx.fillStyle = INK;
  lines.forEach((line, i) => ctx.fillText(line, 70, 250 + i * 84));

  // Owner + call to action
  ctx.font = `700 34px ${JP_FONT}`;
  const owner = wrapText((s) => ctx.measureText(s).width, `${opts.ownerName} の巣`, 660, 1)[0] ?? '';
  drawLabel(ctx, owner, 66, 470, 680);
  ctx.font = `700 30px ${JP_FONT}`;
  ctx.fillText('匿名で卵（質問）を投げつけよう 🥚', 70, 584);

  return toPng(canvas);
}

// Speech bubble holding the question (sticker style, tail pointing at the eggs).
const BUBBLE = { x: 50, y: 104, w: 850, h: 390, r: 44 };
const BUBBLE_PAD_X = 56;
const BUBBLE_PAD_Y = 40;
const QUESTION_SIZES = [64, 56, 50, 44];
const QUESTION_MAX_LINES = 5;

function bubblePath(ctx: CanvasRenderingContext2D, dx: number, dy: number) {
  const { x: x0, y: y0, w, h, r } = BUBBLE;
  const x = x0 + dx;
  const y = y0 + dy;
  const right = x + w;
  const bottom = y + h;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(right - r, y);
  ctx.quadraticCurveTo(right, y, right, y + r);
  // Tail pokes out of the right edge towards the big egg.
  ctx.lineTo(right, bottom - 150);
  ctx.lineTo(right + 78, bottom - 70);
  ctx.lineTo(right, bottom - 90);
  ctx.lineTo(right, bottom - r);
  ctx.quadraticCurveTo(right, bottom, right - r, bottom);
  ctx.lineTo(x + r, bottom);
  ctx.quadraticCurveTo(x, bottom, x, bottom - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBubble(ctx: CanvasRenderingContext2D) {
  bubblePath(ctx, 10, 10);
  ctx.fillStyle = INK;
  ctx.fill();
  bubblePath(ctx, 0, 0);
  ctx.fillStyle = SHELL;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineJoin = 'miter';

  // Eggshell speckles tucked into the corners, away from the text.
  const { x, y, w, h } = BUBBLE;
  ctx.fillStyle = SPECKLE;
  for (const [sx, sy, r] of [
    [x + w - 40, y + 26, 4],
    [x + w - 62, y + 42, 3],
    [x + 26, y + h - 30, 4],
    [x + 46, y + h - 18, 2.5],
    [x + w - 34, y + h - 26, 3],
  ]) {
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // "Q" badge on the top-left corner
  const bx = x + 14;
  const by = y + 6;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(bx + 5, by + 5, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.arc(bx, by, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.font = `900 44px ${JP_FONT}`;
  ctx.fillStyle = SHELL;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Q', bx, by + 3);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

/** Largest font size whose wrapped question fits the bubble; the smallest one truncates. */
function layoutQuestion(
  ctx: CanvasRenderingContext2D,
  question: string,
): { size: number; lineHeight: number; lines: string[] } {
  const maxWidth = BUBBLE.w - BUBBLE_PAD_X * 2;
  const maxHeight = BUBBLE.h - BUBBLE_PAD_Y * 2;
  const measure = (s: string) => ctx.measureText(s).width;
  for (const [i, size] of QUESTION_SIZES.entries()) {
    const lineHeight = Math.round(size * 1.34);
    const maxLines = Math.min(QUESTION_MAX_LINES, Math.floor(maxHeight / lineHeight));
    ctx.font = `800 ${size}px ${JP_FONT}`;
    const isLast = i === QUESTION_SIZES.length - 1;
    const all = wrapText(measure, question, maxWidth, isLast ? maxLines : Number.POSITIVE_INFINITY);
    if (isLast || all.length <= maxLines) return { size, lineHeight, lines: all };
  }
  throw new Error('unreachable');
}

export async function renderAnswerOgImage(opts: {
  question: string;
  ownerName: string;
  nestTitle: string;
}): Promise<Blob> {
  const { canvas, ctx } = createCanvas();
  await loadFonts();
  const measure = (s: string) => ctx.measureText(s).width;

  drawBackdrop(ctx);

  // The eggs the question hatched from, next to the bubble's tail
  drawEgg(ctx, 1035, 400, 2.2, 0.14);
  drawEgg(ctx, 1140, 478, 1.1, -0.25);
  drawEgg(ctx, 945, 482, 0.9, -0.35);

  drawLogo(ctx, 60, 72, 44);

  // Nest title next to the logo
  ctx.font = `700 26px ${JP_FONT}`;
  const title = wrapText(measure, opts.nestTitle.replace(/\s+/g, ' ').trim(), 390, 1)[0] ?? '';
  if (title) {
    ctx.fillStyle = INK;
    ctx.fillText(`🪺 ${title}`, 530, 68);
  }

  drawBubble(ctx);

  // Question (the hero), vertically centred in the bubble
  const question = opts.question.replace(/\s+/g, ' ').trim() || '（からっぽの卵）';
  const { size, lineHeight, lines } = layoutQuestion(ctx, question);
  ctx.font = `800 ${size}px ${JP_FONT}`;
  ctx.fillStyle = INK;
  const blockHeight = lines.length * lineHeight;
  const firstBaseline = BUBBLE.y + (BUBBLE.h - blockHeight) / 2 + lineHeight / 2 + size * 0.36;
  lines.forEach((line, i) => ctx.fillText(line, BUBBLE.x + BUBBLE_PAD_X, firstBaseline + i * lineHeight));

  // Footer: whose nest + hint
  ctx.font = `700 32px ${JP_FONT}`;
  const suffix = ' の巣に届いた卵';
  const name = wrapText(measure, opts.ownerName.replace(/\s+/g, ' ').trim(), 640 - measure(suffix), 1)[0] ?? '';
  drawLabel(ctx, `${name}${suffix}`, 50, 552, 700);
  ctx.font = `700 28px ${JP_FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('回答はリンク先で 🐣', 1160, 592);
  ctx.textAlign = 'start';

  return toPng(canvas);
}
