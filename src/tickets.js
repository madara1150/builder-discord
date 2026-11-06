// ระบบทิกเก็ต: เปิดห้องคุยส่วนตัวกับทีมงาน รับเรื่อง และปิดพร้อมเก็บประวัติแชท
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits as P,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { staffRoleIds } from './builder.js';
import { ROLE_LEVELS } from './layout.js';
import { channels, saveTickets, tickets } from './store.js';
import { renderTicketBanner } from './ui/cards.js';
import { renderTranscript } from './ui/transcript.js';

// หัวข้อในเมนูเปิดทิกเก็ต แก้หรือเพิ่มได้ (id ห้ามมีช่องว่าง)
export const TICKET_TYPES = [
  { id: 'order', emoji: '🛒', label: 'สั่งซื้อสินค้า', description: 'สั่งซื้อ สอบถามราคา หรือจองสินค้า' },
  { id: 'payment', emoji: '💳', label: 'แจ้งชำระเงิน', description: 'ส่งสลิปหรือยืนยันการโอนเงิน' },
  { id: 'problem', emoji: '🛠️', label: 'แจ้งปัญหา', description: 'สินค้ามีปัญหา หรือแจ้งปัญหาในเซิร์ฟเวอร์' },
  { id: 'other', emoji: '💬', label: 'เรื่องอื่นๆ', description: 'คุยเรื่องอื่นกับทีมงาน' },
];

// ยศที่ถูกแท็กเมื่อมีทิกเก็ตใหม่
const PING_LEVEL = 5;
const CLOSE_DELAY_MS = 5000;
const TRANSCRIPT_LIMIT = 1000;
const COLOR = { info: 0x5865f2, good: 0x57f287, warn: 0xfee75c, bad: 0xed4245 };
const MEMBER_ALLOW = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks];

// เจ้าของและหัวข้อของทิกเก็ตเก็บไว้ท้ายคำอธิบายห้อง จึงยังรู้ได้หลังบอทรีสตาร์ต
const MARKER = /\[ticket:(\d+):([\w-]+)\]/;
const findType = (id) => TICKET_TYPES.find((type) => type.id === id) ?? TICKET_TYPES.at(-1);

export function ticketInfo(channel) {
  const match = channel?.topic?.match(MARKER);
  return match && { ownerId: match[1], type: findType(match[2]) };
}

const isStaff = (member) => member.id === member.guild.ownerId || member.permissions.has(P.ManageMessages);
const relative = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;

function duration(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return [days && `${days} วัน`, hours && `${hours} ชม.`, `${minutes % 60} นาที`].filter(Boolean).join(' ');
}

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20) || 'user';

// รวม overwrite ที่ id ซ้ำ (เช่น บอทเปิดทิกเก็ตเอง) เพราะ Discord ไม่รับ id ซ้ำ
function mergeOverwrites(list) {
  const merged = new Map();
  for (const { id, allow = [] } of list) merged.set(id, { id, allow: [...new Set([...(merged.get(id)?.allow ?? []), ...allow])] });
  return [...merged.values()];
}

// ---------- แผงเปิดทิกเก็ต ----------

function panelPayload(guild) {
  const banner = renderTicketBanner({ guildName: guild.name });
  const embed = new EmbedBuilder()
    .setColor(COLOR.info)
    .setTitle('🎫 ติดต่อทีมงาน')
    .setDescription([
      'เลือกหัวข้อจากเมนูด้านล่าง บอทจะสร้างห้องส่วนตัวที่เห็นแค่คุณกับทีมงาน',
      '',
      ...TICKET_TYPES.map((type) => `${type.emoji} **${type.label}** — ${type.description}`),
      '',
      '> 🔐 ส่งสลิปหรือข้อมูลส่วนตัวในทิกเก็ตเท่านั้น ห้ามส่งในห้องสาธารณะ',
    ].join('\n'))
    .setImage('attachment://ticket-banner.png')
    .setFooter({ text: 'เปิดได้คนละ 1 ทิกเก็ตในเวลาเดียวกัน' });
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket:open')
    .setPlaceholder('🎫 เลือกหัวข้อที่ต้องการติดต่อ')
    .addOptions(TICKET_TYPES.map((type) => ({ label: type.label, description: type.description, value: type.id, emoji: type.emoji })));
  return {
    embeds: [embed],
    files: [new AttachmentBuilder(banner, { name: 'ticket-banner.png' })],
    components: [new ActionRowBuilder().addComponents(menu)],
  };
}

// โพสต์แผงในห้อง 🎫・เปิดทิกเก็ต หรือแก้แผงเดิมถ้ามีอยู่แล้ว คืน false ถ้ายังไม่มีห้องนี้
export async function ensureTicketPanel(client) {
  const channel = channels['ticket-panel'] && await client.channels.fetch(channels['ticket-panel']).catch(() => null);
  if (!channel) return false;
  const recent = await channel.messages.fetch({ limit: 20 });
  const existing = recent.find((message) =>
    message.author.id === client.user.id &&
    message.components.some((row) => row.components?.some((component) => component.customId === 'ticket:open')));
  const payload = panelPayload(channel.guild);
  if (existing) await existing.edit({ ...payload, attachments: [] });
  else await channel.send(payload);
  return true;
}

// ---------- เปิด รับเรื่อง ปิด ----------

function ticketButtons(claimed = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:claim').setLabel(claimed ? 'รับเรื่องแล้ว' : 'รับเรื่อง').setEmoji('🙋').setStyle(ButtonStyle.Primary).setDisabled(claimed),
    new ButtonBuilder().setCustomId('ticket:close').setLabel('ปิดทิกเก็ต').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  );
}

export async function openTicket(member, type, details, { log }) {
  const { guild } = member;
  const existing = guild.channels.cache.find((channel) => ticketInfo(channel)?.ownerId === member.id);
  if (existing) return { existing };

  const parent = guild.channels.cache.get(channels['cat-tickets']);
  if (!parent) throw new Error('ยังไม่มีหมวดทิกเก็ต ให้ใช้ /template apply ก่อน');

  const number = tickets.next++;
  saveTickets();
  const label = `#${String(number).padStart(4, '0')}`;

  const channel = await guild.channels.create({
    name: `🎫・${String(number).padStart(4, '0')}-${slug(member.user.username)}`,
    type: ChannelType.GuildText,
    parent,
    topic: `${type.emoji} ${type.label} · ทิกเก็ตของ ${member.user.username} [ticket:${member.id}:${type.id}]`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
      ...mergeOverwrites([
        { id: member.id, allow: MEMBER_ALLOW },
        ...staffRoleIds(guild).map((id) => ({ id, allow: MEMBER_ALLOW })),
        { id: guild.members.me.id, allow: [...MEMBER_ALLOW, P.ManageChannels] },
      ]),
    ],
  });

  const embed = new EmbedBuilder()
    .setColor(COLOR.info)
    .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
    .setTitle(`${type.emoji} ${type.label}`)
    .setDescription('ทีมงานจะตอบกลับโดยเร็วที่สุด ระหว่างนี้พิมพ์รายละเอียดหรือแนบรูปเพิ่มได้เลย')
    .setThumbnail(member.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'ผู้เปิด', value: `${member}`, inline: true },
      { name: 'สถานะ', value: '🟢 รอทีมงานรับเรื่อง', inline: true },
      ...(details ? [{ name: 'รายละเอียด', value: `>>> ${details}` }] : []),
    )
    .setFooter({ text: `ทิกเก็ต ${label}` })
    .setTimestamp();

  const pingRole = guild.roles.cache.find((role) => role.name === ROLE_LEVELS.find((l) => l.level === PING_LEVEL).name);
  await channel.send({
    content: [member, pingRole].filter(Boolean).join(' '),
    embeds: [embed],
    components: [ticketButtons()],
    allowedMentions: { users: [member.id], roles: pingRole ? [pingRole.id] : [] },
  });

  await log('log-tickets', 'good', '🎫 เปิดทิกเก็ต', `${channel} · ${type.emoji} ${type.label}`, [
    ...(details ? [{ name: 'รายละเอียด', value: details.slice(0, 1000) }] : []),
  ], { actor: member, thumbnail: member.displayAvatarURL({ size: 256 }), footer: `ทิกเก็ต ${label} · ID: ${member.id}` });

  return { channel };
}

async function fetchMessages(channel) {
  const all = [];
  let before;
  while (all.length < TRANSCRIPT_LIMIT) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
  }
  return all.reverse();
}

export async function closeTicket(channel, closer, reason, { log }) {
  const info = ticketInfo(channel);
  const messages = await fetchMessages(channel);
  const welcome = messages.find((m) => m.author.id === channel.client.user.id && m.embeds[0]?.footer?.text?.startsWith('ทิกเก็ต #'));
  const label = welcome?.embeds[0]?.footer?.text.replace('ทิกเก็ต ', '') ?? channel.name;
  const claimerId = welcome?.embeds[0]?.fields.find((f) => f.name === 'สถานะ')?.value.match(/<@!?(\d+)>/)?.[1];
  const humanMessages = messages.filter((m) => !m.author.bot).length;

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(COLOR.bad)
      .setTitle('🔒 กำลังปิดทิกเก็ต')
      .setDescription(`ปิดโดย ${closer}${reason ? `\nเหตุผล: ${reason}` : ''}\nห้องนี้จะถูกลบใน ${CLOSE_DELAY_MS / 1000} วินาที`)],
  });

  const html = renderTranscript({
    guildName: channel.guild.name,
    title: `ทิกเก็ต ${label}`,
    subtitle: info ? `${info.type.emoji} ${info.type.label}` : channel.name,
    messages,
  });
  await log('log-tickets', 'bad', `🔒 ปิดทิกเก็ต ${label}`, info ? `${info.type.emoji} ${info.type.label}` : `#${channel.name}`, [
    { name: 'ผู้เปิด', value: info ? `<@${info.ownerId}>` : '-', inline: true },
    { name: 'ผู้รับเรื่อง', value: claimerId ? `<@${claimerId}>` : '-', inline: true },
    { name: 'ผู้ปิด', value: `${closer}`, inline: true },
    { name: 'เปิดเมื่อ', value: relative(channel.createdTimestamp), inline: true },
    { name: 'ใช้เวลา', value: duration(Date.now() - channel.createdTimestamp), inline: true },
    { name: 'ข้อความ', value: `${humanMessages} ข้อความ`, inline: true },
    ...(reason ? [{ name: '📝 เหตุผล', value: reason.slice(0, 1000) }] : []),
  ], {
    actor: closer,
    footer: 'เปิดไฟล์ HTML ที่แนบมาในเบราว์เซอร์เพื่ออ่านประวัติแชท',
    files: [new AttachmentBuilder(Buffer.from(html), { name: `transcript-${label.replace('#', '')}.html` })],
  });

  setTimeout(() => channel.delete(`ปิดทิกเก็ตโดย ${closer.user?.tag ?? closer.tag}`).catch(() => {}), CLOSE_DELAY_MS);
}

// ---------- ปุ่ม เมนู และหน้าต่างกรอกข้อมูล ----------

const ephemeral = (content, extra = {}) => ({ content, flags: MessageFlags.Ephemeral, ...extra });

export async function handleTicketInteraction(interaction, { log }) {
  const { customId, member } = interaction;

  if (interaction.isStringSelectMenu() && customId === 'ticket:open') {
    const type = findType(interaction.values[0]);
    const existing = interaction.guild.channels.cache.find((c) => ticketInfo(c)?.ownerId === member.id);
    if (existing) return interaction.reply(ephemeral(`คุณมีทิกเก็ตที่เปิดอยู่แล้ว: ${existing}`));
    const modal = new ModalBuilder()
      .setCustomId(`ticket:modal:${type.id}`)
      .setTitle(`${type.emoji} ${type.label}`)
      .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder()
        .setCustomId('details')
        .setLabel('รายละเอียด (ไม่บังคับ)')
        .setPlaceholder('เช่น ชื่อสินค้า จำนวน หรือปัญหาที่พบ')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && customId.startsWith('ticket:modal:')) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const type = findType(customId.split(':')[2]);
    const details = interaction.fields.getTextInputValue('details').trim();
    const result = await openTicket(member, type, details, { log });
    return interaction.editReply(result.existing
      ? `คุณมีทิกเก็ตที่เปิดอยู่แล้ว: ${result.existing}`
      : `✅ เปิดทิกเก็ตแล้ว ไปที่ ${result.channel}`);
  }

  const info = ticketInfo(interaction.channel);
  if (!info) return interaction.reply(ephemeral('ปุ่มนี้ใช้ได้เฉพาะในห้องทิกเก็ต'));

  if (customId === 'ticket:claim') {
    if (!isStaff(member)) return interaction.reply(ephemeral('เฉพาะทีมงานที่รับเรื่องได้'));
    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(COLOR.warn);
    embed.spliceFields(1, 1, { name: 'สถานะ', value: `🙋 รับเรื่องโดย ${member}`, inline: true });
    await interaction.update({ embeds: [embed], components: [ticketButtons(true)] });
    return interaction.followUp({ content: `🙋 ${member} รับเรื่องแล้ว`, allowedMentions: { parse: [] } });
  }

  if (customId === 'ticket:close') {
    if (member.id !== info.ownerId && !isStaff(member)) return interaction.reply(ephemeral('เฉพาะเจ้าของทิกเก็ตหรือทีมงานที่ปิดได้'));
    return interaction.reply(ephemeral('ยืนยันปิดทิกเก็ตนี้ไหม? ห้องจะถูกลบ และประวัติแชทจะถูกส่งให้ทีมงาน', {
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:close-confirm').setLabel('ปิดทิกเก็ต').setEmoji('🔒').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket:close-cancel').setLabel('ยกเลิก').setStyle(ButtonStyle.Secondary),
      )],
    }));
  }

  if (customId === 'ticket:close-confirm') {
    await interaction.update({ content: '🔒 กำลังปิดทิกเก็ต...', components: [] });
    return closeTicket(interaction.channel, member, null, { log });
  }

  if (customId === 'ticket:close-cancel') {
    return interaction.update({ content: 'ยกเลิกแล้ว', components: [] });
  }
}

export { isStaff };
