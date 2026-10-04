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
/** Ostrich skin (neck, head, legs) — the same neutral as the app's `--neck`. */
const NECK = '#f1e6d6';

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

/** Ground line the ostrich runs back along (the cream band under the scene starts at y=520). */
const GROUND_Y = 572;
const RUNNER_SCALE = 0.8;

/**
 * Where the lapping ostrich is at `u` ∈ [0, 1): along the top of the bubble
 * (facing right), a hop down past the bubble's right side, back along the
 * ground (facing left), then a big jump back up onto the bubble. The ostrich
 * always stays upright; `facing` flips it horizontally.
 */
export function ostrichTrack(u: number): { x: number; y: number; facing: 1 | -1 } {
  const t = ((u % 1) + 1) % 1;
  const top = BUBBLE.y;
  const left = BUBBLE.x + 40;
  const right = BUBBLE.x + BUBBLE.w - 40;
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  // Parabolic hop from (x0, y0) to (x1, y1) that peaks `lift` px above the higher end.
  const hop = (x0: number, y0: number, x1: number, y1: number, lift: number, k: number) => {
    const peak = Math.min(y0, y1) - lift;
    const y = k < 0.5 ? lerp(y0, peak, 1 - (1 - 2 * k) ** 2) : lerp(peak, y1, (2 * k - 1) ** 2);
    return { x: lerp(x0, x1, k), y };
  };
  const legs: [number, (k: number) => { x: number; y: number; facing: 1 | -1 }][] = [
    [0.36, (k) => ({ x: lerp(left, right, k), y: top, facing: 1 })],
    [0.12, (k) => ({ ...hop(right, top, right + 70, GROUND_Y, 40, k), facing: 1 })],
    [0.36, (k) => ({ x: lerp(right + 70, 70, k), y: GROUND_Y, facing: -1 })],
    [0.16, (k) => ({ ...hop(70, GROUND_Y, left, top, 70, k), facing: 1 })],
  ];
  let rest = t;
  for (const [share, at] of legs) {
    if (rest <= share) return at(rest / share);
    rest -= share;
  }
  return legs[0][1](0);
}

/**
 * A running ostrich in canvas strokes, feet at the origin, facing +x, about
 * 120px tall. `phase` (radians) drives the legs and the head bob.
 */
function drawRunningOstrich(ctx: CanvasRenderingContext2D, phase: number) {
  const bounce = -Math.abs(Math.sin(phase)) * 6;
  const outlined = (draw: () => void, width: number, color: string) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = width + 6;
    draw();
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    draw();
    ctx.stroke();
  };

  // legs (hip → knee → foot), swinging in opposite phase
  for (const side of [1, -1]) {
    const swing = Math.sin(phase) * 0.75 * side;
    const hipX = -2;
    const hipY = -46 + bounce;
    const kneeX = hipX + Math.sin(swing) * 22 + 6;
    const kneeY = hipY + 22;
    const footX = hipX + Math.sin(swing) * 34;
    const footY = Math.min(0, -Math.max(0, Math.cos(phase) * side) * 10);
    outlined(() => {
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY);
      ctx.lineTo(footX + 12, footY);
    }, 6, NECK);
  }

  ctx.save();
  ctx.translate(0, bounce);
  // tail tuft
  ctx.fillStyle = SHELL;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  for (const [tx, ty, tr] of [[-40, -70, 10], [-46, -60, 9], [-36, -56, 8]]) {
    ctx.beginPath();
    ctx.arc(tx, ty, tr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // fluffy body
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(-4, -62, 36, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [bx, by] of [[-28, -50], [-12, -44], [6, -44], [22, -50]]) {
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // wing highlight
  ctx.fillStyle = SHELL;
  ctx.beginPath();
  ctx.ellipse(-8, -66, 18, 6, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // neck (bobbing) + head
  const bob = Math.sin(phase * 2) * 4;
  outlined(() => {
    ctx.beginPath();
    ctx.moveTo(22, -70);
    ctx.quadraticCurveTo(34, -92, 30 + bob, -112);
  }, 9, NECK);
  const hx = 34 + bob;
  const hy = -118;
  ctx.fillStyle = NECK;
  ctx.beginPath();
  ctx.arc(hx, hy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // beak
  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.moveTo(hx + 9, hy - 3);
  ctx.quadraticCurveTo(hx + 30, hy - 1, hx + 30, hy + 4);
  ctx.quadraticCurveTo(hx + 18, hy + 8, hx + 8, hy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // googly eye
  ctx.fillStyle = SHELL;
  ctx.beginPath();
  ctx.arc(hx + 3, hy - 3, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(hx + 5, hy - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const GIF_FRAMES = 60;
const GIF_DELAY_MS = 60;
/** GIF frames are encoded at 2/3 scale to keep the file around a megabyte or two. */
const GIF_SCALE = 2 / 3;

/**
 * Rare variant (1 in 10): an animated GIF where an ostrich runs laps around
 * the question bubble. Same scene as the PNG; the static part is drawn once and reused.
 */
export async function renderAnswerOgGif(opts: AnswerCardOptions): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const { canvas: scene, ctx: sceneCtx } = createCanvas();
  await drawAnswerScene(sceneCtx, opts);

  const width = Math.round(W * GIF_SCALE);
  const height = Math.round(H * GIF_SCALE);
  const frame = document.createElement('canvas');
  frame.width = width;
  frame.height = height;
  const ctx = frame.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available');

  const gif = GIFEncoder();
  let palette: ReturnType<typeof quantize> | undefined;
  for (let i = 0; i < GIF_FRAMES; i++) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(scene, 0, 0, width, height);
    ctx.setTransform(GIF_SCALE, 0, 0, GIF_SCALE, 0, 0);
    const { x, y, facing } = ostrichTrack(i / GIF_FRAMES);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing * RUNNER_SCALE, RUNNER_SCALE);
    drawRunningOstrich(ctx, i * 1.3);
    ctx.restore();

    const { data } = ctx.getImageData(0, 0, width, height);
    // One palette from the first frame: the scene never changes colour.
    palette ??= quantize(data, 128);
    gif.writeFrame(applyPalette(data, palette), width, height, {
      palette: i === 0 ? palette : undefined,
      delay: GIF_DELAY_MS,
      repeat: 0,
    });
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

export interface AnswerCardVariant {
  golden: boolean;
  animated: boolean;
}

/** Roll the answer card's rare variants: each one independently 1 in 10. */
export function pickAnswerCardVariant(random: () => number = Math.random): AnswerCardVariant {
  return { golden: random() < 0.1, animated: random() < 0.1 };
}
