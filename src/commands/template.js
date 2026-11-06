import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits as P,
  SlashCommandBuilder,
} from 'discord.js';
import { applyPlan, planTemplate } from '../builder.js';
import { TEMPLATES, findTemplate } from '../templates.js';
import { ensureTicketPanel } from '../tickets.js';
import { renderTemplatePreview } from '../ui/cards.js';

const CONFIRM_TIMEOUT_MS = 2 * 60 * 1000;
const COLOR = { info: 0x5865f2, good: 0x57f287, warn: 0xfee75c, bad: 0xed4245 };

// ป้องกันการสร้างห้องซ้อนกันในเซิร์ฟเวอร์เดียว
const running = new Set();

const addTemplateOption = (sub) =>
  sub.addStringOption((option) =>
    option
      .setName('name')
      .setDescription('เทมเพลต')
      .setRequired(true)
      .addChoices(...TEMPLATES.map((t) => ({ name: `${t.emoji} ${t.name}`, value: t.id }))));

const channelCount = (template) => template.categories.reduce((sum, c) => sum + c.channels.length, 0);

async function previewMessage(interaction, plan) {
  const image = renderTemplatePreview({ plan, guildName: interaction.guild.name });
  const { template, counts, steps } = plan;
  const updates = steps
    .filter((step) => step.action === 'update')
    .slice(0, 10)
    .map((step) => `• ${step.item.name} — ${step.changes.join(', ')}`);

  const embed = new EmbedBuilder()
    .setColor(COLOR.info)
    .setTitle(`${template.emoji} เทมเพลต${template.name}`)
    .setDescription(template.description)
    .addFields(
      { name: '🟢 สร้างใหม่', value: `${counts.create} รายการ`, inline: true },
      { name: '🟡 แก้ไข', value: `${counts.update} รายการ`, inline: true },
      { name: '⚪ เหมือนเดิม', value: `${counts.keep} รายการ`, inline: true },
    )
    .setImage('attachment://template.png')
    .setFooter({ text: 'ไม่มีการลบห้องเดิม · ห้องที่ไม่อยู่ในเทมเพลตจะไม่ถูกแตะ' });
  if (updates.length) embed.addFields({ name: 'ห้องที่จะถูกแก้ไข', value: updates.join('\n').slice(0, 1024) });
  if (!plan.staffRoles) {
    embed.addFields({ name: '⚠️ ยังไม่มียศทีมงาน', value: 'ห้องทีมงานและห้อง Log จะเห็นได้เฉพาะแอดมิน รัน `npm run setup` เพื่อสร้างยศก่อน' });
  }
  return { embeds: [embed], files: [new AttachmentBuilder(image, { name: 'template.png' })] };
}

async function loadPlan(interaction, template) {
  await interaction.guild.channels.fetch();
  await interaction.guild.roles.fetch();
  return planTemplate(interaction.guild, template, interaction.client.user.id);
}

export const templateCommands = [
  {
    data: new SlashCommandBuilder()
      .setName('template')
      .setDescription('สร้างห้องทั้งเซิร์ฟเวอร์จากเทมเพลต')
      .setContexts(InteractionContextType.Guild)
      .setDefaultMemberPermissions(P.Administrator)
      .addSubcommand((sub) => sub.setName('list').setDescription('ดูเทมเพลตทั้งหมด'))
      .addSubcommand((sub) => addTemplateOption(sub.setName('preview').setDescription('ดูตัวอย่างว่าจะสร้างหรือแก้ห้องอะไรบ้าง')))
      .addSubcommand((sub) => addTemplateOption(sub.setName('apply').setDescription('สร้างห้องตามเทมเพลต (มีให้ยืนยันก่อน)'))),

    async execute(interaction, { log }) {
      const sub = interaction.options.getSubcommand();

      if (sub === 'list') {
        const embed = new EmbedBuilder()
          .setColor(COLOR.info)
          .setTitle('🧩 เทมเพลตห้อง')
          .setDescription('ใช้ `/template preview` เพื่อดูตัวอย่าง หรือ `/template apply` เพื่อสร้างห้อง')
          .addFields(TEMPLATES.map((t) => ({
            name: `${t.emoji} ${t.name}`,
            value: `${t.description}\n\`${t.categories.length} หมวด · ${channelCount(t)} ห้อง\``,
          })));
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const template = findTemplate(interaction.options.getString('name'));
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const plan = await loadPlan(interaction, template);

      if (sub === 'preview') return interaction.editReply(await previewMessage(interaction, plan));

      if (running.has(interaction.guildId)) {
        return interaction.editReply('⏳ กำลังสร้างห้องจากเทมเพลตอื่นอยู่ รอให้เสร็จก่อน');
      }
      if (!plan.counts.create && !plan.counts.update) {
        return interaction.editReply({ content: '✅ เซิร์ฟเวอร์ตรงกับเทมเพลตนี้อยู่แล้ว', ...(await previewMessage(interaction, plan)) });
      }

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm').setLabel(`สร้างห้องตามเทมเพลต`).setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel').setLabel('ยกเลิก').setStyle(ButtonStyle.Secondary),
      );
      const message = await interaction.editReply({
        content: `ตรวจดูภาพด้านล่างก่อนกดยืนยัน (หมดเวลาใน ${CONFIRM_TIMEOUT_MS / 60000} นาที)`,
        ...(await previewMessage(interaction, plan)),
        components: [buttons],
      });

      const click = await message
        .awaitMessageComponent({
          componentType: ComponentType.Button,
          filter: (i) => i.user.id === interaction.user.id,
          time: CONFIRM_TIMEOUT_MS,
        })
        .catch(() => null);
      const cleared = { embeds: [], attachments: [], components: [] };
      if (!click) return interaction.editReply({ content: '⌛ หมดเวลายืนยันแล้ว', ...cleared });
      if (click.customId === 'cancel') return click.update({ content: '❎ ยกเลิกแล้ว', ...cleared });

      running.add(interaction.guildId);
      try {
        await click.update({ content: '⏳ กำลังสร้างห้อง...', components: [] });
        // ดึงข้อมูลใหม่ก่อนสร้างจริง เผื่อมีคนแก้ห้องระหว่างรอยืนยัน
        const fresh = await loadPlan(interaction, template);
        let lastUpdate = 0;
        await applyPlan(interaction.guild, fresh, async (done, total) => {
          if (Date.now() - lastUpdate < 1500 && done < total) return;
          lastUpdate = Date.now();
          await interaction.editReply({ content: `⏳ กำลังสร้างห้อง ${done}/${total}` }).catch(() => {});
        });

        await ensureTicketPanel(interaction.client);
        const after = await loadPlan(interaction, template);
        const result = await previewMessage(interaction, after);
        result.embeds[0]
          .setColor(COLOR.good)
          .setTitle(`✅ ใช้เทมเพลต${template.name}แล้ว`)
          .spliceFields(0, 3,
            { name: '🟢 สร้างใหม่', value: `${fresh.counts.create} รายการ`, inline: true },
            { name: '🟡 แก้ไข', value: `${fresh.counts.update} รายการ`, inline: true },
            { name: '⚪ เหมือนเดิม', value: `${fresh.counts.keep} รายการ`, inline: true });
        await interaction.editReply({ content: '', ...result, attachments: [] });

        await log('log-server', 'good', `🧩 ใช้เทมเพลต${template.name}`, `สร้างใหม่ ${fresh.counts.create} · แก้ไข ${fresh.counts.update} · เหมือนเดิม ${fresh.counts.keep}`, [], {
          actor: interaction.member,
          image: renderTemplatePreview({ plan: after, guildName: interaction.guild.name }),
        });
      } finally {
        running.delete(interaction.guildId);
      }
    },
  },
];
