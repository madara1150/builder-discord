// สร้าง/อัปเดตยศและห้องตามเทมเพลต รันซ้ำได้ และไม่ลบห้องเดิมของเซิร์ฟเวอร์
// เลือกเทมเพลตด้วย --template=<id> (ค่าเริ่มต้น shop)
import { existsSync, writeFileSync } from 'node:fs';
import { Client, GatewayIntentBits, OAuth2Scopes } from 'discord.js';
import { applyPlan, planTemplate } from './builder.js';
import { EVERYONE_PERMISSIONS, ROLE_LEVELS } from './layout.js';
import { assignMissingLevel } from './roles.js';
import { channels } from './store.js';
import { TEMPLATES, findTemplate } from './templates.js';
import { ensureTicketPanel } from './tickets.js';

const EVERYONE_BACKUP_FILE = new URL('../everyone-backup.txt', import.meta.url);

// บอทกำหนดให้ยศได้เฉพาะสิทธิ์ที่ตัวเองมี จึงต้องมีสิทธิ์ครบตามยศสูงสุด แต่ไม่ใช้ Administrator
const BOT_PERMISSIONS = [...new Set([...EVERYONE_PERMISSIONS, ...ROLE_LEVELS[0].permissions])];

const STATUS = { create: 'สร้าง  ', update: 'อัปเดต', keep: 'คงเดิม' };

async function upsertRoles(guild) {
  const roles = await guild.roles.fetch();

  // ยศใหม่จะอยู่ล่างสุดเสมอ และ Discord ไม่ให้บอทย้ายลำดับยศ จึงต้องสร้างจากสูงไปต่ำ
  for (const level of ROLE_LEVELS) {
    const existing = roles.find((r) => r.name === level.name);
    const options = {
      name: level.name,
      colors: { primaryColor: level.color },
      permissions: level.permissions,
      hoist: true,
    };
    if (existing) await existing.edit(options);
    else await guild.roles.create(options);
    console.log(`${existing ? 'อัปเดต' : 'สร้าง  '}  Lv.${level.level} ${level.name}`);
  }
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

function printPreview(template) {
  for (const level of ROLE_LEVELS) {
    console.log(`Lv.${level.level} ${level.name}${level.staff ? ' [ทีมงาน]' : ''}  ${level.permissions.length} สิทธิ์`);
  }
  console.log(`\nเทมเพลต ${template.emoji} ${template.name} (${template.id})`);
  for (const category of template.categories) {
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
  const templateId = process.argv.find((arg) => arg.startsWith('--template='))?.split('=')[1] ?? 'shop';
  const template = findTemplate(templateId);
  if (!template) throw new Error(`ไม่มีเทมเพลต "${templateId}" เลือกได้: ${TEMPLATES.map((t) => t.id).join(', ')}`);

  if (process.argv.includes('--dry-run')) return printPreview(template);
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
    await upsertRoles(guild);
    await guild.roles.fetch();

    const plan = planTemplate(guild, template, client.user.id);
    await applyPlan(guild, plan, (_, __, step) => console.log(`${STATUS[step.action]}  ${step.item.name}`));

    if (await ensureTicketPanel(client)) console.log('โพสต์แผงเปิดทิกเก็ตแล้ว');

    if (process.argv.includes('--restrict-everyone')) await restrictEveryone(guild);

    const planned = new Set(Object.values(channels));
    const others = guild.channels.cache.filter((c) => !planned.has(c.id) && !c.isThread());
    console.log(`\nเสร็จแล้ว: สร้าง ${plan.counts.create} · อัปเดต ${plan.counts.update} · คงเดิม ${plan.counts.keep}`);
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
