// แปลงเหตุการณ์ในเซิร์ฟเวอร์เป็น Log: ประโยคสรุปหนึ่งบรรทัด รายการที่เปลี่ยน และการ์ดรูปเมื่อช่วยให้เห็นภาพ
import { AttachmentBuilder, AuditLogEvent as A, Events } from 'discord.js';
import { CARD_ACCENT } from './logger.js';
import { assignMissingLevel } from './roles.js';
import { channels } from './store.js';
import { renderChangeCard, renderWelcomeCard } from './ui/cards.js';
import { auditSentence, changeBullets, describeChanges, describeTarget, needsCard } from './ui/changes.js';
import { relative, thaiDuration } from './ui/time.js';

const LOG_KEYS = ['log-messages', 'log-members', 'log-server', 'log-voice', 'log-tickets'];
const NEW_ACCOUNT_MS = 7 * 24 * 60 * 60 * 1000;

// [หัวข้อ, ห้อง Log, สี]
const AUDIT_LABELS = {
  [A.GuildUpdate]: ['⚙️ แก้ไขการตั้งค่าเซิร์ฟเวอร์', 'log-server', 'warn'],
  [A.ChannelCreate]: ['➕ สร้างห้อง', 'log-server', 'good'],
  [A.ChannelUpdate]: ['✏️ แก้ไขห้อง', 'log-server', 'warn'],
  [A.ChannelDelete]: ['🗑️ ลบห้อง', 'log-server', 'bad'],
  [A.ChannelOverwriteCreate]: ['🔐 เพิ่มสิทธิ์ของห้อง', 'log-server', 'warn'],
  [A.ChannelOverwriteUpdate]: ['🔐 แก้ไขสิทธิ์ของห้อง', 'log-server', 'warn'],
  [A.ChannelOverwriteDelete]: ['🔐 ลบสิทธิ์ของห้อง', 'log-server', 'warn'],
  [A.RoleCreate]: ['➕ สร้างยศ', 'log-server', 'good'],
  [A.RoleUpdate]: ['✏️ แก้ไขยศ', 'log-server', 'warn'],
  [A.RoleDelete]: ['🗑️ ลบยศ', 'log-server', 'bad'],
  [A.EmojiCreate]: ['😀 เพิ่มอิโมจิ', 'log-server', 'good'],
  [A.EmojiUpdate]: ['😀 แก้ไขอิโมจิ', 'log-server', 'warn'],
  [A.EmojiDelete]: ['😀 ลบอิโมจิ', 'log-server', 'bad'],
  [A.StickerCreate]: ['🏷️ เพิ่มสติกเกอร์', 'log-server', 'good'],
  [A.StickerUpdate]: ['🏷️ แก้ไขสติกเกอร์', 'log-server', 'warn'],
  [A.StickerDelete]: ['🏷️ ลบสติกเกอร์', 'log-server', 'bad'],
  [A.WebhookCreate]: ['🪝 สร้าง Webhook', 'log-server', 'good'],
  [A.WebhookUpdate]: ['🪝 แก้ไข Webhook', 'log-server', 'warn'],
  [A.WebhookDelete]: ['🪝 ลบ Webhook', 'log-server', 'bad'],
  [A.InviteCreate]: ['🔗 สร้างลิงก์เชิญ', 'log-server', 'info'],
  [A.InviteDelete]: ['🔗 ลบลิงก์เชิญ', 'log-server', 'warn'],
  [A.BotAdd]: ['🤖 เพิ่มบอท', 'log-server', 'warn'],
  [A.MemberKick]: ['👢 เตะสมาชิก', 'log-members', 'bad'],
  [A.MemberBanAdd]: ['🔨 แบนสมาชิก', 'log-members', 'bad'],
  [A.MemberBanRemove]: ['🕊️ ปลดแบนสมาชิก', 'log-members', 'good'],
  [A.MemberUpdate]: ['✏️ แก้ไขสมาชิก', 'log-members', 'warn'],
  [A.MemberRoleUpdate]: ['🎭 เปลี่ยนยศสมาชิก', 'log-members', 'warn'],
};

const clip = (text, max = 1000) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const NOT_CACHED = '*(ข้อความเก่าเกินกว่าที่บอทจำได้)*';

// คนที่ทำ (User หรือ GuildMember) ในรูปแบบที่การ์ดใช้
const cardActor = (who) => who && { name: who.displayName ?? who.username, avatarURL: who.displayAvatarURL({ extension: 'png', size: 128 }) };

async function tryCard(card) {
  try {
    return await renderChangeCard(card);
  } catch (error) {
    console.error(`วาดการ์ดไม่สำเร็จ: ${error.message}`);
    return null;
  }
}

const joined = (...parts) => parts.filter(Boolean).join('\n\n');

export function registerLogEvents(client, { send, log }) {
  const isLogChannel = (id) => LOG_KEYS.some((key) => channels[key] === id);
  const skipMessage = (message) => !message.guild || message.author?.bot || isLogChannel(message.channelId);

  // เวลาเข้าห้องเสียงของแต่ละคน ใช้บอกว่าอยู่ในห้องนานเท่าไร
  const voiceJoins = new Map();

  client.on(Events.MessageUpdate, async (before, after) => {
    if (after.partial) after = await after.fetch().catch(() => null);
    if (!after || skipMessage(after) || !after.editedTimestamp || before.content === after.content) return;

    const author = after.member ?? after.author;
    const image = await tryCard({
      title: '✏️ แก้ไขข้อความ',
      accent: CARD_ACCENT.warn,
      actor: cardActor(author),
      target: `#${after.channel.name}`,
      rows: [{ label: 'ข้อความ', kind: 'text', long: true, before: before.partial ? 'ข้อความเก่าเกินกว่าที่บอทจำได้' : before.content, after: after.content }],
    });
    const fields = image ? [] : [
      { name: 'ก่อนแก้', value: before.partial ? NOT_CACHED : `>>> ${clip(before.content || '(ว่าง)')}` },
      { name: 'หลังแก้', value: `>>> ${clip(after.content || '(ว่าง)')}` },
    ];
    await log('log-messages', 'warn', '✏️ แก้ไขข้อความ',
      `${after.author} แก้ไขข้อความในห้อง ${after.channel}\n[ไปที่ข้อความ](${after.url})`,
      fields, { actor: author, image, footer: `ID ผู้เขียน ${after.author.id}` });
  });

  client.on(Events.MessageDelete, async (message) => {
    if (skipMessage(message)) return;
    const attachments = message.attachments?.map((a) => a.name).join(', ');
    const author = message.member ?? message.author;
    await log('log-messages', 'bad', '🗑️ ลบข้อความ',
      `ข้อความของ ${message.author ?? 'ผู้ใช้ที่ไม่ทราบชื่อ'} ในห้อง ${message.channel} ถูกลบ`,
      [
        { name: 'ข้อความที่ถูกลบ', value: message.partial ? NOT_CACHED : `>>> ${clip(message.content || '(ไม่มีข้อความ)')}` },
        ...(attachments ? [{ name: '📎 ไฟล์แนบ', value: clip(attachments) }] : []),
        ...(message.createdTimestamp ? [{ name: 'ส่งเมื่อ', value: relative(message.createdTimestamp), inline: true }] : []),
      ],
      { actor: author, footer: author ? `ID ผู้เขียน ${author.id}` : undefined });
  });

  client.on(Events.MessageBulkDelete, async (messages, channel) => {
    if (isLogChannel(channel.id)) return;
    await log('log-messages', 'bad', '🧹 ลบข้อความจำนวนมาก', `ข้อความ **${messages.size}** ข้อความในห้อง ${channel} ถูกลบพร้อมกัน`);
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    if (!member.user.bot) {
      await assignMissingLevel(member.guild, 1).catch((error) => console.error(`แจกยศไม่สำเร็จ: ${error.message}`));
    }
    const accountAge = Date.now() - member.user.createdTimestamp;
    await log('log-members', 'good', '📥 สมาชิกใหม่',
      `${member} เข้าร่วมเซิร์ฟเวอร์ เป็นสมาชิกคนที่ **${member.guild.memberCount}**`,
      [
        { name: 'สร้างบัญชีเมื่อ', value: relative(member.user.createdTimestamp), inline: true },
        ...(accountAge < NEW_ACCOUNT_MS ? [{ name: '⚠️ บัญชีใหม่', value: 'สร้างมาไม่ถึง 7 วัน ควรระวังสแปม', inline: true }] : []),
      ],
      { actor: member, thumbnail: member.displayAvatarURL({ size: 256 }), footer: `ID ${member.id}` });

    const guide = [channels.rules && `อ่านกฎที่ <#${channels.rules}>`, channels.products && `ดูสินค้าได้ที่ <#${channels.products}>`]
      .filter(Boolean)
      .join(' แล้ว');
    const content = `👋 ยินดีต้อนรับ ${member} สู่ **${member.guild.name}**!${guide ? ` ${guide}` : ''}`;
    try {
      const image = await renderWelcomeCard({
        name: member.displayName,
        avatarURL: member.displayAvatarURL({ extension: 'png', size: 256 }),
        guildName: member.guild.name,
        memberCount: member.guild.memberCount,
      });
      await send('welcome', { content, files: [new AttachmentBuilder(image, { name: 'welcome.png' })], allowedMentions: { users: [member.id] } });
    } catch (error) {
      console.error(`วาดการ์ดต้อนรับไม่สำเร็จ: ${error.message}`);
      await send('welcome', { content, allowedMentions: { users: [member.id] } });
    }
  });

  client.on(Events.GuildMemberRemove, (member) => {
    const stayed = member.joinedTimestamp ? ` หลังอยู่มา **${thaiDuration(Date.now() - member.joinedTimestamp)}**` : '';
    const roles = member.roles?.cache.filter((r) => r.id !== member.guild.id).map((r) => `${r}`).join(' ');
    return log('log-members', 'bad', '📤 สมาชิกออก',
      `${member.user} ออกจากเซิร์ฟเวอร์${stayed}`,
      roles ? [{ name: 'ยศที่มี', value: clip(roles) }] : [],
      { actor: member.user, thumbnail: member.user.displayAvatarURL({ size: 256 }), footer: `ID ${member.id}` });
  });

  client.on(Events.GuildMemberUpdate, async (before, after) => {
    if (!before.partial && !before.premiumSince && after.premiumSince) {
      await send('bot-notify', {
        content: `🚀 ${after} บูสต์เซิร์ฟเวอร์ ขอบคุณมาก!`,
        allowedMentions: { users: [after.id] },
      });
    }
  });

  client.on(Events.VoiceStateUpdate, async (before, after) => {
    if (before.channelId === after.channelId) return;
    const member = after.member ?? before.member;
    if (!member || member.user.bot) return;
    const options = { actor: member, footer: `ID ${member.id}` };
    const key = `${member.guild.id}:${member.id}`;

    if (!before.channelId) {
      voiceJoins.set(key, Date.now());
      return log('log-voice', 'good', '🔊 เข้าห้องเสียง', `${member} เข้าห้อง ${after.channel}`, [], options);
    }
    if (!after.channelId) {
      const since = voiceJoins.get(key);
      voiceJoins.delete(key);
      const stayed = since ? ` หลังอยู่ **${thaiDuration(Date.now() - since)}**` : '';
      return log('log-voice', 'bad', '🔇 ออกจากห้องเสียง', `${member} ออกจากห้อง ${before.channel}${stayed}`, [], options);
    }
    return log('log-voice', 'info', '🔀 ย้ายห้องเสียง', `${member} ย้ายจากห้อง ${before.channel} ไป ${after.channel}`, [], options);
  });

  // ข้อมูล "ใครทำ" มีเฉพาะใน Audit Log จึงใช้เหตุการณ์นี้เป็นตัวหลักของการเปลี่ยนแปลงเซิร์ฟเวอร์
  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    const label = AUDIT_LABELS[entry.action];
    if (!label || entry.executorId === client.user.id) return;
    const [title, key, color] = label;

    const executor = guild.members.cache.get(entry.executorId) ?? entry.executor ?? await client.users.fetch(entry.executorId).catch(() => null);
    const target = describeTarget(entry, guild);
    // การเปลี่ยนยศสมาชิกสรุปไว้ในประโยคแล้ว จึงไม่ต้องมีรายการซ้ำ
    const rows = entry.action === A.MemberRoleUpdate ? [] : describeChanges(entry, guild);

    const image = needsCard(rows)
      ? await tryCard({ title, accent: CARD_ACCENT[color], actor: cardActor(executor), target: target.name, rows })
      : null;
    const fields = entry.reason ? [{ name: '📝 เหตุผล', value: clip(entry.reason) }] : [];

    await log(key, color, title,
      joined(auditSentence(entry, `<@${entry.executorId}>`, target), changeBullets(rows)),
      fields,
      { actor: executor, thumbnail: target.thumbnail, image, footer: entry.targetId ? `ID ${entry.targetId}` : undefined });
  });
}
