import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { general } from './general.js';
import { moderation } from './moderation.js';
import { musicCommands } from './music.js';
import { templateCommands } from './template.js';
import { ticketCommands } from './ticket.js';

const CATEGORIES = [
  { title: '📌 ทั่วไป', commands: general },
  { title: '🎵 เพลง', commands: musicCommands },
  { title: '🎫 ทิกเก็ต', commands: ticketCommands },
  { title: '🛡️ ทีมงาน', commands: moderation },
  { title: '🧩 เทมเพลต (แอดมิน)', commands: templateCommands },
];

const help = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('ดูคำสั่งทั้งหมดของบอท')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('📖 คำสั่งของบอท');
    for (const { title, commands } of CATEGORIES) {
      embed.addFields({
        name: title,
        value: commands.map(({ data }) => `\`/${data.name}\` ${data.description}`).join('\n'),
      });
    }
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export const commands = new Map(
  [help, ...CATEGORIES.flatMap((category) => category.commands)].map((command) => [command.data.name, command]),
);
