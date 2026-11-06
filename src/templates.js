// เทมเพลตห้องที่ใช้ได้กับ npm run setup และ /template
// key ใช้อ้างอิงห้องตอนรันซ้ำ จึงเปลี่ยนชื่อห้องได้โดยไม่สร้างห้องใหม่ แต่ห้ามเปลี่ยน key
// หมวดข้อมูล บอท และทีมงานใช้ key ร่วมกันทุกเทมเพลต เพราะบอทต้องใช้ห้องเหล่านี้
//
// access:
//   public   ทุกคนพิมพ์ได้
//   readonly ทุกคนอ่านได้ ทีมงานกับบอทพิมพ์ได้
//   staff    เห็นเฉพาะทีมงานกับบอท
//   log      เห็นเฉพาะทีมงาน พิมพ์ได้เฉพาะบอท

const INFO = {
  key: 'cat-info',
  name: '📌 ข้อมูลเซิร์ฟเวอร์',
  channels: [
    { key: 'announcements', name: '📢・ประกาศ', access: 'readonly', topic: 'ข่าวสารและประกาศ' },
    { key: 'rules', name: '📜・กฎของเซิร์ฟเวอร์', access: 'readonly', topic: 'กรุณาอ่านกฎก่อนใช้งาน' },
    { key: 'welcome', name: '👋・ยินดีต้อนรับ', access: 'readonly', topic: 'บอทจะทักทายสมาชิกใหม่ที่ห้องนี้' },
  ],
};

const SUPPORT = {
  key: 'cat-support',
  name: '🎫 ติดต่อทีมงาน',
  channels: [
    { key: 'ticket-panel', name: '🎫・เปิดทิกเก็ต', access: 'readonly', topic: 'เลือกหัวข้อจากเมนูเพื่อเปิดห้องคุยส่วนตัวกับทีมงาน' },
  ],
};

// บอทสร้างห้องทิกเก็ตไว้ในหมวดนี้ เทมเพลตจึงไม่มีห้องของตัวเอง
const TICKETS = {
  key: 'cat-tickets',
  name: '📂 ทิกเก็ตที่เปิดอยู่',
  access: 'staff',
  channels: [],
};

const BOT = {
  key: 'cat-bot',
  name: '🤖 บอท',
  channels: [
    { key: 'bot-notify', name: '🔔・แจ้งเตือนจากบอท', access: 'readonly', topic: 'บอทแจ้งสถานะและข่าวสารของเซิร์ฟเวอร์' },
    { key: 'bot-commands', name: '⌨️・ใช้คำสั่งบอท', access: 'public', topic: 'ห้องสำหรับพิมพ์คำสั่งบอท' },
    { key: 'level-up', name: '🆙・เลเวลอัป', access: 'readonly', topic: 'แสดงความยินดีเมื่อสมาชิกเลเวลอัป พิมพ์ /rank เพื่อดูเลเวลของตัวเอง' },
  ],
};

const STAFF = {
  key: 'cat-staff',
  name: '🔒 ทีมงาน',
  access: 'staff',
  channels: [
    { key: 'staff-chat', name: '🛡️・แชททีมงาน', access: 'staff', topic: 'พูดคุยภายในทีมงาน' },
    { key: 'log-messages', name: '📝・log-ข้อความ', access: 'log', topic: 'ข้อความที่ถูกแก้ไขหรือลบ' },
    { key: 'log-members', name: '👥・log-สมาชิก', access: 'log', topic: 'สมาชิกเข้าออก เปลี่ยนชื่อ เปลี่ยนยศ เตะ แบน' },
    { key: 'log-server', name: '⚙️・log-เซิร์ฟเวอร์', access: 'log', topic: 'การเปลี่ยนแปลงห้อง ยศ อิโมจิ และการตั้งค่าเซิร์ฟเวอร์' },
    { key: 'log-voice', name: '🎙️・log-ห้องเสียง', access: 'log', topic: 'การเข้าออกและย้ายห้องเสียง' },
    { key: 'log-tickets', name: '🎫・log-ทิกเก็ต', access: 'log', topic: 'การเปิด ปิด และประวัติแชทของทิกเก็ต' },
  ],
};

const withSystem = (...categories) => [INFO, ...categories, SUPPORT, TICKETS, BOT, STAFF];

export const TEMPLATES = [
  {
    id: 'shop',
    emoji: '🛒',
    name: 'ร้านค้า',
    description: 'ห้องแสดงสินค้า โปรโมชัน วิธีสั่งซื้อ รีวิว และห้องพูดคุยกับลูกค้า',
    categories: withSystem(
      {
        key: 'cat-shop',
        name: '🛒 ร้านค้า',
        channels: [
          { key: 'products', name: '🛍️・สินค้าทั้งหมด', access: 'readonly', topic: 'รายการสินค้าและราคา' },
          { key: 'promotions', name: '🔥・โปรโมชัน', access: 'readonly', topic: 'โปรโมชันและส่วนลดล่าสุด' },
          { key: 'how-to-order', name: '🧾・วิธีสั่งซื้อ', access: 'readonly', topic: 'ขั้นตอนการสั่งซื้อสินค้า สั่งซื้อผ่านทิกเก็ตในหมวดติดต่อทีมงาน' },
          { key: 'payment', name: '💳・ช่องทางชำระเงิน', access: 'readonly', topic: 'ช่องทางการชำระเงิน ส่งสลิปในทิกเก็ตเท่านั้น ห้ามส่งในห้องสาธารณะ' },
          { key: 'reviews', name: '⭐・รีวิวจากลูกค้า', access: 'public', topic: 'แชร์รีวิวหลังได้รับสินค้า' },
          { key: 'questions', name: '❓・สอบถามสินค้า', access: 'public', topic: 'สอบถามเรื่องสินค้า เรื่องส่วนตัวหรือการสั่งซื้อให้เปิดทิกเก็ต' },
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
    ),
  },
  {
    id: 'community',
    emoji: '🌐',
    name: 'คอมมูนิตี้',
    description: 'ห้องแชท แนะนำตัว แชร์ผลงาน กิจกรรม และห้องเสียงสำหรับนั่งเล่น',
    categories: withSystem(
      {
        key: 'community-cat-main',
        name: '🌐 คอมมูนิตี้',
        channels: [
          { key: 'community-general', name: '💬・แชททั่วไป', access: 'public', topic: 'คุยได้ทุกเรื่อง' },
          { key: 'community-intro', name: '🙋・แนะนำตัว', access: 'public', topic: 'มาทำความรู้จักกัน' },
          { key: 'community-media', name: '📸・รูปและคลิป', access: 'public', topic: 'แชร์รูปภาพและคลิป' },
          { key: 'community-art', name: '🎨・ผลงานสมาชิก', access: 'public', topic: 'อวดผลงานของคุณ' },
          { key: 'community-events', name: '🎉・กิจกรรม', access: 'readonly', topic: 'กิจกรรมและประกาศรางวัล' },
          { key: 'community-ideas', name: '💡・ไอเดียและข้อเสนอ', access: 'public', topic: 'เสนอสิ่งที่อยากให้มีในเซิร์ฟเวอร์' },
        ],
      },
      {
        key: 'community-cat-voice',
        name: '🔊 ห้องเสียง',
        channels: [
          { key: 'community-voice-lounge', name: '🛋️ ห้องนั่งเล่น', access: 'public', voice: true },
          { key: 'community-voice-music', name: '🎵 ห้องเพลง', access: 'public', voice: true },
          { key: 'community-voice-game', name: '🎮 ห้องเล่นเกม', access: 'public', voice: true },
          { key: 'community-voice-afk', name: '💤 AFK', access: 'public', voice: true },
        ],
      },
    ),
  },
  {
    id: 'gaming',
    emoji: '🎮',
    name: 'เกมมิ่ง',
    description: 'ห้องหาเพื่อนเล่น แรงก์ คลิปไฮไลต์ ข่าวเกม และห้องปาร์ตี้',
    categories: withSystem(
      {
        key: 'gaming-cat-main',
        name: '🎮 เกม',
        channels: [
          { key: 'gaming-lfg', name: '🎮・หาเพื่อนเล่น', access: 'public', topic: 'บอกเกม แรงก์ และเวลาที่อยากเล่น' },
          { key: 'gaming-ranks', name: '🏆・ผลงานและแรงก์', access: 'public', topic: 'อวดแรงก์และผลงาน' },
          { key: 'gaming-clips', name: '📺・คลิปไฮไลต์', access: 'public', topic: 'แชร์คลิปเด็ด' },
          { key: 'gaming-news', name: '📰・ข่าวเกม', access: 'readonly', topic: 'ข่าวและอัปเดตเกม' },
          { key: 'gaming-guides', name: '🛠️・ไกด์และทริค', access: 'public', topic: 'แชร์เทคนิคการเล่น' },
        ],
      },
      {
        key: 'gaming-cat-voice',
        name: '🎧 ปาร์ตี้',
        channels: [
          { key: 'gaming-voice-party-1', name: '🎮 ปาร์ตี้ 1', access: 'public', voice: true },
          { key: 'gaming-voice-party-2', name: '🎮 ปาร์ตี้ 2', access: 'public', voice: true },
          { key: 'gaming-voice-tournament', name: '🏆 ห้องแข่ง', access: 'public', voice: true },
          { key: 'gaming-voice-afk', name: '💤 AFK', access: 'public', voice: true },
        ],
      },
    ),
  },
  {
    id: 'study',
    emoji: '📚',
    name: 'ติวหนังสือ',
    description: 'ห้องถามการบ้าน สรุปเนื้อหา ตารางสอบ และห้องเสียงสำหรับติว',
    categories: withSystem(
      {
        key: 'study-cat-main',
        name: '📚 ห้องเรียน',
        channels: [
          { key: 'study-questions', name: '❓・ถามการบ้าน', access: 'public', topic: 'ถามได้ทุกวิชา' },
          { key: 'study-notes', name: '📝・สรุปเนื้อหา', access: 'public', topic: 'แชร์สรุปและโน้ต' },
          { key: 'study-schedule', name: '📅・ตารางสอบ', access: 'readonly', topic: 'วันสอบและกำหนดส่งงาน' },
          { key: 'study-resources', name: '💡・แหล่งเรียนรู้', access: 'public', topic: 'ลิงก์และแหล่งเรียนรู้ที่น่าสนใจ' },
        ],
      },
      {
        key: 'study-cat-voice',
        name: '🎧 ห้องติว',
        channels: [
          { key: 'study-voice-group-1', name: '📖 ติวกลุ่ม 1', access: 'public', voice: true },
          { key: 'study-voice-group-2', name: '📖 ติวกลุ่ม 2', access: 'public', voice: true },
          { key: 'study-voice-quiet', name: '🤫 ห้องอ่านหนังสือ', access: 'public', voice: true },
        ],
      },
    ),
  },
];

export const findTemplate = (id) => TEMPLATES.find((template) => template.id === id);
