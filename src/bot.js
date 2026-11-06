// บอทประจำเซิร์ฟเวอร์: เก็บ Log และแจ้งเตือน ต้องเปิดค้างไว้ถึงจะบันทึกเหตุการณ์ได้
import { Client, EmbedBuilder, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import { commands } from './commands/index.js';
import { registerLogEvents } from './log-events.js';
import { COLOR, createLogger } from './logger.js';
import { leaveIfAlone } from './music.js';
import { assignMissingLevel } from './roles.js';
import { channels } from './store.js';
import { ensureTicketPanel, handleTicketInteraction } from './tickets.js';
import { ensureTierRoles, flushLevels, registerXp } from './xp.js';

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

const { send, log } = createLogger(client);
registerLogEvents(client, { send, log });
registerXp(client, { send });

client.on(Events.VoiceStateUpdate, (before) => leaveIfAlone(before.channel));

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
  await ensureTierRoles(guild).catch((error) => console.error(`สร้างยศเลเวลไม่สำเร็จ: ${error.message}`));
  // เก็บตกคนที่เข้ามาตอนบอทปิดอยู่
  await assignMissingLevel(guild, 1).catch((error) => console.error(`แจกยศไม่สำเร็จ: ${error.message}`));
});

async function shutdown() {
  flushLevels();
  await send('bot-notify', { embeds: [statusEmbed(false)] });
  await client.destroy();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
client.on(Events.Error, (error) => console.error(error));

client.login(process.env.DISCORD_TOKEN);
