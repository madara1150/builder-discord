import {
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits as P,
  SlashCommandBuilder,
} from 'discord.js';
import { setLevel } from '../roles.js';
import { channels } from '../store.js';

const MINUTE = 60 * 1000;

const command = (name, description, permission) =>
  new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(permission);

const addTarget = (builder) => builder.addUserOption((option) => option.setName('user').setDescription('สมาชิก').setRequired(true));
const addReason = (builder) => builder.addStringOption((option) => option.setName('reason').setDescription('เหตุผล').setMaxLength(400));

const refuse = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

// ผู้สั่งต้องยศสูงกว่าเป้าหมาย ป้องกันทีมงานระดับล่างจัดการคนระดับสูงกว่า
function outranks(actor, target) {
  if (actor.id === target.id) return false;
  if (target.id === actor.guild.ownerId) return false;
  return actor.id === actor.guild.ownerId || actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

// การกระทำผ่านบอทถูกตัดออกจาก Log ฝั่ง Audit จึงต้องบันทึกจากตรงนี้
const auditReason = (interaction, reason) => `${interaction.user.tag}: ${reason ?? 'ไม่ระบุเหตุผล'}`;
// sentence คือประโยคสรุป เช่น "@ก เตะ @ข ออกจากเซิร์ฟเวอร์"
const modLog = (log, interaction, title, user, sentence, reason) =>
  log('log-members', 'bad', title, `${sentence}
ผ่านคำสั่งของบอท`, reason ? [{ name: '📝 เหตุผล', value: reason }] : [], {
    actor: interaction.member,
    thumbnail: user.displayAvatarURL({ size: 256 }),
    footer: `ID ${user.id}`,
  });

export const moderation = [
  {
    data: command('clear', 'ลบข้อความล่าสุด (เฉพาะข้อความอายุไม่เกิน 14 วัน)', P.ManageMessages).addIntegerOption((option) =>
      option.setName('amount').setDescription('จำนวนข้อความ').setRequired(true).setMinValue(1).setMaxValue(100)),
    async execute(interaction, { log }) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const deleted = await interaction.channel.bulkDelete(interaction.options.getInteger('amount'), true);
      await log('log-messages', 'bad', '🧹 ล้างข้อความ', `${interaction.member} ลบข้อความ **${deleted.size}** ข้อความในห้อง ${interaction.channel} ด้วยคำสั่ง /clear`, [], { actor: interaction.member });
      await interaction.editReply(`🧹 ลบแล้ว ${deleted.size} ข้อความ`);
    },
  },
  {
    data: addReason(addTarget(command('kick', 'เตะสมาชิก', P.KickMembers))),
    async execute(interaction, { log }) {
      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason');
      if (!target) return refuse(interaction, 'ไม่พบสมาชิกคนนี้ในเซิร์ฟเวอร์');
      if (!outranks(interaction.member, target) || !target.kickable) return refuse(interaction, 'คุณหรือบอทมียศไม่สูงพอที่จะเตะคนนี้');
      await target.kick(auditReason(interaction, reason));
      await modLog(log, interaction, '👢 เตะสมาชิก', target.user, `${interaction.member} เตะ ${target.user} ออกจากเซิร์ฟเวอร์`, reason);
      return interaction.reply({ content: `👢 เตะ ${target.user.tag} แล้ว`, flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: addReason(addTarget(command('ban', 'แบนสมาชิก', P.BanMembers))),
    async execute(interaction, { log }) {
      const user = interaction.options.getUser('user');
      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason');
      if (target && (!outranks(interaction.member, target) || !target.bannable)) {
        return refuse(interaction, 'คุณหรือบอทมียศไม่สูงพอที่จะแบนคนนี้');
      }
      await interaction.guild.bans.create(user.id, { reason: auditReason(interaction, reason) });
      await modLog(log, interaction, '🔨 แบนสมาชิก', user, `${interaction.member} แบน ${user}`, reason);
      return interaction.reply({ content: `🔨 แบน ${user.tag} แล้ว`, flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: command('unban', 'ปลดแบนด้วยไอดีผู้ใช้', P.BanMembers).addStringOption((option) =>
      option.setName('user_id').setDescription('ไอดีของผู้ใช้').setRequired(true)),
    async execute(interaction, { log }) {
      const userId = interaction.options.getString('user_id').trim();
      const unbanned = await interaction.guild.bans.remove(userId, auditReason(interaction)).catch(() => null);
      if (!unbanned) return refuse(interaction, 'ไม่พบการแบนของไอดีนี้');
      await modLog(log, interaction, '🕊️ ปลดแบนสมาชิก', unbanned, `${interaction.member} ปลดแบน ${unbanned}`);
      return interaction.reply({ content: `🕊️ ปลดแบน ${unbanned.tag} แล้ว`, flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: addReason(addTarget(command('timeout', 'ห้ามสมาชิกพิมพ์และพูดชั่วคราว', P.ModerateMembers))
      .addIntegerOption((option) => option.setName('minutes').setDescription('กี่นาที (สูงสุด 40320 คือ 28 วัน)').setRequired(true).setMinValue(1).setMaxValue(40320))),
    async execute(interaction, { log }) {
      const target = interaction.options.getMember('user');
      const minutes = interaction.options.getInteger('minutes');
      const reason = interaction.options.getString('reason');
      if (!target) return refuse(interaction, 'ไม่พบสมาชิกคนนี้ในเซิร์ฟเวอร์');
      if (!outranks(interaction.member, target) || !target.moderatable) return refuse(interaction, 'คุณหรือบอทมียศไม่สูงพอที่จะจัดการคนนี้');
      await target.timeout(minutes * MINUTE, auditReason(interaction, reason));
      await modLog(log, interaction, '⏳ หมดเวลาสมาชิก', target.user, `${interaction.member} สั่งหมดเวลา ${target.user} เป็นเวลา **${minutes} นาที**`, reason);
      return interaction.reply({ content: `⏳ หมดเวลา ${target.user.tag} ${minutes} นาทีแล้ว`, flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: addTarget(command('untimeout', 'ยกเลิกการหมดเวลา', P.ModerateMembers)),
    async execute(interaction, { log }) {
      const target = interaction.options.getMember('user');
      if (!target) return refuse(interaction, 'ไม่พบสมาชิกคนนี้ในเซิร์ฟเวอร์');
      if (!outranks(interaction.member, target) || !target.moderatable) return refuse(interaction, 'คุณหรือบอทมียศไม่สูงพอที่จะจัดการคนนี้');
      await target.timeout(null, auditReason(interaction));
      await modLog(log, interaction, '⌛ ยกเลิกการหมดเวลา', target.user, `${interaction.member} ยกเลิกการหมดเวลาของ ${target.user}`);
      return interaction.reply({ content: `⌛ ยกเลิกการหมดเวลาของ ${target.user.tag} แล้ว`, flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: addTarget(command('setlevel', 'ตั้งระดับยศ 1-10 ให้สมาชิก', P.ManageRoles))
      .addIntegerOption((option) => option.setName('level').setDescription('ระดับ 1-10').setRequired(true).setMinValue(1).setMaxValue(10)),
    async execute(interaction, { log }) {
      const target = interaction.options.getMember('user');
      if (!target) return refuse(interaction, 'ไม่พบสมาชิกคนนี้ในเซิร์ฟเวอร์');
      if (!outranks(interaction.member, target)) return refuse(interaction, 'คุณมียศไม่สูงพอที่จะเปลี่ยนระดับของคนนี้');
      const result = await setLevel(interaction.member, target, interaction.options.getInteger('level'));
      if (!result) return refuse(interaction, 'คุณตั้งระดับเท่าหรือสูงกว่ายศของตัวเองไม่ได้');
      await log('log-members', 'warn', '🎭 ตั้งระดับยศ', `${interaction.member} ตั้งระดับยศของ ${target} เป็น ${result}`, [], {
        actor: interaction.member,
        thumbnail: target.displayAvatarURL({ size: 256 }),
        footer: `ID ${target.id}`,
      });
      return interaction.reply({ content: `🎭 ตั้ง ${target.user.tag} เป็น ${result.name} แล้ว`, flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: command('announce', 'ลงประกาศในห้อง 📢・ประกาศ', P.ManageMessages)
      .addStringOption((option) => option.setName('title').setDescription('หัวข้อ').setRequired(true).setMaxLength(200))
      .addStringOption((option) => option.setName('message').setDescription('ข้อความ').setRequired(true)),
    async execute(interaction) {
      const channel = await interaction.client.channels.fetch(channels.announcements);
      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(`📢 ${interaction.options.getString('title')}`)
        .setDescription(interaction.options.getString('message').replaceAll('\\n', '\n'))
        .setFooter({ text: interaction.member.displayName })
        .setTimestamp();
      await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      await interaction.reply({ content: `ลงประกาศใน ${channel} แล้ว`, flags: MessageFlags.Ephemeral });
    },
  },
  {
    data: command('slowmode', 'ตั้งโหมดช้าของห้องนี้', P.ManageChannels).addIntegerOption((option) =>
      option.setName('seconds').setDescription('กี่วินาทีต่อข้อความ (0 คือปิด)').setRequired(true).setMinValue(0).setMaxValue(21600)),
    async execute(interaction) {
      if (interaction.channel.type !== ChannelType.GuildText) return refuse(interaction, 'ใช้ได้เฉพาะห้องข้อความ');
      const seconds = interaction.options.getInteger('seconds');
      await interaction.channel.setRateLimitPerUser(seconds, interaction.user.tag);
      return interaction.reply({ content: seconds ? `🐢 ตั้งโหมดช้า ${seconds} วินาทีแล้ว` : '🐇 ปิดโหมดช้าแล้ว', flags: MessageFlags.Ephemeral });
    },
  },
];
