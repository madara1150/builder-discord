import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { AudioPlayerStatus } from '@discordjs/voice';
import * as music from '../music.js';

const command = (name, description) =>
  new SlashCommandBuilder().setName(name).setDescription(description).setContexts(InteractionContextType.Guild);

const LOOP_LABELS = { off: 'ปิด', track: 'เพลงเดียว', queue: 'ทั้งคิว' };

const refuse = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

// คำสั่งควบคุมเพลงใช้ได้เฉพาะคนที่อยู่ห้องเสียงเดียวกับบอท
function withSession(handler) {
  return async (interaction) => {
    const session = music.getSession(interaction.guildId);
    if (!session) return refuse(interaction, 'ตอนนี้ไม่ได้เล่นเพลงอยู่');
    if (interaction.member.voice.channelId !== session.channelId) {
      return refuse(interaction, `ต้องอยู่ในห้องเสียง <#${session.channelId}> ก่อน`);
    }
    return handler(interaction, session);
  };
}

export const musicCommands = [
  {
    data: command('play', 'เล่นเพลงจาก SoundCloud').addStringOption((option) =>
      option.setName('song').setDescription('ชื่อเพลง หรือลิงก์ SoundCloud').setRequired(true)),
    async execute(interaction) {
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) return refuse(interaction, 'ต้องเข้าห้องเสียงก่อน');
      const session = music.getSession(interaction.guildId);
      if (session && session.channelId !== voiceChannel.id) return refuse(interaction, `บอทกำลังเล่นเพลงอยู่ใน <#${session.channelId}>`);

      await interaction.deferReply();
      const track = await music.findTrack(interaction.options.getString('song'), interaction.user.id).catch(() => null);
      if (!track) return interaction.editReply('❌ ไม่พบเพลงนี้บน SoundCloud');

      try {
        const position = await music.enqueue(voiceChannel, interaction.channel, track);
        return interaction.editReply(position
          ? `➕ เพิ่ม **${track.title}** เข้าคิวลำดับที่ ${position}`
          : `▶️ เริ่มเล่น **${track.title}**`);
      } catch (error) {
        console.error(`เข้าห้องเสียงไม่สำเร็จ: ${error.message}`);
        return interaction.editReply('❌ เข้าห้องเสียงไม่สำเร็จ ลองใหม่อีกครั้ง');
      }
    },
  },
  {
    data: command('skip', 'ข้ามเพลงนี้'),
    execute: withSession((interaction, session) => {
      music.skip(session);
      return interaction.reply('⏭️ ข้ามเพลงแล้ว');
    }),
  },
  {
    data: command('stop', 'หยุดเล่น ล้างคิว และออกจากห้องเสียง'),
    execute: withSession((interaction, session) => {
      music.stop(session);
      return interaction.reply('⏹️ หยุดเล่นแล้ว');
    }),
  },
  {
    data: command('pause', 'พักเพลง'),
    execute: withSession((interaction, session) => {
      music.pause(session);
      return interaction.reply('⏸️ พักเพลงแล้ว');
    }),
  },
  {
    data: command('resume', 'เล่นเพลงต่อ'),
    execute: withSession((interaction, session) => {
      music.resume(session);
      return interaction.reply('▶️ เล่นต่อแล้ว');
    }),
  },
  {
    data: command('queue', 'ดูคิวเพลง'),
    async execute(interaction) {
      const session = music.getSession(interaction.guildId);
      if (!session?.current) return refuse(interaction, 'คิวว่างอยู่');
      const upcoming = session.queue.slice(0, 10).map((track, index) => `${index + 1}. ${track.title} (${music.formatDuration(track.duration)})`);
      const more = session.queue.length > 10 ? `\n...และอีก ${session.queue.length - 10} เพลง` : '';
      return interaction.reply({
        content: `🎵 กำลังเล่น: **${session.current.title}**\n🔁 วนซ้ำ: ${LOOP_LABELS[session.loop]}\n${upcoming.join('\n') || 'ไม่มีเพลงถัดไป'}${more}`.slice(0, 2000),
        allowedMentions: { parse: [] },
      });
    },
  },
  {
    data: command('nowplaying', 'ดูเพลงที่กำลังเล่น'),
    async execute(interaction) {
      const session = music.getSession(interaction.guildId);
      if (!session?.current) return refuse(interaction, 'ตอนนี้ไม่ได้เล่นเพลงอยู่');
      const paused = session.player.state.status === AudioPlayerStatus.Paused;
      const played = session.player.state.playbackDuration ?? 0;
      const { current } = session;
      return interaction.reply({
        content: `${paused ? '⏸️' : '🎵'} **${current.title}** โดย ${current.artist ?? '-'}\n${music.formatDuration(played)} / ${music.formatDuration(current.duration)} · ขอโดย <@${current.requestedBy}>\n${current.url}`,
        allowedMentions: { parse: [] },
      });
    },
  },
  {
    data: command('shuffle', 'สลับลำดับคิว'),
    execute: withSession((interaction, session) => {
      music.shuffle(session);
      return interaction.reply('🔀 สลับคิวแล้ว');
    }),
  },
  {
    data: command('loop', 'ตั้งการวนซ้ำ').addStringOption((option) =>
      option.setName('mode').setDescription('รูปแบบ').setRequired(true).addChoices(
        { name: 'ปิด', value: 'off' },
        { name: 'เพลงเดียว', value: 'track' },
        { name: 'ทั้งคิว', value: 'queue' },
      )),
    execute: withSession((interaction, session) => {
      session.loop = interaction.options.getString('mode');
      return interaction.reply(`🔁 วนซ้ำ: ${LOOP_LABELS[session.loop]}`);
    }),
  },
];
