// ระบบเล่นเพลงจาก SoundCloud หนึ่งเซิร์ฟเวอร์เล่นได้ทีละห้องเสียง
import { spawn } from 'node:child_process';
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice';
import ffmpegPath from 'ffmpeg-static';
import SoundCloudModule from 'soundcloud.ts';

const SoundCloud = SoundCloudModule.default ?? SoundCloudModule;
const soundcloud = new SoundCloud();

const IDLE_LEAVE_MS = 2 * 60 * 1000;
const sessions = new Map();

const isSoundCloudUrl = (text) => {
  try {
    return /(^|\.)soundcloud\.com$/.test(new URL(text).hostname);
  } catch {
    return false;
  }
};

function toTrack(raw, requestedBy) {
  return { raw, title: raw.title, url: raw.permalink_url, duration: raw.duration, artist: raw.user?.username, requestedBy };
}

// คืนเพลงที่ตรงที่สุด หรือ null ถ้าไม่เจอ
export async function findTrack(query, requestedBy) {
  if (isSoundCloudUrl(query)) return toTrack(await soundcloud.tracks.get(query), requestedBy);
  const result = await soundcloud.tracks.search({ q: query, limit: 5 });
  const playable = (result.collection ?? []).find((track) => track.media?.transcodings?.length);
  return playable ? toTrack(playable, requestedBy) : null;
}

export function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor(total / 60) % 60).padStart(hours ? 2 : 1, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

const announce = (session, content) =>
  session.textChannel?.send({ content, allowedMentions: { parse: [] } }).catch(() => {});

function destroy(session) {
  if (session.destroyed) return;
  session.destroyed = true;
  clearTimeout(session.idleTimer);
  session.queue = [];
  session.ffmpeg?.kill('SIGKILL');
  session.player.stop(true);
  if (session.connection.state.status !== VoiceConnectionStatus.Destroyed) session.connection.destroy();
  sessions.delete(session.guildId);
}

function nextFromQueue(session) {
  const finished = session.current;
  if (finished && !session.skipRequested) {
    if (session.loop === 'track') session.queue.unshift(finished);
    if (session.loop === 'queue') session.queue.push(finished);
  }
  session.skipRequested = false;
  session.current = session.queue.shift() ?? null;
  return session.current;
}

async function playNext(session) {
  if (session.destroyed) return;
  clearTimeout(session.idleTimer);
  session.ffmpeg?.kill('SIGKILL');

  const track = nextFromQueue(session);
  if (!track) {
    session.idleTimer = setTimeout(() => destroy(session), IDLE_LEAVE_MS);
    return;
  }

  try {
    // ลิงก์เสียงของ SoundCloud หมดอายุเร็ว จึงต้องขอใหม่ตอนจะเล่นจริง
    const streamUrl = await soundcloud.util.streamLink(track.raw);
    if (session.destroyed) return;
    const ffmpeg = spawn(
      ffmpegPath,
      ['-loglevel', 'error', '-i', streamUrl, '-vn', '-c:a', 'libopus', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-f', 'ogg', 'pipe:1'],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    ffmpeg.stdout.on('error', () => {});
    session.ffmpeg = ffmpeg;
    session.player.play(createAudioResource(ffmpeg.stdout, { inputType: StreamType.OggOpus }));
    await announce(session, `🎵 กำลังเล่น **${track.title}** (${formatDuration(track.duration)})`);
  } catch (error) {
    console.error(`เล่นเพลงไม่สำเร็จ: ${error.message}`);
    await announce(session, `⚠️ เล่น **${track.title}** ไม่ได้ ข้ามไปเพลงถัดไป`);
    session.current = null;
    await playNext(session);
  }
}

async function connect(voiceChannel, textChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });
  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
  const session = {
    guildId: voiceChannel.guild.id,
    channelId: voiceChannel.id,
    connection,
    player,
    textChannel,
    queue: [],
    current: null,
    loop: 'off',
    skipRequested: false,
    destroyed: false,
    ffmpeg: null,
    idleTimer: null,
  };

  player.on(AudioPlayerStatus.Idle, () => playNext(session));
  player.on('error', (error) => console.error(`เครื่องเล่นเพลงผิดพลาด: ${error.message}`));
  connection.on('error', (error) => console.error(`การเชื่อมต่อห้องเสียงผิดพลาด: ${error.message}`));
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await entersState(connection, VoiceConnectionStatus.Connecting, 5_000);
    } catch {
      destroy(session);
    }
  });
  connection.subscribe(player);

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  } catch (error) {
    destroy(session);
    throw error;
  }
  sessions.set(session.guildId, session);
  return session;
}

export const getSession = (guildId) => sessions.get(guildId);

// เพิ่มเพลงเข้าคิว คืนลำดับในคิว (0 คือเล่นทันที)
export async function enqueue(voiceChannel, textChannel, track) {
  const session = sessions.get(voiceChannel.guild.id) ?? await connect(voiceChannel, textChannel);
  session.textChannel = textChannel;
  session.queue.push(track);
  if (session.current) return session.queue.length;
  await playNext(session);
  return 0;
}

export function skip(session) {
  session.skipRequested = true;
  session.player.stop(true);
}

export const stop = destroy;
export const pause = (session) => session.player.pause();
export const resume = (session) => session.player.unpause();

export function shuffle(session) {
  for (let i = session.queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [session.queue[i], session.queue[j]] = [session.queue[j], session.queue[i]];
  }
}

// ออกจากห้องเมื่อไม่เหลือคนฟัง
export function leaveIfAlone(channel) {
  const session = channel && sessions.get(channel.guild.id);
  if (session?.channelId === channel.id && !channel.members.some((member) => !member.user.bot)) destroy(session);
}
