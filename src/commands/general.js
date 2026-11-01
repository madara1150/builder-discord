import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

const command = (name, description) =>
  new SlashCommandBuilder().setName(name).setDescription(description).setContexts(InteractionContextType.Guild);

const timestamp = (ms) => `<t:${Math.floor(ms / 1000)}:D>`;

export const general = [
  {
    data: command('ping', 'เช็กความเร็วการตอบสนองของบอท'),
    execute: (interaction) =>
      interaction.reply({ content: `🏓 ${Math.round(interaction.client.ws.ping)} ms`, flags: MessageFlags.Ephemeral }),
  },
  {
    data: command('serverinfo', 'ดูข้อมูลเซิร์ฟเวอร์'),
    async execute(interaction) {
      const { guild } = interaction;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: 'เจ้าของ', value: `<@${guild.ownerId}>`, inline: true },
          { name: 'สมาชิก', value: `${guild.memberCount} คน`, inline: true },
          { name: 'ห้อง', value: `${guild.channels.cache.size} ห้อง`, inline: true },
          { name: 'ยศ', value: `${guild.roles.cache.size} ยศ`, inline: true },
          { name: 'บูสต์', value: `${guild.premiumSubscriptionCount ?? 0} ครั้ง`, inline: true },
          { name: 'สร้างเมื่อ', value: timestamp(guild.createdTimestamp), inline: true },
        );
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: command('userinfo', 'ดูข้อมูลสมาชิก').addUserOption((option) =>
      option.setName('user').setDescription('สมาชิกที่ต้องการดู ถ้าไม่เลือกจะเป็นตัวคุณเอง')),
    async execute(interaction) {
      const user = interaction.options.getUser('user') ?? interaction.user;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const roles = member?.roles.cache.filter((role) => role.id !== interaction.guild.id).map((role) => `${role}`).join(' ');
      const embed = new EmbedBuilder()
        .setColor(member?.displayColor || 0x5865f2)
        .setTitle(member?.displayName ?? user.username)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: 'ชื่อผู้ใช้', value: user.tag, inline: true },
          { name: 'สร้างบัญชี', value: timestamp(user.createdTimestamp), inline: true },
          { name: 'เข้าเซิร์ฟเวอร์', value: member?.joinedTimestamp ? timestamp(member.joinedTimestamp) : '-', inline: true },
          { name: 'ยศ', value: roles?.slice(0, 1000) || '-' },
        );
      await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    },
  },
  {
    data: command('avatar', 'ดูรูปโปรไฟล์').addUserOption((option) =>
      option.setName('user').setDescription('สมาชิกที่ต้องการดู ถ้าไม่เลือกจะเป็นตัวคุณเอง')),
    async execute(interaction) {
      const user = interaction.options.getUser('user') ?? interaction.user;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(user.username)
        .setImage(user.displayAvatarURL({ size: 1024 }));
      await interaction.reply({ embeds: [embed] });
    },
  },
  {
    data: command('poll', 'สร้างโพล')
      .addStringOption((option) => option.setName('question').setDescription('คำถาม').setRequired(true).setMaxLength(300))
      .addStringOption((option) => option.setName('choices').setDescription('ตัวเลือก คั่นด้วยเครื่องหมาย , (2-10 ตัวเลือก)').setRequired(true))
      .addIntegerOption((option) => option.setName('hours').setDescription('เปิดโหวตกี่ชั่วโมง (ค่าเริ่มต้น 24)').setMinValue(1).setMaxValue(168)),
    async execute(interaction) {
      const choices = interaction.options.getString('choices').split(',').map((text) => text.trim()).filter(Boolean);
      if (choices.length < 2 || choices.length > 10 || choices.some((text) => text.length > 55)) {
        await interaction.reply({ content: 'ต้องมี 2-10 ตัวเลือก และแต่ละตัวเลือกยาวไม่เกิน 55 ตัวอักษร', flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({
        poll: {
          question: { text: interaction.options.getString('question') },
          answers: choices.map((text) => ({ text })),
          duration: interaction.options.getInteger('hours') ?? 24,
          allowMultiselect: false,
        },
      });
    },
  },
  {
    data: command('dice', 'ทอยลูกเต๋า').addIntegerOption((option) =>
      option.setName('sides').setDescription('จำนวนหน้า (ค่าเริ่มต้น 6)').setMinValue(2).setMaxValue(1000)),
    async execute(interaction) {
      const sides = interaction.options.getInteger('sides') ?? 6;
      await interaction.reply(`🎲 ได้ **${Math.floor(Math.random() * sides) + 1}** จาก ${sides} หน้า`);
    },
  },
  {
    data: command('coinflip', 'โยนเหรียญ'),
    execute: (interaction) => interaction.reply(`🪙 ออก **${Math.random() < 0.5 ? 'หัว' : 'ก้อย'}**`),
  },
];
