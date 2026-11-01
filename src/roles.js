import { ROLE_LEVELS } from './layout.js';

const LEVEL_NAMES = new Set(ROLE_LEVELS.map((role) => role.name));

// เปลี่ยนยศระดับของ target คืน role ใหม่ หรือ null ถ้า actor ไม่มีสิทธิ์ให้ยศนี้
export async function setLevel(actor, target, level) {
  const { guild } = actor;
  const role = guild.roles.cache.find((r) => r.name === ROLE_LEVELS.find((l) => l.level === level).name);
  if (actor.id !== guild.ownerId && actor.roles.highest.comparePositionTo(role) <= 0) return null;
  const oldLevels = target.roles.cache.filter((r) => LEVEL_NAMES.has(r.name) && r.id !== role.id);
  await target.roles.set([...target.roles.cache.filter((r) => !oldLevels.has(r.id)).keys(), role.id].filter((id) => id !== guild.id));
  return role;
}

// แจกยศให้สมาชิกที่ยังไม่มียศระดับใดเลย คืนจำนวนคนที่ได้ยศ
export async function assignMissingLevel(guild, level) {
  const role = guild.roles.cache.find((r) => r.name === ROLE_LEVELS.find((l) => l.level === level).name);
  const members = await guild.members.fetch();
  const missing = members.filter((m) => !m.user.bot && !m.roles.cache.some((r) => LEVEL_NAMES.has(r.name)));
  for (const member of missing.values()) await member.roles.add(role);
  return missing.size;
}
