// สร้าง/อัปเดตห้องตาม layout.js รันซ้ำได้ และไม่ลบห้องเดิมของเซิร์ฟเวอร์
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  OAuth2Scopes,
  PermissionFlagsBits as P,
} from 'discord.js';
import { EVERYONE_PERMISSIONS, LAYOUT, ROLE_LEVELS } from './layout.js';
import { assignMissingLevel } from './roles.js';

const CHANNELS_FILE = new URL('../channels.json', import.meta.url);
const EVERYONE_BACKUP_FILE = new URL('../everyone-backup.txt', import.meta.url);

// บอทกำหนดให้ยศได้เฉพาะสิทธิ์ที่ตัวเองมี จึงต้องมีสิทธิ์ครบตามยศสูงสุด แต่ไม่ใช้ Administrator
const BOT_PERMISSIONS = [...new Set([...EVERYONE_PERMISSIONS, ...ROLE_LEVELS[0].permissions])];

const BOT_CHANNEL_ALLOW = [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory];
const NO_POSTING = [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads];

function permissionOverwrites(access, { everyoneId, staffIds, botId }) {
  const bot = { id: botId, allow: BOT_CHANNEL_ALLOW };
  const staff = (overwrite) => staffIds.map((id) => ({ id, ...overwrite }));
  switch (access) {
    case 'readonly':
      return [{ id: everyoneId, deny: NO_POSTING }, ...staff({ allow: [P.SendMessages] }), bot];
    case 'staff':
      return [{ id: everyoneId, deny: [P.ViewChannel] }, ...staff({ allow: [P.ViewChannel] }), bot];
    case 'log':
      return [
        { id: everyoneId, deny: [P.ViewChannel] },
        ...staff({ allow: [P.ViewChannel, P.ReadMessageHistory], deny: NO_POSTING }),
        bot,
      ];
    default:
      return [];
  }
}

// Discord แปลงชื่อห้องข้อความเป็นตัวเล็กและแทนช่องว่างด้วย - จึงต้องเทียบแบบเดียวกัน
const sameName = (a, b) => a.toLowerCase().replaceAll(' ', '-') === b.toLowerCase().replaceAll(' ', '-');

function findExisting(guild, known, item, type) {
  return (
    guild.channels.cache.get(known[item.key]) ??
    guild.channels.cache.find((c) => c.type === type && sameName(c.name, item.name))
  );
}

async function upsert(guild, known, item, options) {
  const existing = findExisting(guild, known, item, options.type);
  const { type, ...changes } = options;
  const channel = existing ? await existing.edit(changes) : await guild.channels.create(options);
  known[item.key] = channel.id;
  console.log(`${existing ? 'อัปเดต' : 'สร้าง  '}  ${item.name}`);
  return channel;
}

async function upsertRoles(guild) {
  const roles = await guild.roles.fetch();
  const levelRoles = [];

  // ยศใหม่จะอยู่ล่างสุดเสมอ และ Discord ไม่ให้บอทย้ายลำดับยศ จึงต้องสร้างจากสูงไปต่ำ
  for (const level of ROLE_LEVELS) {
    const existing = roles.find((r) => r.name === level.name);
    const options = {
      name: level.name,
      colors: { primaryColor: level.color },
      permissions: level.permissions,
      hoist: true,
    };
    const role = existing ? await existing.edit(options) : await guild.roles.create(options);
    levelRoles.push(role);
    console.log(`${existing ? 'อัปเดต' : 'สร้าง  '}  Lv.${level.level} ${level.name}`);
  }

  return levelRoles;
}

// ลด @everyone เหลือแค่อ่าน แล้วให้สิทธิ์พิมพ์มาจากยศแทน ต้องแจกยศก่อนเสมอ ไม่งั้นสมาชิกจะพิมพ์ไม่ได้
async function restrictEveryone(guild) {
  const assigned = await assignMissingLevel(guild, 2);
  console.log(`แจกยศ Lv.2 ให้สมาชิกเดิม ${assigned} คน`);
  if (!existsSync(EVERYONE_BACKUP_FILE)) {
    writeFileSync(EVERYONE_BACKUP_FILE, guild.roles.everyone.permissions.bitfield.toString());
  }
  await guild.roles.everyone.setPermissions(EVERYONE_PERMISSIONS);
  console.log('ลดสิทธิ์ @everyone แล้ว (ค่าเดิมอยู่ใน everyone-backup.txt)');
}

function printPreview() {
  for (const level of ROLE_LEVELS) {
    console.log(`Lv.${level.level} ${level.name}${level.staff ? ' [ทีมงาน]' : ''}  ${level.permissions.length} สิทธิ์`);
  }
  console.log('');
  for (const category of LAYOUT) {
    console.log(category.name);
    for (const c of category.channels) console.log(`  ${c.name}  [${c.voice ? 'เสียง, ' : ''}${c.access}]`);
  }
}

async function login() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  await new Promise((resolve, reject) => {
    client.once('clientReady', resolve);
    client.login(process.env.DISCORD_TOKEN).catch(reject);
  });
  return client;
}

async function run() {
  if (process.argv.includes('--dry-run')) return printPreview();
  if (!process.env.DISCORD_TOKEN) throw new Error('ยังไม่ได้ใส่ DISCORD_TOKEN ในไฟล์ .env');

  const client = await login();
  try {
    const guildName = process.env.GUILD_NAME || 'TEST';
    const matches = client.guilds.cache.filter((g) => g.name === guildName);
    const invite = client.generateInvite({ scopes: [OAuth2Scopes.Bot], permissions: BOT_PERMISSIONS });

    if (matches.size !== 1) {
      console.log(matches.size === 0
        ? `บอทยังไม่ได้อยู่ในเซิร์ฟเวอร์ "${guildName}" เปิดลิงก์นี้เพื่อเชิญบอท แล้วรัน npm run setup อีกครั้ง:\n${invite}`
        : `พบเซิร์ฟเวอร์ชื่อ "${guildName}" ${matches.size} แห่ง กรุณาเชิญบอทไว้แค่แห่งเดียว`);
      return;
    }

    const guild = matches.first();
    await guild.members.fetchMe();
    const missing = guild.members.me.permissions.missing(BOT_PERMISSIONS);
    if (missing.length) {
      console.log(`บอทยังขาดสิทธิ์ ${missing.length} รายการ เปิดลิงก์นี้เพื่ออนุญาตเพิ่ม แล้วรัน npm run setup อีกครั้ง:\n${invite}`);
      return;
    }

    await guild.channels.fetch();
    const levelRoles = await upsertRoles(guild);
    const staffIds = levelRoles.filter((_, index) => ROLE_LEVELS[index].staff).map((role) => role.id);

    const ids = { everyoneId: guild.roles.everyone.id, staffIds, botId: client.user.id };
    const known = existsSync(CHANNELS_FILE) ? JSON.parse(readFileSync(CHANNELS_FILE, 'utf8')) : {};
    const categories = [];

    for (const category of LAYOUT) {
      const parent = await upsert(guild, known, category, {
        name: category.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: permissionOverwrites(category.access, ids),
      });
      categories.push(parent);

      for (const item of category.channels) {
        const options = {
          name: item.name,
          type: item.voice ? ChannelType.GuildVoice : ChannelType.GuildText,
          parent,
          permissionOverwrites: permissionOverwrites(item.access, ids),
        };
        if (item.topic) options.topic = item.topic;
        await upsert(guild, known, item, options);
      }
      writeFileSync(CHANNELS_FILE, JSON.stringify(known, null, 2));
    }

    // ให้หมวดใหม่อยู่บนสุด โดยคงลำดับของหมวดเดิมไว้ต่อท้าย
    const otherCategories = guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildCategory && !categories.some((own) => own.id === c.id))
      .sort((a, b) => a.position - b.position);
    await guild.channels.setPositions(
      [...categories, ...otherCategories.values()].map((channel, position) => ({ channel, position })),
    );

    if (process.argv.includes('--restrict-everyone')) await restrictEveryone(guild);

    const planned = new Set(Object.values(known));
    const others = guild.channels.cache.filter((c) => !planned.has(c.id) && !c.isThread());
    console.log(`\nเสร็จแล้ว: ${planned.size} หมวดหมู่และห้อง`);
    if (others.size) {
      console.log(`ห้องเดิมที่ไม่ได้แตะ: ${others.map((c) => c.name).join(', ')}`);
    }
  } finally {
    await client.destroy();
  }
}

run().catch((error) => {
  console.error(error.message, error.method ?? '', error.url ?? '');
  process.exitCode = 1;
});
