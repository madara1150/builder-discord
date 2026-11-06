// บอทประจำเซิร์ฟเวอร์: เก็บ Log และแจ้งเตือน ต้องเปิดค้างไว้ถึงจะบันทึกเหตุการณ์ได้
import {
  AttachmentBuilder,
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
import { channels } from './store.js';
import { ensureTicketPanel, handleTicketInteraction } from './tickets.js';
import { renderChangeCard, renderWelcomeCard } from './ui/cards.js';
import { describeChanges, describeTarget, diffText } from './ui/changes.js';

const LOG_KEYS = ['log-messages', 'log-members', 'log-server', 'log-voice', 'log-tickets'];
const COLOR = { info: 0x5865f2, good: 0x57f287, warn: 0xfee75c, bad: 0xed4245 };
const CARD_ACCENT = { info: '#5865f2', good: '#57f287', warn: '#fee75c', bad: '#ed4245' };

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
const relative = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;
const NOT_CACHED = '*(ข้อความเก่าเกินกว่าที่บอทจำได้)*';

// คนที่ทำ (User หรือ GuildMember) ในรูปแบบที่การ์ดใช้
const cardActor = (who) => who && { name: who.displayName ?? who.username, avatarURL: who.displayAvatarURL({ extension: 'png', size: 128 }) };

async function send(key, payload) {
  try {
    const channel = client.channels.cache.get(channels[key]) ?? await client.channels.fetch(channels[key]);
    await channel.send({ allowedMentions: { parse: [] }, ...payload });
  } catch (error) {
    console.error(`ส่งไปห้อง ${key} ไม่สำเร็จ: ${error.message}`);
  }
}

// actor: ผู้กระทำ (แสดงที่หัว embed) · thumbnail: รูปเป้าหมาย · image: รูป PNG ที่แนบเป็นภาพหลัก · files: ไฟล์แนบอื่น
async function log(key, color, title, description, fields = [], { actor, thumbnail, image, footer, files: extraFiles = [] } = {}) {
  const embed = new EmbedBuilder()
    .setColor(COLOR[color])
    .setTitle(title)
    .setDescription(description || null)
    .addFields(fields)
    .setTimestamp();
  if (actor) embed.setAuthor({ name: actor.displayName ?? actor.username, iconURL: actor.displayAvatarURL() });
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (footer) embed.setFooter({ text: footer });

  const files = [...extraFiles];
  if (image) {
    files.push(new AttachmentBuilder(image, { name: 'log.png' }));
    embed.setImage('attachment://log.png');
  }
  await send(key, { embeds: [embed], files });
}

// วาดการ์ดไม่สำเร็จ (เช่น โหลดฟอนต์ไม่ได้) ให้ใช้ข้อความแบบ diff แทน
async function changeCardOrFields(rows, card) {
  if (!rows.length) return { fields: [] };
  try {
    return { fields: [], image: await renderChangeCard({ ...card, rows }) };
  } catch (error) {
    console.error(`วาดการ์ดไม่สำเร็จ: ${error.message}`);
    return { fields: rows.slice(0, 10).map((row) => ({ name: row.label, value: diffText(row) })) };
  }
}

const isLogChannel = (id) => LOG_KEYS.some((key) => channels[key] === id);
const skipMessage = (message) => !message.guild || message.author?.bot || isLogChannel(message.channelId);

client.on(Events.MessageUpdate, async (before, after) => {
  if (after.partial) after = await after.fetch().catch(() => null);
  if (!after || skipMessage(after) || !after.editedTimestamp || before.content === after.content) return;

  const rows = [{ label: 'ข้อความ', kind: 'text', long: true, before: before.partial ? 'ข้อความเก่าเกินกว่าที่บอทจำได้' : before.content, after: after.content }];
  const { fields, image } = await changeCardOrFields(rows, {
    title: '✏️ แก้ไขข้อความ',
    accent: CARD_ACCENT.warn,
    actor: cardActor(after.member ?? after.author),
    target: `#${after.channel.name}`,
  });
  await log('log-messages', 'warn', '✏️ แก้ไขข้อความ', `ใน ${after.channel} · [ไปที่ข้อความ](${after.url})`, fields, {
    actor: after.member ?? after.author,
    image,
    footer: `ผู้เขียน ID: ${after.author.id}`,
  });
});

client.on(Events.MessageDelete, async (message) => {
  if (skipMessage(message)) return;
  const attachments = message.attachments?.map((a) => a.name).join(', ');
  const author = message.member ?? message.author;
  await log(
    'log-messages',
    'bad',
    '🗑️ ลบข้อความ',
    `ข้อความ${author ? `ของ ${author}` : ''}ใน ${message.channel} ถูกลบ`,
    [
      { name: 'เนื้อหา', value: message.partial ? NOT_CACHED : `>>> ${quote(message.content)}` },
      ...(attachments ? [{ name: '📎 ไฟล์แนบ', value: clip(attachments) }] : []),
    ],
    { actor: author, footer: author ? `ผู้เขียน ID: ${author.id}` : undefined },
  );
});

client.on(Events.MessageBulkDelete, async (messages, channel) => {
  if (isLogChannel(channel.id)) return;
  await log('log-messages', 'bad', '🧹 ลบข้อความจำนวนมาก', `ลบ **${messages.size}** ข้อความใน ${channel}`);
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (!member.user.bot) {
    await assignMissingLevel(member.guild, 1).catch((error) => console.error(`แจกยศไม่สำเร็จ: ${error.message}`));
  }
  await log('log-members', 'good', '📥 สมาชิกเข้าเซิร์ฟเวอร์', `${member} เข้าร่วมเซิร์ฟเวอร์`, [
    { name: 'สร้างบัญชี', value: relative(member.user.createdTimestamp), inline: true },
    { name: 'สมาชิกคนที่', value: `${member.guild.memberCount}`, inline: true },
  ], { actor: member, thumbnail: member.displayAvatarURL({ size: 256 }), footer: `ID: ${member.id}` });

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

client.on(Events.GuildMemberRemove, (member) =>
  log('log-members', 'bad', '📤 สมาชิกออกจากเซิร์ฟเวอร์', `${member.user} ออกจากเซิร์ฟเวอร์`, [
    { name: 'อยู่มาตั้งแต่', value: member.joinedTimestamp ? relative(member.joinedTimestamp) : '-', inline: true },
    { name: 'ยศ', value: member.roles?.cache.filter((r) => r.id !== member.guild.id).map((r) => r.name).join(', ').slice(0, 1000) || '-', inline: true },
  ], { actor: member.user, thumbnail: member.user.displayAvatarURL({ size: 256 }), footer: `ID: ${member.id}` }),
);

client.on(Events.GuildMemberUpdate, async (before, after) => {
  if (!before.partial && !before.premiumSince && after.premiumSince) {
    await send('bot-notify', {
      embeds: [new EmbedBuilder()
        .setColor(0xf47fff)
        .setTitle('🚀 มีคนบูสต์เซิร์ฟเวอร์!')
        .setDescription(`ขอบคุณ ${after} มากที่ช่วยบูสต์`)
        .setThumbnail(after.displayAvatarURL({ size: 256 }))
        .setTimestamp()],
      allowedMentions: { users: [after.id] },
    });
  }
});

client.on(Events.VoiceStateUpdate, async (before, after) => {
  if (before.channelId === after.channelId) return;
  leaveIfAlone(before.channel);
  const member = after.member ?? before.member;
  if (member?.user.bot) return;
  const options = { actor: member, footer: `ID: ${member?.id}` };
  if (!before.channelId) return log('log-voice', 'good', '🔊 เข้าห้องเสียง', `${member} เข้า ${after.channel}`, [], options);
  if (!after.channelId) return log('log-voice', 'bad', '🔇 ออกจากห้องเสียง', `${member} ออกจาก ${before.channel}`, [], options);
  return log('log-voice', 'info', '🔀 ย้ายห้องเสียง', `${member} ย้ายจาก ${before.channel} ไป ${after.channel}`, [], options);
});

// ข้อมูล "ใครทำ" มีเฉพาะใน Audit Log จึงใช้เหตุการณ์นี้เป็นตัวหลักของการเปลี่ยนแปลงเซิร์ฟเวอร์
client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
  const label = AUDIT_LABELS[entry.action];
  if (!label || entry.executorId === client.user.id) return;
  const [title, destination, color] = label;

  const executor = entry.executor ?? await client.users.fetch(entry.executorId).catch(() => null);
  const executorMember = guild.members.cache.get(entry.executorId) ?? executor;
  const target = describeTarget(entry, guild);
  const rows = describeChanges(entry, guild);

  const { fields, image } = await changeCardOrFields(rows, {
    title,
    accent: CARD_ACCENT[color],
    actor: cardActor(executorMember),
    target: target.name,
  });
  if (entry.reason) fields.push({ name: '📝 เหตุผล', value: clip(entry.reason) });

  await log(destination === 'members' ? 'log-members' : 'log-server', color, title, `เป้าหมาย: ${target.mention}`, fields, {
    actor: executorMember,
    thumbnail: target.thumbnail,
    image,
    footer: entry.targetId ? `ID: ${entry.targetId}` : undefined,
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  const isTicket = interaction.customId?.startsWith('ticket:');
  if (!interaction.isChatInputCommand() && !isTicket) return;
  try {
    if (isTicket) await handleTicketInteraction(interaction, { log });
    else await commands.get(interaction.commandName)?.execute(interaction, { log });
  } catch (error) {
    console.error(`${isTicket ? interaction.customId : `/${interaction.commandName}`} ผิดพลาด: ${error.message}`);
    const reply = { content: '❌ คำสั่งนี้ทำงานไม่สำเร็จ', flags: MessageFlags.Ephemeral };
    await (interaction.deferred || interaction.replied ? interaction.followUp(reply) : interaction.reply(reply)).catch(() => {});
  }
});

const statusEmbed = (online) =>
  new EmbedBuilder()
    .setColor(online ? COLOR.good : COLOR.bad)
    .setTitle(online ? '🟢 บอทออนไลน์แล้ว' : '🔴 บอทปิดการทำงาน')
    .setDescription(online ? `พร้อมใช้งาน ${commands.size} คำสั่ง พิมพ์ \`/help\` เพื่อดูทั้งหมด` : 'Log จะหยุดบันทึกจนกว่าจะเปิดใหม่')
    .setTimestamp();

client.once(Events.ClientReady, async () => {
  console.log(`ออนไลน์แล้วในชื่อ ${client.user.tag}`);
  await send('bot-notify', { embeds: [statusEmbed(true)] });
  const { guild } = await client.channels.fetch(channels.welcome);
  await guild.commands.set([...commands.values()].map((command) => command.data.toJSON()));
  await ensureTicketPanel(client).catch((error) => console.error(`โพสต์แผงทิกเก็ตไม่สำเร็จ: ${error.message}`));
  // เก็บตกคนที่เข้ามาตอนบอทปิดอยู่
  await assignMissingLevel(guild, 1).catch((error) => console.error(`แจกยศไม่สำเร็จ: ${error.message}`));
});

async function shutdown() {
  await send('bot-notify', { embeds: [statusEmbed(false)] });
  await client.destroy();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
client.on(Events.Error, (error) => console.error(error));

client.login(process.env.DISCORD_TOKEN);
