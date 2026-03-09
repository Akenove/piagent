<p align="center">
  <img src=".github/banner.png" alt="piagent" width="100%">
</p>

# piagent 🥧

The discord bot that does everything, and does it better than the ones charging you $12/month. Built for high-performance servers that need security, ai, and engagement in one package.

## features

### 🛡️ security & protection
- **anti-raid**: advanced mass join detection and automatic server lockdown
- **anti-nuke**: real-time permission abuse monitoring with instant attacker perm stripping
- **phishing protection**: url scanning, homoglyph detection, and malicious link blocking
- **verification**: seamless button-based entry with configurable account age gates
- **audit system**: detailed logging of all critical server events

### 🤖 ai integration
- **multi-model chat**: support for gpt-4o, claude sonnet, and gemini via openrouter
- **per-server personality**: define how the bot speaks in your server
- **conversation memory**: keeps context of users' messages for a smarter chat experience
- **summarization**: quickly get the gist of long threads or channels
- **translation**: support for over 100+ languages

### 📊 leveling & xp
- **advanced leveling**: configurable message and voice xp with cooldowns
- **dynamic rank cards**: custom-generated canvas cards for every user
- **leaderboards**: track engagement by week, month, or all-time
- **role rewards**: automatic role distribution at level milestones

### 💰 economy & engagement
- **engagement games**: coinflip, blackjack, crash, dice, and more
- **provably fair**: all games use seeds for verifiable randomness
- **virtual economy**: rewards, transfers, and a virtual stonks market to keep the server active

### 🛠️ server utility
- **reaction roles**: easy button-based role management
- **ticket system**: streamlined support tickets for staff
- **engagement tools**: polls, giveaways, starboard, and reminders

## setup

```bash
git clone https://github.com/Akenove/piagent.git
cd piagent
npm install
cp .env.example .env  # fill in your tokens
npm run build
npm start
```

## tech stack
- typescript + discord.js v14
- sqlite (better-sqlite3) + drizzle orm
- openrouter for ai orchestration
- @napi-rs/canvas for dynamic imaging
- react + vite + hono for the web dashboard

## license
MIT
