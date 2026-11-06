import { PermissionFlagsBits as P } from 'discord.js';

// ยศ 10 ระดับของเซิร์ฟเวอร์ แก้ไฟล์นี้แล้วรัน npm run setup ใหม่ได้เลย (โครงห้องอยู่ใน templates.js)

// สิทธิ์ของ @everyone เมื่อรัน npm run setup -- --restrict-everyone
export const EVERYONE_PERMISSIONS = [P.ViewChannel, P.ReadMessageHistory];

const LEVEL_1 = [P.SendMessages, P.AddReactions, P.Connect, P.Speak, P.UseVAD, P.UseApplicationCommands];
const LEVEL_2 = [...LEVEL_1, P.EmbedLinks, P.AttachFiles, P.ChangeNickname, P.Stream, P.UseExternalEmojis, P.SendMessagesInThreads];
const LEVEL_3 = [...LEVEL_2, P.CreatePublicThreads, P.UseExternalStickers, P.CreateInstantInvite];
const LEVEL_4 = [...LEVEL_3, P.CreatePrivateThreads, P.SendVoiceMessages, P.UseSoundboard, P.PrioritySpeaker];
const LEVEL_5 = [...LEVEL_4, P.ManageMessages, P.ManageThreads];
const LEVEL_6 = [...LEVEL_5, P.ModerateMembers, P.ManageNicknames];
const LEVEL_7 = [...LEVEL_6, P.KickMembers, P.MuteMembers, P.DeafenMembers, P.MoveMembers, P.ViewAuditLog];
const LEVEL_8 = [...LEVEL_7, P.BanMembers, P.MentionEveryone, P.ManageGuildExpressions, P.ManageEvents];
const LEVEL_9 = [...LEVEL_8, P.ManageChannels, P.ManageWebhooks];
const LEVEL_10 = [...LEVEL_9, P.ManageRoles, P.ManageGuild];

// เรียงจากสูงไปต่ำ staff: true คือเห็นหมวด 🔒 ทีมงานและพิมพ์ในห้อง readonly ได้
// ชื่อยศใช้เป็นตัวอ้างอิงตอนรันซ้ำ ถ้าเปลี่ยนชื่อในนี้จะได้ยศใหม่
export const ROLE_LEVELS = [
  { level: 10, name: '👑 เจ้าของร้าน', color: 0xf1c40f, staff: true, permissions: LEVEL_10 },
  { level: 9, name: '💎 ผู้จัดการ', color: 0x1abc9c, staff: true, permissions: LEVEL_9 },
  { level: 8, name: '⚔️ แอดมิน', color: 0xe74c3c, staff: true, permissions: LEVEL_8 },
  { level: 7, name: '🔨 ผู้ดูแล', color: 0xe67e22, staff: true, permissions: LEVEL_7 },
  { level: 6, name: '🛡️ ทีมงาน', color: 0x5865f2, staff: true, permissions: LEVEL_6 },
  { level: 5, name: '🎧 ฝ่ายบริการลูกค้า', color: 0x3498db, staff: true, permissions: LEVEL_5 },
  { level: 4, name: '🌟 ลูกค้า VIP', color: 0x9b59b6, permissions: LEVEL_4 },
  { level: 3, name: '🛒 ลูกค้า', color: 0x2ecc71, permissions: LEVEL_3 },
  { level: 2, name: '✅ สมาชิก', color: 0x95a5a6, permissions: LEVEL_2 },
  { level: 1, name: '🌱 ผู้มาใหม่', color: 0xbdc3c7, permissions: LEVEL_1 },
];
