// ระบบเลเวล: ได้ EXP จากการแชทและอยู่ห้องเสียง เลเวลสูงสุด 100 และมียศรางวัลทุก 10 เลเวล
import { AttachmentBuilder, Events } from 'discord.js';
import { channels, levels, saveLevels } from './store.js';
import { renderLevelUpCard } from './ui/cards.js';

export const MAX_LEVEL = 100;

// ยศรางวัลทุก 10 เลเวล ชื่อใช้เป็นตัวอ้างอิง ถ้าเปลี่ยนชื่อในนี้จะได้ยศใหม่
export const XP_TIERS = [
  { level: 10, emoji: '🥉', color: 0xcd7f32 },
  { level: 20, emoji: '🥈', color: 0xbfc5cc },
  { level: 30, emoji: '🥇', color: 0xf5c542 },
  { level: 40, emoji: '🏅', color: 0x2ecc71 },
  { level: 50, emoji: '🎖️', color: 0x3498db },
  { level: 60, emoji: '💠', color: 0x1abc9c },
  { level: 70, emoji: '🔮', color: 0x9b59b6 },
  { level: 80, emoji: '🔥', color: 0xe67e22 },
  { level: 90, emoji: '🌟', color: 0xf1c40f },
  { level: 100, emoji: '🏆', color: 0xe91e63 },
].map((tier) => ({ ...tier, name: `${tier.emoji} เลเวล ${tier.level}` }));

const MESSAGE_XP = [15, 25];
const MESSAGE_COOLDOWN_MS = 60 * 1000;
const VOICE_XP_PER_MINUTE = 10;
const SAVE_EVERY_MS = 15 * 1000;

// EXP ที่ต้องใช้จากเลเวล L ไป L+1 เพิ่มขึ้นเรื่อยๆ ตามเลเวล
export const xpForNext = (level) => 5 * level * level + 50 * level + 100;

// EXP สะสมที่ต้องมีเพื่อถึงแต่ละเลเวล
const TOTAL = [0];
for (let level = 1; level <= MAX_LEVEL; level++) TOTAL[level] = TOTAL[level - 1] + xpForNext(level - 1);
export const totalForLevel = (level) => TOTAL[Math.max(0, Math.min(MAX_LEVEL, level))];

export function levelFromXp(xp) {
  let level = 0;
  while (level < MAX_LEVEL && xp >= TOTAL[level + 1]) level++;
  return level;
}

// ความคืบหน้าในเลเวลปัจจุบัน
export function progress(xp) {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return { level, current: xp - TOTAL[MAX_LEVEL], needed: 0 };
  return { level, current: xp - TOTAL[level], needed: xpForNext(level) };
}

export const tierFor = (level) => [...XP_TIERS].reverse().find((tier) => level >= tier.level) ?? null;

export function record(guildId, userId) {
  levels[guildId] ??= {};
  levels[guildId][userId] ??= { xp: 0, messages: 0, voiceMinutes: 0 };
  return levels[guildId][userId];
}

export function ranking(guildId) {
  return Object.entries(levels[guildId] ?? {})
    .map(([userId, data]) => ({ userId, ...data }))
    .filter((entry) => entry.xp > 0)
    .sort((a, b) => b.xp - a.xp);
}

export const rankOf = (guildId, userId) => ranking(guildId).findIndex((entry) => entry.userId === userId) + 1;

let dirty = false;
export function flushLevels() {
  if (!dirty) return;
  dirty = false;
  saveLevels();
}

// สร้างยศรางวัลที่ยังไม่มี จากสูงไปต่ำ เพราะยศใหม่จะอยู่ล่างสุดเสมอ
export async function ensureTierRoles(guild) {
  const roles = await guild.roles.fetch();
  let created = 0;
  for (const tier of [...XP_TIERS].reverse()) {
    if (roles.some((role) => role.name === tier.name)) continue;
    await guild.roles.create({ name: tier.name, colors: { primaryColor: tier.color }, permissions: [], mentionable: false });
    created++;
  }
  return created;
}

// ให้ยศรางวัลตามเลเวลปัจจุบัน และถอดยศรางวัลอื่นออก
export async function syncTierRole(member, level) {
  const tier = tierFor(level);
  const tierNames = new Set(XP_TIERS.map((t) => t.name));
  const remove = member.roles.cache.filter((role) => tierNames.has(role.name) && role.name !== tier?.name);
  if (remove.size) await member.roles.remove([...remove.keys()], 'เปลี่ยนยศตามเลเวล');
  const role = tier && member.guild.roles.cache.find((r) => r.name === tier.name);
  if (role && !member.roles.cache.has(role.id)) await member.roles.add(role, 'เปลี่ยนยศตามเลเวล');
  return role ?? null;
}

// เพิ่มหรือลด EXP คืนเลเวลก่อนและหลัง
export async function changeXp(member, amount) {
  const data = record(member.guild.id, member.id);
  const before = levelFromXp(data.xp);
  data.xp = Math.max(0, data.xp + amount);
  dirty = true;
  const after = levelFromXp(data.xp);
  if (tierFor(before) !== tierFor(after)) await syncTierRole(member, after);
  return { before, after };
}

export async function setLevel(member, level) {
  const data = record(member.guild.id, member.id);
  const before = levelFromXp(data.xp);
  data.xp = totalForLevel(level);
  dirty = true;
  await syncTierRole(member, level);
  return { before, after: level };
}

const CONGRATS = [
  (m, l) => `🎉 ยินดีด้วย ${m}! เลเวลอัปเป็น **เลเวล ${l}** แล้ว`,
  (m, l) => `🥳 เก่งมาก ${m}! ตอนนี้ถึง **เลเวล ${l}** แล้ว`,
  (m, l) => `✨ ${m} อัปเป็น **เลเวล ${l}** ขอแสดงความยินดีด้วย!`,
  (m, l) => `🚀 ${m} พุ่งขึ้น **เลเวล ${l}** แล้ว สู้ต่อไป!`,
  (m, l) => `👏 ปรบมือให้ ${m} ที่ขึ้น **เลเวล ${l}** ได้สำเร็จ!`,
];

async function announceLevelUp(member, before, after, send) {
  const tier = tierFor(after);
  const newTier = tier && tier !== tierFor(before) ? member.guild.roles.cache.find((r) => r.name === tier.name) : null;
  const congrats = after >= MAX_LEVEL
    ? `🏆 สุดยอด! ${member} ถึง **เลเวล ${MAX_LEVEL}** เลเวลสูงสุดของเซิร์ฟเวอร์แล้ว ขอแสดงความยินดีด้วย!`
    : CONGRATS[Math.floor(Math.random() * CONGRATS.length)](member, after);
  const content = `${congrats}${newTier ? `\n🎁 ได้รับยศใหม่ ${newTier}` : ''}`;
  const key = channels['level-up'] ? 'level-up' : 'bot-commands';
  try {
    const { current, needed } = progress(record(member.guild.id, member.id).xp);
    const image = await renderLevelUpCard({
      name: member.displayName,
      avatarURL: member.displayAvatarURL({ extension: 'png', size: 256 }),
      before,
      after,
      current,
      needed,
      tier: newTier ? { name: newTier.name, color: newTier.hexColor } : null,
    });
    await send(key, { content, files: [new AttachmentBuilder(image, { name: 'level-up.png' })], allowedMentions: { users: [member.id] } });
  } catch (error) {
    console.error(`วาดการ์ดเลเวลอัปไม่สำเร็จ: ${error.message}`);
    await send(key, { content, allowedMentions: { users: [member.id] } });
  }
}

async function grant(member, amount, send) {
  const { before, after } = await changeXp(member, amount);
  if (after > before) await announceLevelUp(member, before, after, send);
}

export function registerXp(client, { send }) {
  const lastMessageAt = new Map();

  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot || message.webhookId || !message.member) return;
    const key = `${message.guild.id}:${message.author.id}`;
    if (Date.now() - (lastMessageAt.get(key) ?? 0) < MESSAGE_COOLDOWN_MS) return;
    lastMessageAt.set(key, Date.now());
    record(message.guild.id, message.author.id).messages++;
    const amount = MESSAGE_XP[0] + Math.floor(Math.random() * (MESSAGE_XP[1] - MESSAGE_XP[0] + 1));
    await grant(message.member, amount, send).catch((error) => console.error(`ให้ EXP ไม่สำเร็จ: ${error.message}`));
  });

  // ทุกนาที ให้ EXP คนที่อยู่ห้องเสียงกับคนอื่น (ไม่นับห้อง AFK และคนที่ปิดหูฟัง)
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      for (const channel of guild.channels.cache.filter((c) => c.isVoiceBased() && c.id !== guild.afkChannelId).values()) {
        const humans = channel.members.filter((m) => !m.user.bot);
        if (humans.size < 2) continue;
        for (const member of humans.values()) {
          if (member.voice.selfDeaf || member.voice.serverDeaf) continue;
          record(guild.id, member.id).voiceMinutes++;
          await grant(member, VOICE_XP_PER_MINUTE, send).catch((error) => console.error(`ให้ EXP ไม่สำเร็จ: ${error.message}`));
        }
      }
    }
  }, 60 * 1000);

  setInterval(flushLevels, SAVE_EVERY_MS);
}
