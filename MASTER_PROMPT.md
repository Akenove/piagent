# THE COLLECTIVE — Master Build Spec v2.0

## Project
Path: /Users/arvin2/Projects/the-collective-bot/
Bot: pi#2625 — PM2 name: "the-collective"
Guild: 1470856184469782583 | Category: 1477777771382968482

## Already Exists (DO NOT recreate)
- src/config.ts, src/database/db.ts, src/games/provably-fair.ts
- src/services/crypto.ts, src/index.ts, src/events/interactionCreate.ts
- src/commands/index.ts, src/commands/onboarding.ts
- src/commands/casino/coinflip.ts
- 49 channels deployed in Discord

## STEP 1: Switch to SQLite (PostgreSQL not running)
npm install better-sqlite3 @types/better-sqlite3
Rewrite src/database/db.ts:
- Use better-sqlite3 (sync, no pool needed)
- DB file: ./data/collective.db (create dir if needed)
- Keep same export interface: query(), transaction(), initDatabase()
- Tables: wallets, transactions, bets, server_seeds, daily_claims, stonks, role_assignments

Wallet table:
  wallet_id TEXT PRIMARY KEY,
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  balance INTEGER DEFAULT 500,
  risk_score INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  total_wagered INTEGER DEFAULT 0,
  biggest_win INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  last_active INTEGER DEFAULT (unixepoch())

Transactions:
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id TEXT, type TEXT, amount INTEGER,
  balance_before INTEGER, balance_after INTEGER,
  reference_id TEXT, metadata TEXT, created_at INTEGER DEFAULT (unixepoch())

Bets:
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id TEXT, game TEXT, bet_amount INTEGER,
  payout INTEGER, multiplier REAL, server_seed_hash TEXT,
  client_seed TEXT, nonce INTEGER, outcome_data TEXT,
  created_at INTEGER DEFAULT (unixepoch())

server_seeds:
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seed_hash TEXT, revealed_seed TEXT,
  active INTEGER DEFAULT 1, created_at INTEGER DEFAULT (unixepoch())

daily_claims:
  wallet_id TEXT PRIMARY KEY, claimed_at INTEGER

## STEP 2: All Commands

Create these (each: SlashCommandBuilder + async execute(interaction)):

### src/commands/core/balance.ts
/balance → ephemeral embed: balance 💎, games played, win rate, rank #N
Query: SELECT wallet, count bets, sum wins

### src/commands/core/daily.ts  
/daily → check daily_claims, 24h cooldown
Success: +500 SHARDS, record in daily_claims, log transaction
Fail: "Come back in Xh Ym" (ephemeral)

### src/commands/core/profile.ts
/profile [user?] → public embed with stats
If no user: show caller. If user mentioned: show that user.
Stats: balance, games, win rate, biggest win, member since, rank

### src/commands/core/transfer.ts
/transfer <user> <amount>
Atomic: deduct sender → add receiver → log both
Validate: enough balance, valid amount (>0, ≤balance), receiver has wallet

### src/commands/core/history.ts
/history → ephemeral embed, last 10 bets
Show: game, bet, payout, result, when

### src/commands/casino/dice.ts
/dice <amount> <target>
target: 2-95 (int), roll 1-100
Win if roll < target. Payout = floor(98/target * amount)
House edge 2%. Show roll result, target, payout.

### src/commands/casino/slots.ts
/slots <amount>
Reels: 🍒🍊🍋🍇💎🎰7️⃣ (7 symbols)
Provably fair reel selection
Payouts: 777=50x, 💎💎💎=25x, 🎰🎰🎰=15x, 3x same=8x, 2x same=1.5x, else lose
Animated: show reels spinning (edit embed 2x with 🔄 then reveal)

### src/commands/casino/crash.ts
/crash <amount> <cashout>
cashout: 1.01-100.00 multiplier (auto cashout point)
Generate crash point via provably fair
If crash_point >= cashout: win cashout×amount
If crash_point < cashout: lose
ASCII crash graph in embed

### src/commands/casino/roulette.ts
/roulette <amount> <bet>
bet options: red|black|green|odd|even|low|high|0-36
Payouts: red/black/odd/even/low/high = 2x, green(0) = 14x, straight = 36x
Show spinning wheel animation (2 embed edits then result)

### src/commands/economy/leaderboard.ts
/leaderboard [by?]
by: balance(default)|wins|games|wagered
Top 10 embed. Show caller's rank even if not top 10.

### src/commands/fair/verify.ts
/verify <bet_id>
Show: server_seed_hash, client_seed, nonce, computed result
Manual verification instructions
"Verified ✅" or "Cannot verify ❌"

### src/commands/fair/seeds.ts
/seeds
Show current: server_seed_hash, client_seed, nonce counter
Button: "Change Client Seed" → modal → update in DB

### src/commands/admin/grant.ts
/admin grant <user> <amount> [reason?]
Requires PermissionFlagsBits.Administrator
Atomic add to balance, log transaction

## STEP 3: Auto-events

### src/systems/autopost.ts
On ready, set up intervals:
- Every 3 hours: random airdrop to 3 active wallets (100-500 SHARDS each)
  Post to channel named 'airdrops'
- Every day at 09:00 UTC: post daily challenge to 'daily-challenges' channel
  Challenges rotate: "Play 5 games", "Win 3 coinflips", "Reach 5k balance"
- Every 30 min: update #server-pulse with live stats embed
  Stats: total wallets, active today, total SHARDS circulating, games today
- Every 1 min: update leaderboard channel top-3 (edit existing message, no spam)

### src/systems/roleSync.ts
After every balance change:
- < 100 SHARDS: role "Broke" (gray)
- 100-9,999: role "Degen" (green) 
- 10,000-49,999: role "Whale" (blue)
- 50,000+: role "Shark" (purple)
- Create roles if they don't exist
- Assign correct role, remove others

### src/systems/hallOfFame.ts
After every bet resolves:
- Win > 5,000: post to #moonshots channel
- Loss > 2,000: post to #hall-of-rekt channel
Both auto-posted by bot with fun embed

## STEP 4: Web Dashboard

### Express server: src/api/server.ts
Port: process.env.WEB_PORT || 3001
Serve static files from ./web/
Routes: /auth/discord, /auth/callback, /api/*

### src/api/routes/auth.ts
GET /auth/discord → redirect to Discord OAuth2
  Scopes: identify
  State: CSRF token in cookie
GET /auth/callback → exchange code for token, fetch user, set JWT cookie
GET /auth/logout → clear cookie

### src/api/routes/api.ts
All routes require JWT middleware (read cookie, verify, attach user)
GET /api/me → wallet stats for logged in user
GET /api/leaderboard → top 20 by balance
GET /api/history → last 50 bets for user
GET /api/feed → last 20 public bets (anonymized amounts only)
GET /api/stats → server-wide stats

### web/index.html
Landing page:
- Full screen dark (#0a0a0f background)
- Centered: "THE COLLECTIVE" in large glitch-effect text
- Subtitle: "The crypto degen command center"
- Animated stats ticker: total wallets, total SHARDS, games today
- Big "LOGIN WITH DISCORD" button → /auth/discord
- Below: 6 feature cards (Tools, Casino, Economy, DAO, Pi OS, Marketplace)
- Footer: "Powered by Pi OS"

### web/dashboard.html
Dashboard (after login):
- Left sidebar: nav links (Overview, Wallet, Casino, History, Leaderboard, Verify)
- Top bar: Discord avatar, username, balance in big text
- Main area: 
  * Balance card (big, with sparkline)
  * Recent bets table (last 10)
  * Live feed (SSE: new bets streaming in)
  * Leaderboard preview (top 5)
- Quick actions: "Claim Daily" button (calls /api/daily), 
  "Play Coinflip" (shows bet modal)
- Real-time balance via SSE /api/events

### web/css/style.css
- --bg: #0a0a0f
- --card: rgba(255,255,255,0.05) + backdrop-filter: blur(10px)
- --accent: #06b6d4 (cyan)
- --accent2: #7c3aed (purple)
- --text: #e2e8f0
- --success: #10b981
- --danger: #ef4444
- Glitch animation for title
- Smooth hover transitions on cards
- Custom scrollbar
- Mobile responsive

### web/js/app.js
- Login check (redirect if no cookie)
- Fetch /api/me on load
- Fetch /api/leaderboard
- SSE: listen /api/events for live updates
- Daily claim button handler
- Format numbers with commas

## STEP 5: Update index.ts

Add to ready event:
- Start auto-events (autopost)
- Start Express web server (src/api/server.ts)
- Log web URL

Update command handler to route ALL new commands.

## STEP 6: Update commands/index.ts

Register ALL new commands:
balance, daily, profile, transfer, history,
dice, slots, crash, roulette,
leaderboard, verify, seeds,
admin (with subcommand grant)

## NOTES
- npm install: better-sqlite3 @types/better-sqlite3 express cors jsonwebtoken @types/jsonwebtoken @types/express @types/cors
- npx tsc --noEmit to check errors before running
- pm2 restart the-collective after done
- Discord OAuth2 redirect URI: http://localhost:3001/auth/callback
  (register this in Discord Developer Portal → OAuth2 → Redirects)

## WHEN DONE
Run: openclaw system event --text "The Collective v2.0 complete: SQLite + all commands + web dashboard live on port 3001" --mode now
