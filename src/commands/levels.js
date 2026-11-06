import {
  AttachmentBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits as P,
  SlashCommandBuilder,
} from 'discord.js';
import { renderRankCard } from '../ui/cards.js';
import {
  MAX_LEVEL,
  changeXp,
  flushLevels,
  progress,
  rankOf,
  ranking,
  record,
  setLevel,
  tierFor,
} from '../xp.js';

const PAGE_SIZE = 10;
const MEDALS = ['🥇', '🥈', '🥉'];

const isAdmin = (member) => member.id === member.guild.ownerId || member.permissions.has(P.Administrator);
const refuse = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
const number = (value) => value.toLocaleString('th-TH');

async function rankCard(member) {
  const data = record(member.guild.id, member.id);
  const { level, current, needed } = progress(data.xp);
  const tier = tierFor(level);
  const role = tier && member.guild.roles.cache.find((r) => r.name === tier.name);
  return renderRankCard({
    name: member.displayName,
    avatarURL: member.displayAvatarURL({ extension: 'png', size: 256 }),
    level,
    current,
    needed,
    totalXp: data.xp,
    rank: rankOf(member.guild.id, member.id),
    tier: tier ? { name: tier.name, color: role?.hexColor ?? `#${tier.color.toString(16).padStart(6, '0')}` } : null,
    messages: data.messages,
    voiceMinutes: data.voiceMinutes,
  });
}

export const levelCommands = [
  {
    data: new SlashCommandBuilder()
      .setName('rank')
      .setDescription('ดูเลเวลและ EXP ของตัวเอง (แอดมินดูของคนอื่นได้)')
      .setContexts(InteractionContextType.Guild)
      .addUserOption((option) => option.setName('user').setDescription('สมาชิกที่ต้องการดู (เฉพาะแอดมิน)')),
    async execute(interaction) {
      const user = interaction.options.getUser('user') ?? interaction.user;
      if (user.id !== interaction.user.id && !isAdmin(interaction.member)) {
        return refuse(interaction, 'ดูได้เฉพาะเลเวลของตัวเอง แอดมินเท่านั้นที่ดูของคนอื่นได้');
      }
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return refuse(interaction, 'ไม่พบสมาชิกคนนี้ในเซิร์ฟเวอร์');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return interaction.editReply({ files: [new AttachmentBuilder(await rankCard(member), { name: 'rank.png' })] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('ดูอันดับเลเวลของทุกคน (แอดมิน)')
      .setContexts(InteractionContextType.Guild)
      .setDefaultMemberPermissions(P.Administrator)
      .addIntegerOption((option) => option.setName('page').setDescription('หน้า').setMinValue(1)),
    async execute(interaction) {
      if (!isAdmin(interaction.member)) return refuse(interaction, 'เฉพาะแอดมินที่ดูอันดับทั้งหมดได้');
      const all = ranking(interaction.guildId);
      if (!all.length) return refuse(interaction, 'ยังไม่มีใครได้ EXP');

      const pages = Math.ceil(all.length / PAGE_SIZE);
      const page = Math.min(interaction.options.getInteger('page') ?? 1, pages);
      const lines = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((entry, index) => {
        const position = (page - 1) * PAGE_SIZE + index + 1;
        const { level } = progress(entry.xp);
        return `${MEDALS[position - 1] ?? `\`#${position}\``} <@${entry.userId}> · **เลเวล ${level}** · ${number(entry.xp)} EXP`;
      });
      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('🏆 อันดับเลเวล')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `หน้า ${page}/${pages} · ทั้งหมด ${all.length} คน` });
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('xp')
      .setDescription('จัดการเลเวลและ EXP (แอดมิน)')
      .setContexts(InteractionContextType.Guild)
      .setDefaultMemberPermissions(P.Administrator)
      .addSubcommand((sub) => sub.setName('setlevel').setDescription('ตั้งเลเวลให้สมาชิก (ตั้งให้ตัวเองได้)')
        .addUserOption((option) => option.setName('user').setDescription('สมาชิก').setRequired(true))
        .addIntegerOption((option) => option.setName('level').setDescription(`เลเวล 0-${MAX_LEVEL}`).setRequired(true).setMinValue(0).setMaxValue(MAX_LEVEL)))
      .addSubcommand((sub) => sub.setName('add').setDescription('เพิ่มหรือลด EXP (ใส่ค่าติดลบเพื่อลด)')
        .addUserOption((option) => option.setName('user').setDescription('สมาชิก').setRequired(true))
        .addIntegerOption((option) => option.setName('amount').setDescription('จำนวน EXP').setRequired(true).setMinValue(-2_000_000).setMaxValue(2_000_000)))
      .addSubcommand((sub) => sub.setName('reset').setDescription('ล้าง EXP ของสมาชิกเป็น 0')
        .addUserOption((option) => option.setName('user').setDescription('สมาชิก').setRequired(true))),
    async execute(interaction, { log }) {
      if (!isAdmin(interaction.member)) return refuse(interaction, 'เฉพาะแอดมินที่ใช้คำสั่งนี้ได้');
      const sub = interaction.options.getSubcommand();
      const member = await interaction.guild.members.fetch(interaction.options.getUser('user').id).catch(() => null);
      if (!member || member.user.bot) return refuse(interaction, 'ไม่พบสมาชิกคนนี้ หรือเป็นบอท');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      let result;
      let sentence;
      if (sub === 'setlevel') {
        result = await setLevel(member, interaction.options.getInteger('level'));
        sentence = `${interaction.member} ตั้งเลเวลของ ${member} จาก **${result.before}** เป็น **${result.after}**`;
      } else if (sub === 'add') {
        const amount = interaction.options.getInteger('amount');
        result = await changeXp(member, amount);
        sentence = `${interaction.member} ${amount >= 0 ? 'เพิ่ม' : 'ลด'} **${number(Math.abs(amount))} EXP** ให้ ${member} (เลเวล ${result.before} → ${result.after})`;
      } else {
        result = await setLevel(member, 0);
        sentence = `${interaction.member} ล้าง EXP ของ ${member} (จากเลเวล ${result.before})`;
      }
      flushLevels();

      await log('log-members', 'warn', '⭐ เปลี่ยนเลเวล', sentence, [], {
        actor: interaction.member,
        thumbnail: member.displayAvatarURL({ size: 256 }),
        footer: `ID ${member.id}`,
      });
      return interaction.editReply({
        content: `✅ ${sentence}`,
        files: [new AttachmentBuilder(await rankCard(member), { name: 'rank.png' })],
        allowedMentions: { parse: [] },
      });
    },
  },
];
