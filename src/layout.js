import { PermissionFlagsBits as P } from 'discord.js';

// โครงสร้างห้องและยศทั้งหมดของเซิร์ฟเวอร์ แก้ไฟล์นี้แล้วรัน npm run setup ใหม่ได้เลย
// key ใช้อ้างอิงห้องตอนรันซ้ำ จึงเปลี่ยนชื่อห้องได้โดยไม่สร้างห้องใหม่ แต่ห้ามเปลี่ยน key
//
// access:
//   public   ทุกคนพิมพ์ได้
//   readonly ทุกคนอ่านได้ ทีมงานกับบอทพิมพ์ได้
//   staff    เห็นเฉพาะทีมงานกับบอท
//   log      เห็นเฉพาะทีมงาน พิมพ์ได้เฉพาะบอท

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

export const LAYOUT = [
  {
    key: 'cat-info',
    name: '📌 ข้อมูลเซิร์ฟเวอร์',
    channels: [
      { key: 'announcements', name: '📢・ประกาศ', access: 'readonly', topic: 'ข่าวสารและประกาศจากทางร้าน' },
      { key: 'rules', name: '📜・กฎของเซิร์ฟเวอร์', access: 'readonly', topic: 'กรุณาอ่านกฎก่อนใช้งาน' },
      { key: 'welcome', name: '👋・ยินดีต้อนรับ', access: 'readonly', topic: 'บอทจะทักทายสมาชิกใหม่ที่ห้องนี้' },
    ],
  },
  {
    key: 'cat-shop',
    name: '🛒 ร้านค้า',
    channels: [
      { key: 'products', name: '🛍️・สินค้าทั้งหมด', access: 'readonly', topic: 'รายการสินค้าและราคา' },
      { key: 'promotions', name: '🔥・โปรโมชัน', access: 'readonly', topic: 'โปรโมชันและส่วนลดล่าสุด' },
      { key: 'how-to-order', name: '🧾・วิธีสั่งซื้อ', access: 'readonly', topic: 'ขั้นตอนการสั่งซื้อสินค้า' },
      { key: 'payment', name: '💳・ช่องทางชำระเงิน', access: 'readonly', topic: 'ช่องทางการชำระเงิน ห้ามส่งสลิปหรือข้อมูลส่วนตัวในห้องสาธารณะ' },
      { key: 'reviews', name: '⭐・รีวิวจากลูกค้า', access: 'public', topic: 'แชร์รีวิวหลังได้รับสินค้า' },
      { key: 'questions', name: '❓・สอบถามสินค้า', access: 'public', topic: 'สอบถามเรื่องสินค้า ห้ามลงข้อมูลส่วนตัวในห้องนี้' },
    ],
  },
  {
    key: 'cat-chat',
    name: '💬 พูดคุย',
    channels: [
      { key: 'general', name: '💬・พูดคุยทั่วไป', access: 'public', topic: 'พูดคุยเรื่องทั่วไปได้เลย' },
      { key: 'media', name: '📷・แชร์รูปภาพ', access: 'public', topic: 'แชร์รูปภาพและคลิป' },
      { key: 'suggestions', name: '💡・เสนอแนะ', access: 'public', topic: 'เสนอไอเดียให้ร้านและเซิร์ฟเวอร์' },
      { key: 'voice-chat', name: '🔊 พูดคุย', access: 'public', voice: true },
      { key: 'voice-music', name: '🎵 ฟังเพลง', access: 'public', voice: true },
    ],
  },
  {
    key: 'cat-bot',
    name: '🤖 บอท',
    channels: [
      { key: 'bot-notify', name: '🔔・แจ้งเตือนจากบอท', access: 'readonly', topic: 'บอทแจ้งสถานะและข่าวสารของเซิร์ฟเวอร์' },
      { key: 'bot-commands', name: '⌨️・ใช้คำสั่งบอท', access: 'public', topic: 'ห้องสำหรับพิมพ์คำสั่งบอท' },
    ],
  },
  {
    key: 'cat-staff',
    name: '🔒 ทีมงาน',
    access: 'staff',
    channels: [
      { key: 'staff-chat', name: '🛡️・แชททีมงาน', access: 'staff', topic: 'พูดคุยภายในทีมงาน' },
      { key: 'log-messages', name: '📝・log-ข้อความ', access: 'log', topic: 'ข้อความที่ถูกแก้ไขหรือลบ' },
      { key: 'log-members', name: '👥・log-สมาชิก', access: 'log', topic: 'สมาชิกเข้าออก เปลี่ยนชื่อ เปลี่ยนยศ เตะ แบน' },
      { key: 'log-server', name: '⚙️・log-เซิร์ฟเวอร์', access: 'log', topic: 'การเปลี่ยนแปลงห้อง ยศ อิโมจิ และการตั้งค่าเซิร์ฟเวอร์' },
      { key: 'log-voice', name: '🎙️・log-ห้องเสียง', access: 'log', topic: 'การเข้าออกและย้ายห้องเสียง' },
    ],
  },
];
