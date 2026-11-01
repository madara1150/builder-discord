// บอทประจำเซิร์ฟเวอร์: เก็บ Log และแจ้งเตือน ต้องเปิดค้างไว้ถึงจะบันทึกเหตุการณ์ได้
import { readFileSync } from 'node:fs';
import {
  AuditLogEvent as A,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
} from 'discord.js';
import { commands } from './commands/index.js';
import { leaveIfAlone } from './music.js';
import { assignMissingLevel } from './roles.js';

const CHANNELS = JSON.parse(readFileSync(new URL('../channels.json', import.meta.url), 'utf8'));
const LOG_CHANNEL_IDS = new Set(
  ['log-messages', 'log-members', 'log-server', 'log-voice'].map((key) => CHANNELS[key]),
);

const COLOR = { info: 0x5865f2, good: 0x57f287, warn: 0xfee75c, bad: 0xed4245 };

const AUDIT_LABELS = {
  [A.GuildUpdate]: ['⚙️ แก้ไขการตั้งค่าเซิร์ฟเวอร์', 'server', 'warn'],
  [A.ChannelCreate]: ['➕ สร้างห้อง', 'server', 'good'],
  [A.ChannelUpdate]: ['✏️ แก้ไขห้อง', 'server', 'warn'],
  [A.ChannelDelete]: ['🗑️ ลบห้อง', 'server', 'bad'],
  [A.ChannelOverwriteCreate]: ['🔐 เพิ่มสิทธิ์ของห้อง', 'server', 'warn'],
  [A.ChannelOverwriteUpdate]: ['🔐 แก้ไขสิทธิ์ของห้อง', 'server', 'warn'],
  [A.ChannelOverwriteDelete]: ['🔐 ลบสิทธิ์ของห้อง', 'server', 'warn'],
  [A.RoleCreate]: ['➕ สร้างยศ', 'server', 'good'],
  [A.RoleUpdate]: ['✏️ แก้ไขยศ', 'server', 'warn'],
  [A.RoleDelete]: ['🗑️ ลบยศ', 'server', 'bad'],
  [A.EmojiCreate]: ['😀 เพิ่มอิโมจิ', 'server', 'good'],
  [A.EmojiUpdate]: ['😀 แก้ไขอิโมจิ', 'server', 'warn'],
  [A.EmojiDelete]: ['😀 ลบอิโมจิ', 'server', 'bad'],
  [A.StickerCreate]: ['🏷️ เพิ่มสติกเกอร์', 'server', 'good'],
  [A.StickerUpdate]: ['🏷️ แก้ไขสติกเกอร์', 'server', 'warn'],
  [A.StickerDelete]: ['🏷️ ลบสติกเกอร์', 'server', 'bad'],
  [A.WebhookCreate]: ['🪝 สร้าง Webhook', 'server', 'good'],
  [A.WebhookUpdate]: ['🪝 แก้ไข Webhook', 'server', 'warn'],
  [A.WebhookDelete]: ['🪝 ลบ Webhook', 'server', 'bad'],
  [A.InviteCreate]: ['🔗 สร้างลิงก์เชิญ', 'server', 'info'],
  [A.InviteDelete]: ['🔗 ลบลิงก์เชิญ', 'server', 'warn'],
  [A.BotAdd]: ['🤖 เพิ่มบอท', 'server', 'warn'],
  [A.MemberKick]: ['👢 เตะสมาชิก', 'members', 'bad'],
  [A.MemberBanAdd]: ['🔨 แบนสมาชิก', 'members', 'bad'],
  [A.MemberBanRemove]: ['🕊️ ปลดแบนสมาชิก', 'members', 'good'],
  [A.MemberUpdate]: ['✏️ แก้ไขสมาชิก', 'members', 'warn'],
  [A.MemberRoleUpdate]: ['🎭 เปลี่ยนยศสมาชิก', 'members', 'warn'],
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

const clip = (text, max = 1000) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const quote = (text) => (text ? clip(text) : '*(ไม่มีข้อความ)*');
const asJsonValue = (value) => clip(value === undefined || value === null ? '-' : typeof value === 'string' ? value : JSON.stringify(value), 300);

async function send(key, payload) {
  try {
    const channel = client.channels.cache.get(CHANNELS[key]) ?? await client.channels.fetch(CHANNELS[key]);
    await channel.send({ allowedMentions: { parse: [] }, ...payload });
  } catch (error) {
    console.error(`ส่งไปห้อง ${key} ไม่สำเร็จ: ${error.message}`);
  }
}

const log = (key, color, title, description, fields = []) =>
  send(key, {
    embeds: [new EmbedBuilder().setColor(COLOR[color]).setTitle(title).setDescription(description).addFields(fields).setTimestamp()],
  });

const skipMessage = (message) => !message.guild || message.author?.bot || LOG_CHANNEL_IDS.has(message.channelId);

client.on(Events.MessageUpdate, async (before, after) => {
  if (after.partial) after = await after.fetch().catch(() => null);
  if (!after || skipMessage(after) || !after.editedTimestamp || before.content === after.content) return;
  await log('log-messages', 'warn', '✏️ แก้ไขข้อความ', `${after.author} ใน ${after.channel} · [ไปที่ข้อความ](${after.url})`, [
    { name: 'ก่อนแก้', value: before.partial ? '*(ข้อความเก่าเกินกว่าที่บอทจำได้)*' : quote(before.content) },
    { name: 'หลังแก้', value: quote(after.content) },
  ]);
});

client.on(Events.MessageDelete, async (message) => {
  if (skipMessage(message)) return;
  const attachments = message.attachments?.map((a) => a.name).join(', ');
  await log(
    'log-messages',
    'bad',
    '🗑️ ลบข้อความ',
    `${message.author ?? 'ไม่ทราบผู้เขียน'} ใน ${message.channel}`,
    [
      { name: 'เนื้อหา', value: message.partial ? '*(ข้อความเก่าเกินกว่าที่บอทจำได้)*' : quote(message.content) },
      ...(attachments ? [{ name: 'ไฟล์แนบ', value: clip(attachments) }] : []),
    ],
  );
});

client.on(Events.MessageBulkDelete, async (messages, channel) => {
  if (LOG_CHANNEL_IDS.has(channel.id)) return;
  await log('log-messages', 'bad', '🧹 ลบข้อความจำนวนมาก', `${messages.size} ข้อความใน ${channel}`);
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (!member.user.bot) {
    await assignMissingLevel(member.guild, 1).catch((error) => console.error(`แจกยศไม่สำเร็จ: ${error.message}`));
  }
  await log('log-members', 'good', '📥 สมาชิกเข้าเซิร์ฟเวอร์', `${member} (${member.user.tag})`, [
    { name: 'สร้างบัญชีเมื่อ', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` },
  ]);
  await send('welcome', {
    content: `👋 ยินดีต้อนรับ ${member} สู่ **${member.guild.name}**! อ่านกฎที่ <#${CHANNELS.rules}> แล้วดูสินค้าได้ที่ <#${CHANNELS.products}>`,
    allowedMentions: { users: [member.id] },
  });
});

client.on(Events.GuildMemberRemove, (member) =>
  log('log-members', 'bad', '📤 สมาชิกออกจากเซิร์ฟเวอร์', `${member.user} (${member.user.tag})`),
);

client.on(Events.GuildMemberUpdate, async (before, after) => {
  if (!before.partial && !before.premiumSince && after.premiumSince) {
    await send('bot-notify', { content: `🚀 ${after} บูสต์เซิร์ฟเวอร์ ขอบคุณมาก!`, allowedMentions: { users: [after.id] } });
  }
});

client.on(Events.VoiceStateUpdate, async (before, after) => {
  if (before.channelId === after.channelId) return;
  leaveIfAlone(before.channel);
  const member = after.member ?? before.member;
  if (member?.user.bot) return;
  if (!before.channelId) return log('log-voice', 'good', '🔊 เข้าห้องเสียง', `${member} เข้า ${after.channel}`);
  if (!after.channelId) return log('log-voice', 'bad', '🔇 ออกจากห้องเสียง', `${member} ออกจาก ${before.channel}`);
  return log('log-voice', 'warn', '🔀 ย้ายห้องเสียง', `${member} จาก ${before.channel} ไป ${after.channel}`);
});

// ข้อมูล "ใครทำ" มีเฉพาะใน Audit Log จึงใช้เหตุการณ์นี้เป็นตัวหลักของการเปลี่ยนแปลงเซิร์ฟเวอร์
client.on(Events.GuildAuditLogEntryCreate, async (entry) => {
  const label = AUDIT_LABELS[entry.action];
  if (!label || entry.executorId === client.user.id) return;
  const [title, target, color] = label;

  const changes = entry.changes
    .slice(0, 8)
    .map((c) => `**${c.key}:** ${asJsonValue(c.old)} → ${asJsonValue(c.new)}`)
    .join('\n');
  const fields = [];
  if (changes) fields.push({ name: 'รายละเอียด', value: clip(changes) });
  if (entry.reason) fields.push({ name: 'เหตุผล', value: clip(entry.reason) });

  const targetName = entry.target?.name ?? entry.target?.tag ?? entry.target?.code;
  const description = `โดย <@${entry.executorId}>${entry.targetId ? ` · เป้าหมาย: ${targetName ?? entry.targetId}` : ''}`;
  await log(target === 'members' ? 'log-members' : 'log-server', color, title, description, fields);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await commands.get(interaction.commandName)?.execute(interaction, { log });
  } catch (error) {
    console.error(`คำสั่ง /${interaction.commandName} ผิดพลาด: ${error.message}`);
    const reply = { content: '❌ คำสั่งนี้ทำงานไม่สำเร็จ', flags: MessageFlags.Ephemeral };
    await (interaction.deferred || interaction.replied ? interaction.followUp(reply) : interaction.reply(reply)).catch(() => {});
  }
});

client.once(Events.ClientReady, async () => {
  console.log(`ออนไลน์แล้วในชื่อ ${client.user.tag}`);
  await send('bot-notify', { content: '🟢 บอทออนไลน์แล้ว' });
  // เก็บตกคนที่เข้ามาตอนบอทปิดอยู่
  const { guild } = await client.channels.fetch(CHANNELS.welcome);
  await guild.commands.set([...commands.values()].map((command) => command.data.toJSON()));
  await assignMissingLevel(guild, 1).catch((error) => console.error(`แจกยศไม่สำเร็จ: ${error.message}`));
});

async function shutdown() {
  await send('bot-notify', { content: '🔴 บอทปิดการทำงาน Log จะหยุดบันทึกจนกว่าจะเปิดใหม่' });
  await client.destroy();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
client.on(Events.Error, (error) => console.error(error));

client.login(process.env.DISCORD_TOKEN);
