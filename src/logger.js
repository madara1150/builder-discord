// ส่งข้อความเข้าห้องต่างๆ และจัดรูปแบบ Log ให้เหมือนกันทุกห้อง
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { channels } from './store.js';

export const COLOR = { info: 0x5865f2, good: 0x57f287, warn: 0xfee75c, bad: 0xed4245 };
export const CARD_ACCENT = { info: '#5865f2', good: '#57f287', warn: '#fee75c', bad: '#ed4245' };

// ชื่อหมวดที่ท้าย Log ช่วยให้รู้ว่าเป็น Log ประเภทไหนเมื่อเห็นในการแจ้งเตือน
const CATEGORY = {
  'log-messages': '📝 Log ข้อความ',
  'log-members': '👥 Log สมาชิก',
  'log-server': '⚙️ Log เซิร์ฟเวอร์',
  'log-voice': '🎙️ Log ห้องเสียง',
  'log-tickets': '🎫 Log ทิกเก็ต',
};

export function createLogger(client) {
  async function send(key, payload) {
    try {
      const channel = client.channels.cache.get(channels[key]) ?? await client.channels.fetch(channels[key]);
      return await channel.send({ allowedMentions: { parse: [] }, ...payload });
    } catch (error) {
      console.error(`ส่งไปห้อง ${key} ไม่สำเร็จ: ${error.message}`);
      return null;
    }
  }

  // description: ประโยคสรุปว่าใครทำอะไร · actor: คนทำ (แสดงที่หัว) · thumbnail: รูปเป้าหมาย
  // image: รูป PNG ที่แนบเป็นภาพหลัก · files: ไฟล์แนบอื่น · footer: ข้อมูลเสริมต่อท้ายชื่อหมวด
  async function log(key, color, title, description, fields = [], { actor, thumbnail, image, footer, files: extraFiles = [] } = {}) {
    const embed = new EmbedBuilder()
      .setColor(COLOR[color])
      .setTitle(title)
      .setDescription(description || null)
      .addFields(fields)
      .setFooter({ text: [CATEGORY[key], footer].filter(Boolean).join('  ·  ') || null })
      .setTimestamp();
    if (actor) embed.setAuthor({ name: actor.displayName ?? actor.username, iconURL: actor.displayAvatarURL() });
    if (thumbnail) embed.setThumbnail(thumbnail);

    const files = [...extraFiles];
    if (image) {
      files.push(new AttachmentBuilder(image, { name: 'log.png' }));
      embed.setImage('attachment://log.png');
    }
    return send(key, { embeds: [embed], files });
  }

  return { send, log };
}
