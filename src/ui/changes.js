// แปลงรายการเปลี่ยนแปลงจาก Audit Log ให้เป็นภาษาไทยที่อ่านง่าย
import { AuditLogEvent as A, PermissionsBitField } from 'discord.js';
import { colorHex, thaiTime } from './cards.js';

// ค่าของ entry.targetType ใน discord.js (ไม่ได้ export เป็น enum)
const Target = { User: 'User', Channel: 'Channel', Thread: 'Thread', Role: 'Role', Guild: 'Guild', Emoji: 'Emoji' };

const PERMISSION_NAMES = {
  Administrator: 'ผู้ดูแลระบบ',
  ViewChannel: 'ดูห้อง',
  SendMessages: 'ส่งข้อความ',
  ReadMessageHistory: 'อ่านข้อความเก่า',
  AddReactions: 'กดรีแอคชัน',
  Connect: 'เข้าห้องเสียง',
  Speak: 'พูด',
  UseVAD: 'ตรวจจับเสียงอัตโนมัติ',
  UseApplicationCommands: 'ใช้คำสั่งแอป',
  EmbedLinks: 'ฝังลิงก์',
  AttachFiles: 'แนบไฟล์',
  ChangeNickname: 'เปลี่ยนชื่อเล่น',
  Stream: 'สตรีม',
  UseExternalEmojis: 'อิโมจินอกเซิร์ฟเวอร์',
  UseExternalStickers: 'สติกเกอร์นอกเซิร์ฟเวอร์',
  UseExternalSounds: 'เสียงนอกเซิร์ฟเวอร์',
  SendMessagesInThreads: 'ส่งข้อความในเธรด',
  CreatePublicThreads: 'สร้างเธรดสาธารณะ',
  CreatePrivateThreads: 'สร้างเธรดส่วนตัว',
  CreateInstantInvite: 'สร้างลิงก์เชิญ',
  SendVoiceMessages: 'ส่งข้อความเสียง',
  SendTTSMessages: 'ส่งข้อความอ่านออกเสียง',
  SendPolls: 'สร้างโพล',
  UseSoundboard: 'ซาวด์บอร์ด',
  UseEmbeddedActivities: 'ใช้กิจกรรม',
  UseExternalApps: 'ใช้แอปภายนอก',
  PrioritySpeaker: 'ผู้พูดลำดับแรก',
  RequestToSpeak: 'ขอพูด',
  ManageMessages: 'จัดการข้อความ',
  PinMessages: 'ปักหมุดข้อความ',
  BypassSlowmode: 'ข้ามโหมดช้า',
  ManageThreads: 'จัดการเธรด',
  ModerateMembers: 'หมดเวลาสมาชิก',
  ManageNicknames: 'จัดการชื่อเล่น',
  KickMembers: 'เตะสมาชิก',
  BanMembers: 'แบนสมาชิก',
  MuteMembers: 'ปิดเสียงสมาชิก',
  DeafenMembers: 'ปิดการได้ยินสมาชิก',
  MoveMembers: 'ย้ายสมาชิก',
  ViewAuditLog: 'ดูบันทึกการตรวจสอบ',
  ViewGuildInsights: 'ดูสถิติเซิร์ฟเวอร์',
  MentionEveryone: 'แท็กทุกคน',
  ManageGuildExpressions: 'จัดการอิโมจิและสติกเกอร์',
  CreateGuildExpressions: 'สร้างอิโมจิและสติกเกอร์',
  ManageEvents: 'จัดการกิจกรรม',
  CreateEvents: 'สร้างกิจกรรม',
  ManageChannels: 'จัดการห้อง',
  ManageWebhooks: 'จัดการ Webhook',
  ManageRoles: 'จัดการยศ',
  ManageGuild: 'จัดการเซิร์ฟเวอร์',
  SetVoiceChannelStatus: 'ตั้งสถานะห้องเสียง',
};

const LABELS = {
  name: 'ชื่อ',
  topic: 'คำอธิบายห้อง',
  nsfw: 'ห้อง 18+',
  rate_limit_per_user: 'โหมดช้า',
  bitrate: 'คุณภาพเสียง',
  user_limit: 'จำกัดจำนวนคน',
  parent_id: 'หมวดหมู่',
  position: 'ลำดับ',
  permissions: 'สิทธิ์',
  allow: 'สิทธิ์ที่อนุญาต',
  deny: 'สิทธิ์ที่ห้าม',
  color: 'สี',
  colors: 'สี',
  hoist: 'แสดงแยกในรายชื่อ',
  mentionable: 'แท็กได้',
  nick: 'ชื่อเล่น',
  communication_disabled_until: 'หมดเวลาถึง',
  deaf: 'ปิดการได้ยิน',
  mute: 'ปิดเสียง',
  icon_hash: 'ไอคอน',
  banner_hash: 'แบนเนอร์',
  splash_hash: 'ภาพหน้าเชิญ',
  avatar_hash: 'รูปโปรไฟล์ในเซิร์ฟเวอร์',
  description: 'คำอธิบาย',
  verification_level: 'ระดับการยืนยันตัวตน',
  explicit_content_filter: 'ตัวกรองเนื้อหา',
  default_message_notifications: 'การแจ้งเตือนเริ่มต้น',
  system_channel_id: 'ห้องข้อความระบบ',
  rules_channel_id: 'ห้องกฎ',
  public_updates_channel_id: 'ห้องอัปเดตชุมชน',
  afk_channel_id: 'ห้อง AFK',
  afk_timeout: 'เวลา AFK',
  vanity_url_code: 'ลิงก์เชิญถาวร',
  preferred_locale: 'ภาษาหลัก',
  mfa_level: 'บังคับ 2FA ผู้ดูแล',
  code: 'รหัสลิงก์เชิญ',
  channel_id: 'ห้อง',
  max_uses: 'ใช้ได้สูงสุด',
  max_age: 'อายุลิงก์',
  temporary: 'สมาชิกชั่วคราว',
  rtc_region: 'ภูมิภาคเสียง',
  video_quality_mode: 'คุณภาพวิดีโอ',
  default_auto_archive_duration: 'เก็บเธรดอัตโนมัติ',
  tags: 'แท็ก',
  $add: 'เพิ่มยศ',
  $remove: 'ถอดยศ',
};

// ค่าที่ไม่มีประโยชน์ต่อคนอ่าน
const SKIPPED = new Set(['id', 'type', 'permission_overwrites', 'flags', 'available', 'guild_id', 'inviter_id', 'uses', 'application_id', 'avatar_decoration_data', 'unicode_emoji', 'icon_emoji']);

const yesNo = (value) => (value ? 'เปิด' : 'ปิด');

function permissionNames(bits) {
  return new PermissionsBitField(BigInt(bits ?? 0)).toArray().map((name) => PERMISSION_NAMES[name] ?? name);
}

function permissionRow(label, before, after) {
  const old = new Set(permissionNames(before));
  const next = new Set(permissionNames(after));
  const removed = [...old].filter((name) => !next.has(name));
  const added = [...next].filter((name) => !old.has(name));
  return {
    label,
    kind: 'perm',
    before: removed.length ? `ถอน: ${removed.join(', ')}` : before === undefined ? null : '—',
    after: added.length ? `เพิ่ม: ${added.join(', ')}` : after === undefined ? null : '—',
  };
}

function colorValue(value) {
  if (value === undefined || value === null) return null;
  const primary = typeof value === 'object' ? value.primary_color : value;
  // 0 คือไม่ได้ตั้งสี Discord จะแสดงเป็นสีเทาเริ่มต้น
  return primary ? colorHex(primary) : '#99aab5';
}

function imageUrl(key, hash, entry, guild) {
  if (!hash) return null;
  const extension = hash.startsWith('a_') ? 'gif' : 'png';
  const id = entry.targetId;
  switch (key) {
    case 'icon_hash':
      return entry.targetType === Target.Role
        ? `https://cdn.discordapp.com/role-icons/${id}/${hash}.png?size=128`
        : `https://cdn.discordapp.com/icons/${guild.id}/${hash}.${extension}?size=128`;
    case 'banner_hash':
      return `https://cdn.discordapp.com/banners/${guild.id}/${hash}.png?size=256`;
    case 'splash_hash':
      return `https://cdn.discordapp.com/splashes/${guild.id}/${hash}.png?size=256`;
    case 'avatar_hash':
      return `https://cdn.discordapp.com/guilds/${guild.id}/users/${id}/avatars/${hash}.${extension}?size=128`;
    default:
      return null;
  }
}

function formatValue(key, value, guild) {
  if (value === undefined) return null;
  if (value === null || value === '') return key === 'topic' || key === 'nick' ? '' : 'ไม่มี';
  if (typeof value === 'boolean') return yesNo(value);
  switch (key) {
    case 'parent_id':
    case 'channel_id':
    case 'system_channel_id':
    case 'rules_channel_id':
    case 'public_updates_channel_id':
    case 'afk_channel_id':
      return `#${guild.channels.cache.get(value)?.name ?? value}`;
    case 'rate_limit_per_user':
      return value ? `${value} วินาที` : 'ปิด';
    case 'user_limit':
    case 'max_uses':
      return value ? `${value}` : 'ไม่จำกัด';
    case 'bitrate':
      return `${Math.round(value / 1000)} kbps`;
    case 'afk_timeout':
    case 'max_age':
      return value ? `${Math.round(value / 60)} นาที` : 'ไม่หมดอายุ';
    case 'communication_disabled_until':
      return thaiTime(new Date(value));
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

// คืนรายการ { label, kind, before, after } สำหรับการ์ดและข้อความสำรอง
export function describeChanges(entry, guild) {
  const rows = [];
  // ยศรุ่นใหม่ส่งทั้ง color และ colors ซึ่งเป็นค่าเดียวกัน
  const hasColors = entry.changes.some((change) => change.key === 'colors');
  for (const change of entry.changes) {
    const { key } = change;
    if (SKIPPED.has(key) || (key === 'color' && hasColors)) continue;
    const label = LABELS[key] ?? key;

    if (key === 'permissions' || key === 'allow' || key === 'deny') {
      rows.push(permissionRow(label, change.old, change.new));
    } else if (key === 'color' || key === 'colors') {
      rows.push({ label, kind: 'color', before: colorValue(change.old), after: colorValue(change.new) });
    } else if (key.endsWith('_hash')) {
      const before = imageUrl(key, change.old, entry, guild);
      const after = imageUrl(key, change.new, entry, guild);
      rows.push({ label, kind: 'image', before: change.old === undefined ? null : before, after: change.new === undefined ? null : after });
    } else if (key === '$add' || key === '$remove') {
      const names = (change.new ?? []).map((role) => `@${role.name}`).join(', ');
      rows.push({ label, kind: 'text', before: null, after: names || '—' });
    } else {
      rows.push({ label, kind: 'text', before: formatValue(key, change.old, guild), after: formatValue(key, change.new, guild) });
    }
  }
  return rows.filter((row) => row.before !== null || row.after !== null);
}

// ชื่อ ลิงก์ และรูปของเป้าหมายใน Audit Log
// forWho คือยศหรือสมาชิกที่ถูกตั้งสิทธิ์ (มีเฉพาะการแก้สิทธิ์ของห้อง)
export function describeTarget(entry, guild) {
  const { target, targetId, extra } = entry;
  const deletedName = entry.changes.find((c) => c.key === 'name')?.old;

  switch (entry.targetType) {
    case Target.User:
      return {
        name: target?.displayName ?? target?.username ?? targetId,
        mention: `<@${targetId}>`,
        thumbnail: target?.displayAvatarURL?.({ size: 256 }),
      };
    case Target.Channel:
    case Target.Thread: {
      const channel = guild.channels.cache.get(targetId);
      const name = channel?.name ?? target?.name ?? deletedName ?? targetId;
      let forWho = null;
      if (extra?.id) {
        if (extra.id === guild.id) forWho = '@everyone';
        else forWho = guild.roles.cache.has(extra.id) ? `<@&${extra.id}>` : `<@${extra.id}>`;
      }
      const forWhoName = extra?.name ?? extra?.user?.username ?? extra?.displayName;
      return {
        name: `#${name}${forWhoName ? ` · สำหรับ ${forWhoName}` : ''}`,
        mention: channel ? `<#${targetId}>` : `**#${name}**`,
        forWho,
      };
    }
    case Target.Role: {
      const role = guild.roles.cache.get(targetId);
      const name = role?.name ?? target?.name ?? deletedName ?? targetId;
      const label = name.startsWith('@') ? name : `@${name}`;
      return { name: label, mention: role && role.id !== guild.id ? `<@&${targetId}>` : `**${label}**`, thumbnail: role?.iconURL?.() };
    }
    case Target.Guild:
      return { name: guild.name, mention: `**${guild.name}**`, thumbnail: guild.iconURL({ size: 256 }) };
    case Target.Emoji: {
      const name = `:${target?.name ?? deletedName ?? targetId}:`;
      return { name, mention: `**${name}**`, thumbnail: `https://cdn.discordapp.com/emojis/${targetId}.png` };
    }
    default: {
      const name = target?.name ?? target?.code ?? deletedName ?? targetId ?? '-';
      return { name, mention: `**${name}**` };
    }
  }
}

const roleMentions = (entry, key) =>
  (entry.changes.find((c) => c.key === key)?.new ?? []).map((role) => `<@&${role.id}>`).join(' ');

// ประโยคสรุปว่า "ใครทำอะไรกับอะไร" สำหรับบรรทัดแรกของ Log
export function auditSentence(entry, actor, target) {
  const t = target.mention;
  const forWho = target.forWho ? `ของ ${target.forWho} ` : '';
  const self = entry.executorId === entry.targetId;
  const changed = (key) => entry.changes.find((c) => c.key === key);

  switch (entry.action) {
    case A.GuildUpdate: return `${actor} แก้ไขการตั้งค่าเซิร์ฟเวอร์`;
    case A.ChannelCreate: return `${actor} สร้างห้อง ${t}`;
    case A.ChannelUpdate: return `${actor} แก้ไขห้อง ${t}`;
    case A.ChannelDelete: return `${actor} ลบห้อง ${t}`;
    case A.ChannelOverwriteCreate: return `${actor} เพิ่มสิทธิ์${forWho}ในห้อง ${t}`;
    case A.ChannelOverwriteUpdate: return `${actor} แก้สิทธิ์${forWho}ในห้อง ${t}`;
    case A.ChannelOverwriteDelete: return `${actor} ลบสิทธิ์${forWho}ในห้อง ${t}`;
    case A.RoleCreate: return `${actor} สร้างยศ ${t}`;
    case A.RoleUpdate: return `${actor} แก้ไขยศ ${t}`;
    case A.RoleDelete: return `${actor} ลบยศ ${t}`;
    case A.EmojiCreate: return `${actor} เพิ่มอิโมจิ ${t}`;
    case A.EmojiUpdate: return `${actor} แก้ไขอิโมจิ ${t}`;
    case A.EmojiDelete: return `${actor} ลบอิโมจิ ${t}`;
    case A.StickerCreate: return `${actor} เพิ่มสติกเกอร์ ${t}`;
    case A.StickerUpdate: return `${actor} แก้ไขสติกเกอร์ ${t}`;
    case A.StickerDelete: return `${actor} ลบสติกเกอร์ ${t}`;
    case A.WebhookCreate: return `${actor} สร้าง Webhook ${t}`;
    case A.WebhookUpdate: return `${actor} แก้ไข Webhook ${t}`;
    case A.WebhookDelete: return `${actor} ลบ Webhook ${t}`;
    case A.InviteCreate: return `${actor} สร้างลิงก์เชิญ ${t}`;
    case A.InviteDelete: return `${actor} ลบลิงก์เชิญ ${t}`;
    case A.BotAdd: return `${actor} เพิ่มบอท ${t} เข้าเซิร์ฟเวอร์`;
    case A.MemberKick: return `${actor} เตะ ${t} ออกจากเซิร์ฟเวอร์`;
    case A.MemberBanAdd: return `${actor} แบน ${t}`;
    case A.MemberBanRemove: return `${actor} ปลดแบน ${t}`;
    case A.MemberRoleUpdate: {
      const added = roleMentions(entry, '$add');
      const removed = roleMentions(entry, '$remove');
      const parts = [added && `ให้ยศ ${added} แก่ ${t}`, removed && `ถอดยศ ${removed} ของ ${t}`].filter(Boolean);
      return `${actor} ${parts.join(' และ') || `เปลี่ยนยศของ ${t}`}`;
    }
    case A.MemberUpdate: {
      if (changed('nick')) return self ? `${t} เปลี่ยนชื่อเล่นของตัวเอง` : `${actor} เปลี่ยนชื่อเล่นของ ${t}`;
      const timeout = changed('communication_disabled_until');
      if (timeout) return timeout.new ? `${actor} สั่งหมดเวลา ${t}` : `${actor} ยกเลิกการหมดเวลาของ ${t}`;
      if (changed('mute')) return `${actor} ${changed('mute').new ? 'ปิดเสียง' : 'เปิดเสียง'} ${t} ในห้องเสียง`;
      if (changed('deaf')) return `${actor} ${changed('deaf').new ? 'ปิดการได้ยินของ' : 'เปิดการได้ยินให้'} ${t}`;
      return `${actor} แก้ไขข้อมูลของ ${t}`;
    }
    default: return `${actor} ทำรายการกับ ${t}`;
  }
}

const shortValue = (value, max = 80) => {
  const text = String(value).replaceAll('`', "'").replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

// รายการเปลี่ยนแปลงแบบสั้นสำหรับใต้ประโยคสรุป
export function changeBullets(rows, max = 6) {
  const value = (v) => (v === '' ? '*(ว่าง)*' : `\`${shortValue(v)}\``);
  const lines = rows.slice(0, max).map((row) => {
    const label = `**${row.label}**`;
    if (row.kind === 'image') return `• ${label}: เปลี่ยนรูป ดูภาพด้านล่าง`;
    if (row.kind === 'perm') {
      const parts = [row.after, row.before].filter((part) => part && part !== '—').map((part) => shortValue(part, 300));
      return `• ${label}: ${parts.join(' · ') || 'ไม่มีการเปลี่ยนแปลง'}`;
    }
    if (row.before == null) return `• ${label}: ${value(row.after)}`;
    if (row.after == null) return `• ${label}: ~~${shortValue(row.before)}~~`;
    return `• ${label}: ${value(row.before)} → ${value(row.after)}`;
  });
  if (rows.length > max) lines.push(`• และอีก ${rows.length - max} รายการ`);
  return lines.join('\n');
}

// ใช้การ์ดรูปเฉพาะเมื่อรูปช่วยให้เข้าใจกว่าข้อความ เช่น สี รูป สิทธิ์ หรือข้อความยาว
export function needsCard(rows) {
  return rows.length > 4 || rows.some((row) =>
    row.kind !== 'text' || String(row.before ?? '').length > 60 || String(row.after ?? '').length > 60);
}
