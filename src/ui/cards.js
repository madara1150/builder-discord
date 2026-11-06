// วาดรูปการ์ดสำหรับ Log การ์ดต้อนรับ และตัวอย่างเทมเพลต
import { fileURLToPath } from 'node:url';
import { GlobalFonts, createCanvas, loadImage } from '@napi-rs/canvas';

const FONT_DIR = fileURLToPath(new URL('../../node_modules/@fontsource/kanit/files/', import.meta.url));

// fontsource แยกไฟล์ภาษาไทยกับละตินและรายงานน้ำหนักผิด จึงลงทะเบียนแยกชื่อแล้วต่อกันเป็น font stack
for (const [alias, subset, weight] of [
  ['Kanit Latin', 'latin', 400],
  ['Kanit Thai', 'thai', 400],
  ['Kanit Bold Latin', 'latin', 600],
  ['Kanit Bold Thai', 'thai', 600],
]) {
  GlobalFonts.registerFromPath(`${FONT_DIR}kanit-${subset}-${weight}-normal.woff2`, alias);
}

const EMOJI_FONTS = ['Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji']
  .filter((name) => GlobalFonts.families.some((f) => f.family === name));
const EMOJI_STACK = EMOJI_FONTS.map((name) => `"${name}"`).join(', ');

const font = (size, bold = false) => {
  const weight = bold ? 'Bold ' : '';
  return `${size}px "Kanit ${weight}Latin", "Kanit ${weight}Thai"${EMOJI_STACK ? `, ${EMOJI_STACK}` : ''}`;
};

// เครื่องที่ไม่มีฟอนต์อีโมจิจะได้กล่องสี่เหลี่ยมแทน จึงตัดอีโมจิทิ้ง
const EMOJI_PATTERN = /\p{Extended_Pictographic}️?|️|‍/gu;
const clean = (text) => {
  const normalized = String(text ?? '').replaceAll('・', ' · ');
  return (EMOJI_FONTS.length ? normalized : normalized.replace(EMOJI_PATTERN, '')).trim();
};

const THEME = {
  background: '#1e1f22',
  panel: '#2b2d31',
  raised: '#313338',
  text: '#f2f3f5',
  muted: '#b5bac1',
  faint: '#80848e',
  red: '#ed4245',
  green: '#57f287',
  yellow: '#fee75c',
  blurple: '#5865f2',
};

const hex = (color) => `#${color.toString(16).padStart(6, '0')}`;

function tint(color, alpha) {
  const value = parseInt(color.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

const segmenter = new Intl.Segmenter('th', { granularity: 'word' });

// ตัดบรรทัดตามคำ (รองรับภาษาไทยที่ไม่มีช่องว่าง) คืนอาร์เรย์ของบรรทัด
function wrap(ctx, text, maxWidth, maxLines) {
  const lines = [];
  for (const paragraph of clean(text).split('\n')) {
    let line = '';
    for (const { segment } of segmenter.segment(paragraph)) {
      const candidate = line + segment;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
        // คำเดียวยาวเกินบรรทัด ให้ตัดเป็นตัวอักษร
        while (ctx.measureText(line).width > maxWidth && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--;
          lines.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      } else {
        lines.push(line.trimEnd());
        line = segment.trimStart();
      }
    }
    lines.push(line.trimEnd());
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

function ellipsis(ctx, text, maxWidth) {
  let value = clean(text);
  if (ctx.measureText(value).width <= maxWidth) return value;
  while (value && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  return `${value}…`;
}

async function fetchImage(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return await loadImage(Buffer.from(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

function drawCircleImage(ctx, image, x, y, size, fallbackText, ring) {
  ctx.save();
  if (ring) {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 + ring.width, 0, Math.PI * 2);
    ctx.fillStyle = ring.color;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.fillStyle = THEME.blurple;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = font(Math.round(size * 0.42), true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clean(fallbackText).slice(0, 1).toUpperCase() || '?', x + size / 2, y + size / 2);
  }
  ctx.restore();
}

const thaiTime = (date = new Date()) =>
  date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });

// ---------- การ์ดการเปลี่ยนแปลง ----------

const CARD_WIDTH = 1000;
const PAD = 40;
const BOX_TEXT = 22;
const BOX_LINE = 32;
const BOX_PAD = 16;

// rows: [{ label, kind: 'text'|'color'|'image'|'perm', before, after }]
// before/after เป็น null เมื่อไม่มีค่าฝั่งนั้น (เช่น ตอนสร้างหรือลบ)
function measureBox(ctx, kind, value, width, maxLines) {
  if (value === null || value === undefined) return { height: 0 };
  if (kind === 'color') return { height: 64 };
  if (kind === 'image') return { height: 128 };
  ctx.font = font(BOX_TEXT);
  const lines = wrap(ctx, value === '' ? '(ว่าง)' : value, width - BOX_PAD * 2, maxLines);
  return { lines, height: lines.length * BOX_LINE + BOX_PAD * 2 - 6 };
}

function drawBox(ctx, row, side, layout, x, y, width, height, images) {
  const value = row[side];
  const color = side === 'before' ? THEME.red : THEME.green;
  roundRect(ctx, x, y, width, height, 12);
  ctx.fillStyle = tint(color, 0.12);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = tint(color, 0.55);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  if (row.kind === 'color') {
    roundRect(ctx, x + BOX_PAD, y + 14, 36, 36, 8);
    ctx.fillStyle = value;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.stroke();
    ctx.fillStyle = THEME.text;
    ctx.font = font(BOX_TEXT, true);
    ctx.fillText(value.toUpperCase(), x + BOX_PAD + 52, y + 32);
  } else if (row.kind === 'image') {
    const image = images.get(value);
    if (image) {
      ctx.save();
      roundRect(ctx, x + BOX_PAD, y + 16, 96, 96, 16);
      ctx.clip();
      ctx.drawImage(image, x + BOX_PAD, y + 16, 96, 96);
      ctx.restore();
    }
    ctx.fillStyle = THEME.muted;
    ctx.font = font(BOX_TEXT);
    ctx.fillText(image ? (side === 'before' ? 'รูปเดิม' : 'รูปใหม่') : 'ไม่มีรูป', x + BOX_PAD + (image ? 116 : 0), y + 64);
  } else {
    ctx.fillStyle = THEME.text;
    ctx.font = font(BOX_TEXT);
    layout.lines.forEach((line, index) => {
      ctx.fillText(line, x + BOX_PAD, y + BOX_PAD + BOX_LINE / 2 - 3 + index * BOX_LINE);
    });
  }
}

export async function renderChangeCard({ title, accent = THEME.blurple, actor, target, rows, footer }) {
  const shown = rows.slice(0, 8);
  const hidden = rows.length - shown.length;

  const imageUrls = shown.filter((r) => r.kind === 'image').flatMap((r) => [r.before, r.after]).filter(Boolean);
  const [avatar, ...loaded] = await Promise.all([fetchImage(actor?.avatarURL), ...imageUrls.map(fetchImage)]);
  const images = new Map(imageUrls.map((url, index) => [url, loaded[index]]));

  const measure = createCanvas(10, 10).getContext('2d');
  const contentWidth = CARD_WIDTH - PAD * 2 - 8;
  const halfWidth = (contentWidth - 56) / 2;

  const layouts = shown.map((row) => {
    const single = row.before == null || row.after == null;
    const width = single ? contentWidth : halfWidth;
    const maxLines = row.kind === 'text' && row.long ? 8 : 4;
    const before = measureBox(measure, row.kind, row.before, width, maxLines);
    const after = measureBox(measure, row.kind, row.after, width, maxLines);
    return { single, width, before, after, height: 38 + Math.max(before.height, after.height) };
  });

  const headerHeight = 150;
  const rowsHeight = layouts.reduce((sum, l) => sum + l.height + 22, 0) + (hidden > 0 ? 40 : 0);
  const height = headerHeight + rowsHeight + 70;

  const canvas = createCanvas(CARD_WIDTH, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = THEME.background;
  ctx.fillRect(0, 0, CARD_WIDTH, height);
  roundRect(ctx, 16, 16, CARD_WIDTH - 32, height - 32, 22);
  ctx.fillStyle = THEME.panel;
  ctx.fill();
  ctx.save();
  roundRect(ctx, 16, 16, CARD_WIDTH - 32, height - 32, 22);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(16, 16, 8, height - 32);
  ctx.restore();

  const left = PAD + 8;
  drawCircleImage(ctx, avatar, left, 44, 76, actor?.name, { width: 3, color: accent });

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = THEME.text;
  ctx.font = font(34, true);
  ctx.fillText(ellipsis(ctx, title, CARD_WIDTH - left - 120 - PAD), left + 96, 78);
  ctx.font = font(22);
  ctx.fillStyle = THEME.muted;
  const byline = [actor?.name && `โดย ${actor.name}`, target && `เป้าหมาย ${target}`].filter(Boolean).join('  ·  ');
  ctx.fillText(ellipsis(ctx, byline, CARD_WIDTH - left - 120 - PAD), left + 96, 114);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(left, headerHeight - 6, contentWidth, 2);

  let y = headerHeight + 18;
  shown.forEach((row, index) => {
    const layout = layouts[index];
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = THEME.muted;
    ctx.font = font(20, true);
    ctx.fillText(clean(row.label), left, y + 22);

    const boxY = y + 36;
    const boxHeight = Math.max(layout.before.height, layout.after.height);
    if (layout.single) {
      const side = row.before == null ? 'after' : 'before';
      drawBox(ctx, row, side, layout[side], left, boxY, contentWidth, boxHeight, images);
    } else {
      drawBox(ctx, row, 'before', layout.before, left, boxY, halfWidth, boxHeight, images);
      ctx.fillStyle = THEME.faint;
      ctx.font = font(30, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('→', left + halfWidth + 28, boxY + boxHeight / 2);
      drawBox(ctx, row, 'after', layout.after, left + halfWidth + 56, boxY, halfWidth, boxHeight, images);
    }
    y += layout.height + 22;
  });

  if (hidden > 0) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = THEME.muted;
    ctx.font = font(20);
    ctx.fillText(`และอีก ${hidden} รายการ`, left, y + 18);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = THEME.faint;
  ctx.font = font(18);
  ctx.fillText(clean(footer ?? thaiTime()), left, height - 42);

  return canvas.toBuffer('image/png');
}

// ---------- การ์ดต้อนรับ ----------

export async function renderWelcomeCard({ name, avatarURL, guildName, memberCount }) {
  const width = 1000;
  const height = 340;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#5865f2');
  gradient.addColorStop(1, '#9b59b6');
  roundRect(ctx, 0, 0, width, height, 28);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.save();
  roundRect(ctx, 0, 0, width, height, 28);
  ctx.clip();
  for (const [x, y, r, a] of [[880, 40, 160, 0.10], [960, 300, 120, 0.08], [520, 360, 90, 0.07], [60, -30, 80, 0.08]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fill();
  }
  ctx.restore();

  const avatar = await fetchImage(avatarURL);
  drawCircleImage(ctx, avatar, 64, 70, 200, name, { width: 8, color: 'rgba(255,255,255,0.9)' });

  const textX = 320;
  const textWidth = width - textX - 50;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = font(30);
  ctx.fillText('ยินดีต้อนรับ', textX, 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = font(54, true);
  ctx.fillText(ellipsis(ctx, name, textWidth), textX, 192);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = font(26);
  ctx.fillText(ellipsis(ctx, `สู่ ${guildName}`, textWidth), textX, 240);

  const badge = `สมาชิกคนที่ ${memberCount.toLocaleString('th-TH')}`;
  ctx.font = font(22, true);
  const badgeWidth = ctx.measureText(badge).width + 36;
  roundRect(ctx, textX, 262, badgeWidth, 44, 22);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, textX + 18, 285);

  return canvas.toBuffer('image/png');
}

// ---------- เลเวล ----------

function drawProgressBar(ctx, x, y, width, height, ratio, from, to) {
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  const filled = Math.max(height, width * Math.min(1, Math.max(0, ratio)));
  const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  roundRect(ctx, x, y, filled, height, height / 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

const number = (value) => value.toLocaleString('th-TH');

// tier: { name, color } ของยศรางวัลปัจจุบัน หรือ null
export async function renderRankCard({ name, avatarURL, level, current, needed, totalXp, rank, tier, messages, voiceMinutes }) {
  const width = 1000;
  const height = 320;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const accent = tier?.color ?? THEME.blurple;

  roundRect(ctx, 0, 0, width, height, 28);
  ctx.fillStyle = THEME.panel;
  ctx.fill();
  ctx.save();
  roundRect(ctx, 0, 0, width, height, 28);
  ctx.clip();
  const glow = ctx.createRadialGradient(160, 160, 20, 160, 160, 420);
  glow.addColorStop(0, tint(accent, 0.35));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const avatar = await fetchImage(avatarURL);
  drawCircleImage(ctx, avatar, 50, 60, 200, name, { width: 7, color: accent });

  const x = 300;
  const barWidth = width - x - 50;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = THEME.text;
  ctx.font = font(44, true);
  ctx.fillText(ellipsis(ctx, name, barWidth - 230), x, 104);

  ctx.textAlign = 'right';
  ctx.font = font(22);
  ctx.fillStyle = THEME.muted;
  ctx.fillText('อันดับ', width - 50 - 110, 72);
  ctx.fillText('เลเวล', width - 50, 72);
  ctx.font = font(48, true);
  ctx.fillStyle = THEME.text;
  ctx.fillText(rank ? `#${rank}` : '-', width - 50 - 110, 120);
  ctx.fillStyle = accent;
  ctx.fillText(`${level}`, width - 50, 120);

  if (tier) {
    ctx.textAlign = 'left';
    ctx.font = font(20, true);
    const pill = clean(tier.name);
    const pillWidth = ctx.measureText(pill).width + 32;
    roundRect(ctx, x, 128, pillWidth, 36, 18);
    ctx.fillStyle = tint(accent, 0.25);
    ctx.fill();
    ctx.fillStyle = THEME.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(pill, x + 16, 147);
    ctx.textBaseline = 'alphabetic';
  }

  const maxed = needed === 0;
  drawProgressBar(ctx, x, 196, barWidth, 30, maxed ? 1 : current / needed, accent, '#eb459e');
  ctx.textAlign = 'left';
  ctx.font = font(20);
  ctx.fillStyle = THEME.muted;
  ctx.fillText(maxed ? 'เลเวลสูงสุดแล้ว 🏆' : `${number(current)} / ${number(needed)} EXP`, x, 258);
  ctx.textAlign = 'right';
  ctx.fillText(maxed ? '' : `อีก ${number(needed - current)} EXP ถึงเลเวล ${level + 1}`, width - 50, 258);

  ctx.textAlign = 'left';
  ctx.font = font(18);
  ctx.fillStyle = THEME.faint;
  ctx.fillText(clean(`EXP รวม ${number(totalXp)}  ·  💬 ${number(messages)} ข้อความ  ·  🎙️ ${number(voiceMinutes)} นาทีในห้องเสียง`), x, 294);

  return canvas.toBuffer('image/png');
}

export async function renderLevelUpCard({ name, avatarURL, before, after, current, needed, tier }) {
  const width = 1000;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f5a623');
  gradient.addColorStop(0.5, '#eb459e');
  gradient.addColorStop(1, '#5865f2');
  roundRect(ctx, 0, 0, width, height, 28);
  ctx.fillStyle = gradient;
  ctx.fill();

  // พลุกระดาษ
  ctx.save();
  roundRect(ctx, 0, 0, width, height, 28);
  ctx.clip();
  const colors = ['#ffffff', '#fee75c', '#57f287', '#ffb3d9', '#9bd1ff'];
  for (let i = 0; i < 46; i++) {
    const px = (i * 211) % width;
    const py = (i * 97) % height;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((i * 37) % 360);
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.35;
    ctx.fillRect(-5, -2, 10, 4);
    ctx.restore();
  }
  ctx.restore();

  const avatar = await fetchImage(avatarURL);
  drawCircleImage(ctx, avatar, 54, 50, 200, name, { width: 8, color: 'rgba(255,255,255,0.95)' });

  const x = 300;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = font(28, true);
  ctx.fillText(clean('🎉 เลเวลอัป!'), x, 82);
  ctx.fillStyle = '#ffffff';
  ctx.font = font(42, true);
  ctx.fillText(ellipsis(ctx, name, width - x - 60), x, 134);

  ctx.font = font(64, true);
  const fromText = `${before}`;
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText(fromText, x, 212);
  const fromWidth = ctx.measureText(fromText).width;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('→', x + fromWidth + 20, 212);
  const arrowWidth = ctx.measureText('→').width;
  ctx.fillText(`${after}`, x + fromWidth + arrowWidth + 40, 212);

  if (tier) {
    ctx.font = font(22, true);
    const label = clean(`ได้รับยศ ${tier.name}`);
    const pillWidth = ctx.measureText(label).width + 36;
    const pillX = width - 50 - pillWidth;
    roundRect(ctx, pillX, 166, pillWidth, 44, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pillX + 18, 189);
    ctx.textBaseline = 'alphabetic';
  }

  drawProgressBar(ctx, x, 236, width - x - 50, 18, needed ? current / needed : 1, '#ffffff', '#fee75c');
  ctx.font = font(18);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(needed ? `${number(current)} / ${number(needed)} EXP ถึงเลเวลถัดไป` : 'เลเวลสูงสุดแล้ว', x, 280);

  return canvas.toBuffer('image/png');
}

// ---------- แบนเนอร์แผงทิกเก็ต ----------

export function renderTicketBanner({ guildName }) {
  const width = 1000;
  const height = 280;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#5865f2');
  gradient.addColorStop(1, '#eb459e');
  roundRect(ctx, 0, 0, width, height, 28);
  ctx.fillStyle = gradient;
  ctx.fill();

  // ลายตั๋วด้านขวา
  ctx.save();
  roundRect(ctx, 0, 0, width, height, 28);
  ctx.clip();
  ctx.translate(800, 140);
  ctx.rotate(-0.18);
  roundRect(ctx, -150, -85, 300, 170, 22);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fill();
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, -70);
  ctx.lineTo(60, 70);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = font(44, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TICKET', -45, 0);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(56, true);
  ctx.fillText(clean('🎫 ติดต่อทีมงาน'), 56, 120);
  ctx.font = font(26);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('เลือกหัวข้อจากเมนูด้านล่าง', 56, 172);
  ctx.fillText('บอทจะสร้างห้องส่วนตัวให้คุณกับทีมงาน', 56, 210);
  ctx.font = font(20);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(ellipsis(ctx, guildName, 560), 56, 252);

  return canvas.toBuffer('image/png');
}

// ---------- ตัวอย่างเทมเพลต ----------

const STATUS_STYLE = {
  create: { label: 'ใหม่', color: THEME.green },
  update: { label: 'แก้ไข', color: THEME.yellow },
  keep: { label: '', color: null },
};

function drawSpeaker(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x + 6, y - 5);
  ctx.lineTo(x + 13, y - 11);
  ctx.lineTo(x + 13, y + 11);
  ctx.lineTo(x + 6, y + 5);
  ctx.lineTo(x, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x + 14, y, 8, -Math.PI / 3.2, Math.PI / 3.2);
  ctx.stroke();
}

function drawLock(ctx, x, y, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x + 7, y - 4, 5, Math.PI, 0);
  ctx.stroke();
  roundRect(ctx, x, y - 4, 14, 11, 2);
  ctx.fill();
}

// plan มาจาก planTemplate() ใน builder.js
export function renderTemplatePreview({ plan, guildName }) {
  const { template, steps, counts } = plan;
  const width = 1000;
  const columnWidth = 440;
  const rowHeight = 40;
  const categoryHeight = 46;

  // แบ่งหมวดลงสองคอลัมน์ให้สูงใกล้เคียงกัน
  const groups = [];
  for (const step of steps) {
    if (!step.parentStep) groups.push({ category: step, items: [] });
    else groups.at(-1).items.push(step);
  }
  const groupHeight = (g) => categoryHeight + g.items.length * rowHeight + 18;
  const total = groups.reduce((sum, g) => sum + groupHeight(g), 0);
  const columns = [[], []];
  let leftHeight = 0;
  for (const group of groups) {
    if (leftHeight < total / 2) {
      columns[0].push(group);
      leftHeight += groupHeight(group);
    } else {
      columns[1].push(group);
    }
  }
  const bodyHeight = Math.max(...columns.map((col) => col.reduce((sum, g) => sum + groupHeight(g), 0)));
  const headerHeight = 200;
  const height = headerHeight + bodyHeight + 90;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = THEME.background;
  ctx.fillRect(0, 0, width, height);

  const headerGradient = ctx.createLinearGradient(0, 0, width, headerHeight);
  headerGradient.addColorStop(0, '#5865f2');
  headerGradient.addColorStop(1, '#3c45a5');
  ctx.fillStyle = headerGradient;
  ctx.fillRect(0, 0, width, headerHeight - 20);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(46, true);
  ctx.fillText(clean(`${template.emoji} เทมเพลต${template.name}`), 40, 74);
  ctx.font = font(22);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(ellipsis(ctx, template.description, width - 80), 40, 112);

  let chipX = 40;
  for (const [label, value, color] of [
    ['สร้างใหม่', counts.create, THEME.green],
    ['แก้ไข', counts.update, THEME.yellow],
    ['เหมือนเดิม', counts.keep, '#ffffff'],
  ]) {
    const text = `${label} ${value}`;
    ctx.font = font(20, true);
    const chipWidth = ctx.measureText(text).width + 46;
    roundRect(ctx, chipX, 128, chipWidth, 36, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(chipX + 18, 146, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, chipX + 32, 147);
    ctx.textBaseline = 'alphabetic';
    chipX += chipWidth + 12;
  }

  columns.forEach((column, columnIndex) => {
    const x = 40 + columnIndex * (columnWidth + 40);
    let y = headerHeight;
    for (const { category, items } of column) {
      const categoryStyle = STATUS_STYLE[category.action];
      ctx.fillStyle = THEME.faint;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 18);
      ctx.lineTo(x + 12, y + 18);
      ctx.lineTo(x + 7, y + 24);
      ctx.closePath();
      ctx.fill();
      ctx.font = font(19, true);
      ctx.fillStyle = THEME.muted;
      ctx.textBaseline = 'middle';
      ctx.fillText(ellipsis(ctx, category.item.name, columnWidth - 110), x + 20, y + 21);
      if (categoryStyle.label) drawBadge(ctx, categoryStyle, x + columnWidth, y + 21);
      y += categoryHeight;

      for (const step of items) {
        const style = STATUS_STYLE[step.action];
        if (style.color) {
          roundRect(ctx, x, y + 2, columnWidth, rowHeight - 6, 8);
          ctx.fillStyle = tint(style.color, 0.1);
          ctx.fill();
        }
        const iconColor = THEME.faint;
        if (step.item.voice) {
          drawSpeaker(ctx, x + 12, y + rowHeight / 2 - 1, iconColor);
        } else {
          ctx.fillStyle = iconColor;
          ctx.font = font(26);
          ctx.fillText('#', x + 12, y + rowHeight / 2 - 1);
        }
        const hidden = step.item.access === 'staff' || step.item.access === 'log' || category.item.access === 'staff';
        const nameX = x + 46;
        ctx.font = font(21);
        ctx.fillStyle = step.action === 'keep' ? THEME.muted : THEME.text;
        const nameWidth = columnWidth - 46 - (style.label ? 90 : 16) - (hidden ? 24 : 0);
        const name = ellipsis(ctx, step.item.name, nameWidth);
        ctx.fillText(name, nameX, y + rowHeight / 2 - 1);
        if (hidden) drawLock(ctx, nameX + ctx.measureText(name).width + 10, y + rowHeight / 2 - 1, THEME.faint);
        if (style.label) drawBadge(ctx, style, x + columnWidth - 8, y + rowHeight / 2 - 1);
        y += rowHeight;
      }
      y += 18;
    }
  });

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = THEME.faint;
  ctx.font = font(18);
  ctx.textAlign = 'left';
  ctx.fillText(ellipsis(ctx, `${guildName}  ·  ไม่มีการลบห้องเดิม  ·  ${thaiTime()}`, width - 80), 40, height - 36);

  return canvas.toBuffer('image/png');
}

function drawBadge(ctx, style, rightX, centerY) {
  ctx.font = font(16, true);
  const badgeWidth = ctx.measureText(style.label).width + 22;
  roundRect(ctx, rightX - badgeWidth, centerY - 13, badgeWidth, 26, 13);
  ctx.fillStyle = tint(style.color, 0.22);
  ctx.fill();
  ctx.fillStyle = style.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(style.label, rightX - badgeWidth + 11, centerY + 1);
}

export { hex as colorHex, thaiTime };
