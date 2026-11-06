import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const load = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
const save = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2));

const CHANNELS_FILE = new URL('../channels.json', import.meta.url);
const TICKETS_FILE = new URL('../tickets.json', import.meta.url);
const LEVELS_FILE = new URL('../levels.json', import.meta.url);

// key ของห้อง → channel id ที่ npm run setup และ /template บันทึกไว้ แก้ object นี้แล้วเรียก saveChannels()
export const channels = load(CHANNELS_FILE, {});
export const saveChannels = () => save(CHANNELS_FILE, channels);

// เลขทิกเก็ตถัดไป
export const tickets = load(TICKETS_FILE, { next: 1 });
export const saveTickets = () => save(TICKETS_FILE, tickets);

// EXP ของสมาชิก: { [guildId]: { [userId]: { xp, messages, voiceMinutes } } }
export const levels = load(LEVELS_FILE, {});
export const saveLevels = () => save(LEVELS_FILE, levels);
