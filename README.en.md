<div align="center">

# 🏪 Builder Discord

**A Discord bot for shop servers. Set up channels and roles with one command, with activity logging, music, and moderation tools built in.**

[![Node.js](https://img.shields.io/badge/Node.js-20.6%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org/)
[![Slash Commands](https://img.shields.io/badge/Slash_Commands-26-FEE75C)](#-commands)
[![Role Levels](https://img.shields.io/badge/Role_Levels-10-57F287)](#-10-role-levels)

[ภาษาไทย](README.md) · **English**

</div>

---

## ✨ Features

| | |
|---|---|
| 🏗️ **Automated server setup** | Creates 5 categories and 21 channels with emoji, topics, and per-channel permissions. Safe to re-run without duplicating channels. |
| 🎭 **10 role levels** | Permissions grow with each level, and new members get a starter role automatically. |
| 📝 **Activity logging** | Records edited and deleted messages, member, voice, and server changes, including who made them. |
| 🎵 **Music** | Plays from SoundCloud with queue, loop, and shuffle. Supports Discord's DAVE voice encryption. |
| 🛡️ **Moderation** | Kick, ban, timeout, clear messages, set levels, and post announcements. Staff can't act on equal or higher roles. |
| 👋 **Welcome and notices** | Greets new members and reports bot status and server boosts. |

## 🗂️ Channel layout

Channel names are in Thai by default.

```text
📌 Server info    📢 Announcements · 📜 Rules · 👋 Welcome
🛒 Shop           🛍️ Products · 🔥 Promotions · 🧾 How to order · 💳 Payment
                  ⭐ Reviews · ❓ Questions
💬 Chat           💬 General · 📷 Media · 💡 Suggestions · 🔊 Voice chat · 🎵 Music
🤖 Bot            🔔 Bot notices · ⌨️ Bot commands
🔒 Staff          🛡️ Staff chat · 📝 Message log · 👥 Member log
                  ⚙️ Server log · 🎙️ Voice log
```

To rename or add channels, edit [`src/layout.js`](src/layout.js) and run `npm run setup` again.

## 🎭 10 role levels

| Level | Role | Adds to the level below |
|---:|---|---|
| 10 | 👑 Shop owner | Manage roles, manage server |
| 9 | 💎 Manager | Manage channels, webhooks |
| 8 | ⚔️ Admin | Ban, mention @everyone, manage emoji and events |
| 7 | 🔨 Moderator | Kick, mute, move voice members, view audit log |
| 6 | 🛡️ Staff | Time out members, change others' nicknames |
| 5 | 🎧 Customer support | Manage messages and threads |
| 4 | 🌟 VIP customer | Private threads, voice messages, soundboard |
| 3 | 🛒 Customer | Create threads, external stickers, create invites |
| 2 | ✅ Member | Attach files, stream, external emoji |
| 1 | 🌱 Newcomer | Send messages, react, join and speak in voice |

Level 5 and above can see the 🔒 Staff category and log channels.

## 💬 Commands

<details open>
<summary><b>📌 General</b></summary>

| Command | Description |
|---|---|
| `/help` | List all commands |
| `/ping` | Check response time |
| `/serverinfo` | Show server info |
| `/userinfo` | Show member info |
| `/avatar` | Show a profile picture |
| `/poll` | Create a poll |
| `/dice` | Roll a die |
| `/coinflip` | Flip a coin |

</details>

<details open>
<summary><b>🎵 Music</b></summary>

| Command | Description |
|---|---|
| `/play` | Play by song name or SoundCloud link |
| `/skip` | Skip the current song |
| `/stop` | Stop, clear the queue, and leave |
| `/pause` · `/resume` | Pause · Resume |
| `/queue` | Show the queue |
| `/nowplaying` | Show the current song |
| `/shuffle` | Shuffle the queue |
| `/loop` | Set the loop mode |

</details>

<details open>
<summary><b>🛡️ Staff</b></summary>

| Command | Description | Minimum role |
|---|---|---:|
| `/clear` | Delete recent messages | Lv.5 |
| `/announce` | Post in the announcements channel | Lv.5 |
| `/timeout` · `/untimeout` | Time out · Remove timeout | Lv.6 |
| `/kick` | Kick a member | Lv.7 |
| `/ban` · `/unban` | Ban · Unban | Lv.8 |
| `/slowmode` | Set channel slowmode | Lv.9 |
| `/setlevel` | Set a member's role level, 1-10 | Lv.10 |

</details>

## 🚀 Getting started

### Requirements

- [Node.js](https://nodejs.org/) 20.6 or later
- A bot from the [Discord Developer Portal](https://discord.com/developers/applications) with **Server Members Intent** and **Message Content Intent** turned on

### Install

```bash
git clone https://github.com/madara1150/builder-discord.git
```

```bash
cd builder-discord
```

```bash
npm install
```

Copy `.env.example` to `.env` and fill it in:

```env
DISCORD_TOKEN=your-bot-token
GUILD_NAME=your-server-name
```

### Set up channels and roles

```bash
npm run setup
```

If the bot isn't in the server or lacks permissions, this prints an invite link. Open it, then run the command again.

### Start the bot

```bash
npm start
```

## 📜 Scripts

| Script | Description |
|---|---|
| `npm run preview` | List roles and channels without connecting to Discord |
| `npm run setup` | Create or update roles and channels. Never deletes existing channels. |
| `npm run setup -- --restrict-everyone` | Same as above, then reduce `@everyone` to read-only |
| `npm start` | Start the bot and register slash commands |

## 📁 Project structure

```text
src/
├── bot.js            Bot startup, logging, and command handling
├── setup.js          Creates roles and channels
├── layout.js         Role and channel definitions
├── roles.js          Assigns and changes roles
├── music.js          Music playback
└── commands/
    ├── index.js      Command list and /help
    ├── general.js    General commands
    ├── music.js      Music commands
    └── moderation.js Staff commands
```

## ⚠️ Good to know

- **The bot must stay running.** Events that happen while it's off aren't logged. With `--restrict-everyone`, new members can't type until the bot is back and assigns their role.
- **Music plays from SoundCloud only.** YouTube isn't supported.
- **The bot can't reorder roles.** If you add a role, drag it into place in Discord.
- **`--restrict-everyone` affects existing members.** Anyone without a level gets ✅ Member, and the old permissions are saved to `everyone-backup.txt`.
- **Never commit `.env`.** If your token leaks, reset it in the Developer Portal right away.
