// วางแผนและสร้างห้องตามเทมเพลต ไม่ลบห้องเดิมของเซิร์ฟเวอร์
import { ChannelType, PermissionFlagsBits as P, PermissionsBitField } from 'discord.js';
import { ROLE_LEVELS } from './layout.js';
import { channels, saveChannels } from './store.js';

const BOT_CHANNEL_ALLOW = [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory];
const NO_POSTING = [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads];

function permissionOverwrites(access, { everyoneId, staffIds, botId }) {
  const bot = { id: botId, allow: BOT_CHANNEL_ALLOW };
  const staff = (overwrite) => staffIds.map((id) => ({ id, ...overwrite }));
  switch (access) {
    case 'readonly':
      return [{ id: everyoneId, deny: NO_POSTING }, ...staff({ allow: [P.SendMessages] }), bot];
    case 'staff':
      return [{ id: everyoneId, deny: [P.ViewChannel] }, ...staff({ allow: [P.ViewChannel] }), bot];
    case 'log':
      return [
        { id: everyoneId, deny: [P.ViewChannel] },
        ...staff({ allow: [P.ViewChannel, P.ReadMessageHistory], deny: NO_POSTING }),
        bot,
      ];
    default:
      return [];
  }
}

function overwritesMatch(channel, desired) {
  const current = channel.permissionOverwrites.cache;
  if (current.size !== desired.length) return false;
  return desired.every(({ id, allow = [], deny = [] }) => {
    const overwrite = current.get(id);
    return overwrite?.allow.equals(new PermissionsBitField(allow)) && overwrite.deny.equals(new PermissionsBitField(deny));
  });
}

// Discord แปลงชื่อห้องข้อความเป็นตัวเล็กและแทนช่องว่างด้วย - จึงต้องเทียบแบบเดียวกัน
const sameName = (a, b) => a.toLowerCase().replaceAll(' ', '-') === b.toLowerCase().replaceAll(' ', '-');

// ห้องที่เป็นของ key อื่นอยู่แล้วจะไม่ถูกหยิบมาใช้ซ้ำแม้ชื่อตรงกัน
function findExisting(guild, item, type, claimed) {
  const known = guild.channels.cache.get(channels[item.key]);
  if (known) return known;
  return guild.channels.cache.find((c) => c.type === type && !claimed.has(c.id) && sameName(c.name, item.name));
}

function planItem(guild, item, type, parentStep, ids, claimed) {
  const existing = findExisting(guild, item, type, claimed);
  if (existing) claimed.add(existing.id);
  const overwrites = permissionOverwrites(item.access, ids);

  const changes = [];
  if (existing) {
    if (!sameName(existing.name, item.name)) changes.push('ชื่อ');
    if (parentStep && existing.parentId !== parentStep.existing?.id) changes.push('หมวดหมู่');
    if (type === ChannelType.GuildText && item.topic !== undefined && (existing.topic ?? '') !== item.topic) changes.push('คำอธิบาย');
    if (!overwritesMatch(existing, overwrites)) changes.push('สิทธิ์');
  }

  return {
    item,
    type,
    parentStep,
    existing,
    overwrites,
    changes,
    action: !existing ? 'create' : changes.length ? 'update' : 'keep',
  };
}

export function staffRoleIds(guild) {
  return ROLE_LEVELS.filter((level) => level.staff)
    .map((level) => guild.roles.cache.find((role) => role.name === level.name)?.id)
    .filter(Boolean);
}

// ต้อง fetch ห้องและยศของ guild ก่อนเรียก
export function planTemplate(guild, template, botId) {
  const ids = { everyoneId: guild.roles.everyone.id, staffIds: staffRoleIds(guild), botId };
  const claimed = new Set(Object.values(channels));
  const steps = [];

  for (const category of template.categories) {
    const categoryStep = planItem(guild, category, ChannelType.GuildCategory, null, ids, claimed);
    steps.push(categoryStep);
    for (const item of category.channels) {
      const type = item.voice ? ChannelType.GuildVoice : ChannelType.GuildText;
      steps.push(planItem(guild, item, type, categoryStep, ids, claimed));
    }
  }

  const counts = { create: 0, update: 0, keep: 0 };
  for (const step of steps) counts[step.action]++;
  return { template, steps, counts, staffRoles: ids.staffIds.length };
}

export async function applyPlan(guild, plan, onProgress = () => {}) {
  const categories = [];
  let done = 0;

  for (const step of plan.steps) {
    const options = { name: step.item.name, type: step.type, permissionOverwrites: step.overwrites };
    if (step.parentStep) options.parent = step.parentStep.channel;
    if (step.type === ChannelType.GuildText && step.item.topic) options.topic = step.item.topic;

    if (step.action === 'create') {
      step.channel = await guild.channels.create(options);
    } else if (step.action === 'update') {
      const { type, ...changes } = options;
      step.channel = await step.existing.edit(changes);
    } else {
      step.channel = step.existing;
    }

    channels[step.item.key] = step.channel.id;
    if (step.type === ChannelType.GuildCategory) categories.push(step.channel);
    await onProgress(++done, plan.steps.length, step);
  }
  saveChannels();

  // ให้หมวดของเทมเพลตอยู่บนสุด โดยคงลำดับของหมวดอื่นไว้ต่อท้าย
  const otherCategories = guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildCategory && !categories.some((own) => own.id === c.id))
    .sort((a, b) => a.position - b.position);
  await guild.channels.setPositions(
    [...categories, ...otherCategories.values()].map((channel, position) => ({ channel, position })),
  );
}
