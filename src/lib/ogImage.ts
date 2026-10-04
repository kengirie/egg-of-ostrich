/**
 * Draws the 1200x630 share cards (nest + answered question) in the browser at
 * publish time (Rostrum renders its thumbnail from the PDF the same way — no server).
 */

const W = 1200;
const H = 630;

// Palette A: cream × ink × one orange (same as the app's tokens in index.css).
const INK = '#241a12';
const CREAM = '#fbf6ec';
const SHELL = '#fffdf8';
const SPECKLE = '#d8cbb6';
const ORANGE = '#f0591b';
/** Pale orange: the only tint, used for the sun and labels. */
const TINT = '#fde4d8';
const GROUND = '#f1e9dc';

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

// The rare golden egg (1 in 10 answer cards).
const GOLD_LIGHT = '#ffe37a';
const GOLD = '#f2b51c';
const GOLD_DARK = '#c27f0a';

function drawEgg(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, rotate: number, gold = false) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotate);
  ctx.translate(-cx, -cy);
  // sticker shadow
  eggPath(ctx, cx + 8, cy + 8, s);
  ctx.fillStyle = INK;
  ctx.fill();
  eggPath(ctx, cx, cy, s);
  if (gold) {
    const shine = ctx.createLinearGradient(cx - 42 * s, cy - 55 * s, cx + 42 * s, cy + 55 * s);
    shine.addColorStop(0, GOLD_LIGHT);
    shine.addColorStop(0.55, GOLD);
    shine.addColorStop(1, GOLD_DARK);
    ctx.fillStyle = shine;
  } else {
    ctx.fillStyle = SHELL;
  }
  ctx.fill();
  ctx.lineWidth = 4 + s;
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (gold) {
    // glossy highlight instead of speckles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(cx - 16 * s, cy - 22 * s, 7 * s, 15 * s, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
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
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = TINT;
  ctx.beginPath();
  ctx.arc(1080, 110, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = GROUND;
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
  ctx.fillStyle = TINT;
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
  ctx.fillText('匿名で卵（質問）を投げつけよう', 70, 584);

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

/** Four-pointed twinkle around the golden egg. */
function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.closePath();
  ctx.fillStyle = GOLD_LIGHT;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

export interface AnswerCardOptions {
  question: string;
  /** Rare variant: the eggs are gold. */
  golden?: boolean;
}

/** Everything on the answer card except the running ostrich. */
async function drawAnswerScene(ctx: CanvasRenderingContext2D, { question, golden = false }: AnswerCardOptions) {
  await loadFonts();
  drawBackdrop(ctx);

  // The eggs the question hatched from, next to the bubble's tail
  drawEgg(ctx, 1035, 400, 2.2, 0.14, golden);
  drawEgg(ctx, 1140, 478, 1.1, -0.25, golden);
  drawEgg(ctx, 945, 482, 0.9, -0.35, golden);
  if (golden) {
    drawSparkle(ctx, 1150, 300, 22);
    drawSparkle(ctx, 960, 330, 14);
    drawSparkle(ctx, 1110, 395, 10);
  }

  drawLogo(ctx, 60, 72, 44);
  drawBubble(ctx);

  // Question (the hero), vertically centred in the bubble
  const text = question.replace(/\s+/g, ' ').trim() || '（からっぽの卵）';
  const { size, lineHeight, lines } = layoutQuestion(ctx, text);
  ctx.font = `800 ${size}px ${JP_FONT}`;
  ctx.fillStyle = INK;
  const blockHeight = lines.length * lineHeight;
  const firstBaseline = BUBBLE.y + (BUBBLE.h - blockHeight) / 2 + lineHeight / 2 + size * 0.36;
  lines.forEach((line, i) => ctx.fillText(line, BUBBLE.x + BUBBLE_PAD_X, firstBaseline + i * lineHeight));
}

/** The answer link's card: just the logo, the question in a bubble, and eggs — no names or captions. */
export async function renderAnswerOgImage(opts: AnswerCardOptions): Promise<Blob> {
  const { canvas, ctx } = createCanvas();
  await drawAnswerScene(ctx, opts);
  return toPng(canvas);
}

export interface AnswerCardVariant {
  golden: boolean;
}

/** Roll the answer card's rare variant: golden eggs, 1 in 10. */
export function pickAnswerCardVariant(random: () => number = Math.random): AnswerCardVariant {
  return { golden: random() < 0.1 };
}
