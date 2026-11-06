import { InteractionContextType, MessageFlags, PermissionFlagsBits as P, SlashCommandBuilder } from 'discord.js';
import { closeTicket, ensureTicketPanel, isStaff, ticketInfo } from '../tickets.js';

const refuse = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

export const ticketCommands = [
  {
    data: new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('จัดการทิกเก็ต')
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((sub) => sub.setName('close').setDescription('ปิดทิกเก็ตนี้')
        .addStringOption((option) => option.setName('reason').setDescription('เหตุผล').setMaxLength(400)))
      .addSubcommand((sub) => sub.setName('add').setDescription('เพิ่มคนเข้าทิกเก็ตนี้ (ทีมงาน)')
        .addUserOption((option) => option.setName('user').setDescription('สมาชิก').setRequired(true)))
      .addSubcommand((sub) => sub.setName('remove').setDescription('นำคนออกจากทิกเก็ตนี้ (ทีมงาน)')
        .addUserOption((option) => option.setName('user').setDescription('สมาชิก').setRequired(true)))
      .addSubcommand((sub) => sub.setName('panel').setDescription('โพสต์หรือรีเฟรชแผงเปิดทิกเก็ต (แอดมิน)')),

    async execute(interaction, { log }) {
      const sub = interaction.options.getSubcommand();
      const { member, channel } = interaction;

      if (sub === 'panel') {
        if (!member.permissions.has(P.Administrator)) return refuse(interaction, 'เฉพาะแอดมินที่ใช้คำสั่งนี้ได้');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const posted = await ensureTicketPanel(interaction.client);
        return interaction.editReply(posted ? '✅ อัปเดตแผงเปิดทิกเก็ตแล้ว' : 'ยังไม่มีห้อง 🎫・เปิดทิกเก็ต ให้ใช้ `/template apply` ก่อน');
      }

      const info = ticketInfo(channel);
      if (!info) return refuse(interaction, 'คำสั่งนี้ใช้ได้เฉพาะในห้องทิกเก็ต');

      if (sub === 'close') {
        if (member.id !== info.ownerId && !isStaff(member)) return refuse(interaction, 'เฉพาะเจ้าของทิกเก็ตหรือทีมงานที่ปิดได้');
        await interaction.reply({ content: '🔒 กำลังปิดทิกเก็ต...', flags: MessageFlags.Ephemeral });
        return closeTicket(channel, member, interaction.options.getString('reason'), { log });
      }

      if (!isStaff(member)) return refuse(interaction, 'เฉพาะทีมงานที่ใช้คำสั่งนี้ได้');
      const user = interaction.options.getUser('user');

      if (sub === 'add') {
        await channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
        });
        return interaction.reply({ content: `➕ เพิ่ม ${user} เข้าทิกเก็ตแล้ว`, allowedMentions: { users: [user.id] } });
      }

      if (user.id === info.ownerId) return refuse(interaction, 'นำเจ้าของทิกเก็ตออกไม่ได้ ให้ปิดทิกเก็ตแทน');
      await channel.permissionOverwrites.delete(user.id);
      return interaction.reply({ content: `➖ นำ ${user} ออกจากทิกเก็ตแล้ว`, allowedMentions: { parse: [] } });
    },
  },
];
