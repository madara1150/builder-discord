// สร้างไฟล์ HTML ประวัติแชทของทิกเก็ต เปิดอ่านในเบราว์เซอร์ได้
const escape = (text) =>
  String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const time = (date) => date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });

// แปลง mention และลิงก์ให้อ่านง่าย โดย escape ก่อนเสมอ
function formatContent(message) {
  let html = escape(message.content);
  html = html.replace(/&lt;@!?(\d+)&gt;/g, (_, id) => {
    const user = message.mentions.users.get(id);
    return `<span class="mention">@${escape(user?.username ?? id)}</span>`;
  });
  html = html.replace(/&lt;#(\d+)&gt;/g, (_, id) => `<span class="mention">#${escape(message.guild?.channels.cache.get(id)?.name ?? id)}</span>`);
  html = html.replace(/&lt;@&amp;(\d+)&gt;/g, (_, id) => `<span class="mention">@${escape(message.guild?.roles.cache.get(id)?.name ?? id)}</span>`);
  // ไม่รวม &lt; &gt; ที่ escape แล้ว เพราะ Discord ใช้ <ลิงก์> เพื่อปิดตัวอย่างลิงก์
  html = html.replace(/https?:\/\/(?:(?!&gt;|&lt;)[^\s<])+/g, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  return html.replace(/\n/g, '<br>');
}

function renderMessage(message) {
  const author = message.member?.displayName ?? message.author.username;
  const attachments = [...message.attachments.values()].map((file) =>
    file.contentType?.startsWith('image/')
      ? `<a href="${escape(file.url)}" target="_blank" rel="noopener"><img class="attachment" src="${escape(file.url)}" alt="${escape(file.name)}"></a>`
      : `<a class="file" href="${escape(file.url)}" target="_blank" rel="noopener">📎 ${escape(file.name)}</a>`).join('');
  const embeds = message.embeds.map((embed) => `
      <div class="embed" style="border-color:${embed.hexColor ?? '#4e5058'}">
        ${embed.title ? `<div class="embed-title">${escape(embed.title)}</div>` : ''}
        ${embed.description ? `<div class="embed-body">${escape(embed.description).replace(/\n/g, '<br>')}</div>` : ''}
        ${embed.fields.map((f) => `<div class="embed-field"><b>${escape(f.name)}</b><br>${escape(f.value).replace(/\n/g, '<br>')}</div>`).join('')}
      </div>`).join('');
  return `
    <div class="message">
      <img class="avatar" src="${escape(message.author.displayAvatarURL({ size: 64 }))}" alt="">
      <div class="body">
        <div class="meta"><span class="author">${escape(author)}</span>${message.author.bot ? '<span class="bot">BOT</span>' : ''}<span class="time">${time(message.createdAt)}</span></div>
        ${message.content ? `<div class="content">${formatContent(message)}</div>` : ''}
        ${attachments}${embeds}
      </div>
    </div>`;
}

export function renderTranscript({ guildName, title, subtitle, messages }) {
  const people = new Set(messages.filter((m) => !m.author.bot).map((m) => m.author.id)).size;
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · ${escape(guildName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #313338; color: #dbdee1; font: 15px/1.5 Kanit, "Segoe UI", sans-serif; }
  header { background: linear-gradient(135deg, #5865f2, #3c45a5); padding: 28px 24px; }
  header h1 { margin: 0; color: #fff; font-size: 26px; font-weight: 600; }
  header p { margin: 4px 0 0; color: rgba(255,255,255,.85); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .chip { background: rgba(0,0,0,.25); color: #fff; border-radius: 999px; padding: 4px 14px; font-size: 13px; }
  main { max-width: 920px; margin: 0 auto; padding: 12px 16px 40px; }
  .message { display: flex; gap: 14px; padding: 10px 8px; border-radius: 8px; }
  .message:hover { background: #2e3035; }
  .avatar { width: 42px; height: 42px; border-radius: 50%; flex: none; background: #5865f2; }
  .body { min-width: 0; flex: 1; }
  .meta { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .author { color: #f2f3f5; font-weight: 600; }
  .bot { background: #5865f2; color: #fff; font-size: 10px; border-radius: 4px; padding: 0 5px; }
  .time { color: #949ba4; font-size: 12px; }
  .content { word-wrap: break-word; overflow-wrap: anywhere; }
  .mention { background: rgba(88,101,242,.3); color: #c9cdfb; border-radius: 3px; padding: 0 2px; }
  a { color: #00a8fc; }
  .attachment { display: block; max-width: min(100%, 400px); max-height: 300px; border-radius: 8px; margin-top: 6px; }
  .file { display: inline-block; margin-top: 6px; background: #2b2d31; border: 1px solid #1e1f22; border-radius: 6px; padding: 6px 10px; }
  .embed { margin-top: 6px; background: #2b2d31; border-left: 4px solid; border-radius: 4px; padding: 10px 14px; max-width: 520px; }
  .embed-title { color: #f2f3f5; font-weight: 600; }
  .embed-field { margin-top: 6px; }
  footer { text-align: center; color: #949ba4; font-size: 12px; padding: 20px; }
</style>
</head>
<body>
<header>
  <h1>🎫 ${escape(title)}</h1>
  <p>${escape(subtitle)} · ${escape(guildName)}</p>
  <div class="chips">
    <span class="chip">💬 ${messages.length} ข้อความ</span>
    <span class="chip">👥 ${people} คน</span>
    ${messages[0] ? `<span class="chip">🕒 ${time(messages[0].createdAt)} – ${time(messages.at(-1).createdAt)}</span>` : ''}
  </div>
</header>
<main>${messages.map(renderMessage).join('')}</main>
<footer>บันทึกเมื่อ ${time(new Date())} · ลิงก์รูปและไฟล์แนบอาจหมดอายุหลังห้องถูกลบ</footer>
</body>
</html>`;
}
