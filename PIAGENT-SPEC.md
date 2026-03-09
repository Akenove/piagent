# PiAgent — The World's Most Advanced Discord Bot
_Built by Yummy & Pi_

## Identity
- **Name**: PiAgent
- **Tagline**: "Intelligence meets community"
- **Bot User**: pi#2625 (existing)
- **Guild**: 1470856184469782583

## Architecture

### Existing (from the-collective-bot, KEEP ALL)
- Casino: coinflip, blackjack, crash, dice, mines, roulette, slots (provably fair)
- Economy: wallets, transactions, daily claims, stonks market
- Social: onboarding
- Systems: autopost, hall of fame, role sync
- Database: SQLite via better-sqlite3 + Drizzle ORM
- Web dashboard: React + Vite + Hono API

### New Modules to Add

#### 1. 🛡️ Security Module (`src/modules/security/`)
- `antiRaid.ts` — Rate limit detection, mass join detection, auto-lockdown
- `antiNuke.ts` — Permission change monitoring, role deletion protection, channel deletion protection
- `phishing.ts` — URL scanning against phishing databases, homoglyph detection
- `scamDetect.ts` — NLP-based scam message detection using AI
- `altDetect.ts` — Account age checking, suspicious pattern detection
- `verification.ts` — CAPTCHA, button verify, phone verify
- `quarantine.ts` — Isolate suspicious users, restricted role
- `auditLog.ts` — Comprehensive action logging, searchable
- `honeypot.ts` — Bait channels that auto-ban raiders

#### 2. 🤖 AI Module (`src/modules/ai/`)
- `chat.ts` — Multi-model chat (OpenRouter: GPT-4, Claude, Gemini)
- `personality.ts` — Per-server customizable AI personality
- `memory.ts` — Conversation context, user memory per server
- `summarize.ts` — Thread/channel summarization
- `translate.ts` — Real-time translation (100+ languages)
- `moderate.ts` — AI-powered content moderation
- `imageGen.ts` — Image generation via APIs
- `codeAssist.ts` — Code help, syntax highlighting, execution
- `docAnalysis.ts` — PDF/image analysis via vision models

#### 3. 📊 Leveling Module (`src/modules/leveling/`)
- `xpSystem.ts` — Message XP, voice XP, configurable rates
- `rankCard.ts` — Custom rank card image generation (Canvas)
- `leaderboard.ts` — Weekly, monthly, all-time leaderboards
- `roleRewards.ts` — Auto-assign roles at level milestones
- `streaks.ts` — Activity streaks, daily login bonuses
- `antiAbuse.ts` — Spam detection, XP cooldowns

#### 4. 🎵 Music Module (`src/modules/music/`)
- `player.ts` — YouTube, Spotify, SoundCloud, direct URL
- `queue.ts` — Queue management, shuffle, loop, skip
- `filters.ts` — Bass boost, nightcore, vaporwave, 8D
- `lyrics.ts` — Real-time lyrics display
- `radio.ts` — 24/7 radio mode
- `nowPlaying.ts` — Beautiful embed with progress bar

#### 5. 🛠️ Utility Module (`src/modules/utility/`)
- `customCommands.ts` — JavaScript-based custom commands (sandboxed)
- `scheduler.ts` — Scheduled messages, recurring tasks
- `polls.ts` — Advanced polls with multiple choice, timed
- `giveaways.ts` — Giveaway system with requirements
- `tickets.ts` — Support ticket system with categories
- `starboard.ts` — Best messages showcase
- `welcome.ts` — Welcome/leave messages, custom embeds, images
- `reactionRoles.ts` — Button-based reaction roles
- `reminders.ts` — Personal and channel reminders
- `serverStats.ts` — Live stats channels (member count, etc.)
- `backup.ts` — Server config backup/restore
- `afk.ts` — AFK system with auto-response

#### 6. 👨‍💻 Developer Module (`src/modules/developer/`)
- `github.ts` — Webhook handler, PR/issue notifications
- `cicd.ts` — Build status monitoring
- `errorMonitor.ts` — Error tracking and alerts
- `apiStatus.ts` — Monitor external API health
- `codeSnippets.ts` — Syntax highlighted code sharing
- `regex.ts` — Regex tester command
- `jsonFormat.ts` — JSON formatter/validator

#### 7. 📡 Feeds Module (`src/modules/feeds/`)
- `rss.ts` — RSS/Atom feed monitoring
- `twitter.ts` — Twitter/X post monitoring
- `reddit.ts` — Subreddit monitoring
- `youtube.ts` — YouTube upload notifications
- `twitch.ts` — Live stream alerts
- `customWebhook.ts` — Incoming webhook endpoint

#### 8. 🎨 Branding Module (`src/modules/branding/`)
- `embeds.ts` — Consistent embed styling, brand colors
- `components.ts` — Reusable button/select menu components
- `assets.ts` — Bot avatar, banner, thumbnail management

## Tech Stack
- **Runtime**: Node.js 22+ (consider Bun migration later)
- **Language**: TypeScript (strict mode)
- **Framework**: discord.js v14.25+
- **Database**: SQLite (better-sqlite3) + Drizzle ORM
- **Cache**: In-memory Map (upgrade to Redis when needed)
- **AI**: OpenRouter API (multi-model)
- **Web**: React + Vite + Hono
- **Queue**: Custom job queue (upgrade to BullMQ when needed)
- **Image**: @napi-rs/canvas for rank cards

## Module System
Each module follows this pattern:
```typescript
// src/modules/{name}/index.ts
export interface Module {
  name: string;
  description: string;
  commands: Command[];
  events: EventHandler[];
  init(): Promise<void>;
  cleanup(): Promise<void>;
}
```

## Database Schema Extensions
Each module can register its own tables via Drizzle migrations.

## Command Categories
Commands use slash commands with autocomplete where applicable.
Each module registers its own commands in `src/modules/{name}/commands/`.

## Priority Order
1. Module system + plugin architecture
2. Security (anti-raid, anti-nuke, phishing)
3. AI Chat (multi-model, personality)
4. Leveling (XP, rank cards)
5. Utility (welcome, reaction roles, tickets)
6. Music
7. Dev tools
8. Feeds

## Branding
- Primary color: #5865F2 (Discord Blurple) or custom
- Bot name: PiAgent
- Avatar: TBD (generate new)
- Description: "The world's most advanced Discord bot. Intelligence meets community."
