import dotenv from 'dotenv';
dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN!,
  guildId: process.env.GUILD_ID!,
  categoryId: process.env.CATEGORY_ID || '1477777771382968482',
  clientId: process.env.CLIENT_ID!,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://collective:collective@localhost:5432/collective',
  masterKey: process.env.MASTER_KEY!,
  
  // Economy
  startingShards: 500,
  dailyReward: { min: 50, max: 200 },
  minBet: 1,
  maxBet: 50000,
  
  // Withdrawal
  withdrawal: {
    min: 100,
    max: 10000,
    cooldownMs: 24 * 60 * 60 * 1000, // 24h
    maxPerDay: 1,
    minAccountAgeDays: 7,
    minGamesPlayed: 10,
    maxBalancePercent: 0.8,
    maxRiskScore: 50,
  },
  
  // House Edge
  houseEdge: {
    coinflip: 0.02,    // 2% → 1.96x payout
    dice: 0.01,         // 1%
    crash: 0.01,        // 1%
    roulette: 0.027,    // 2.7% (European)
    slots: 0.05,        // 5%
    mines: 0.02,        // 2%
  },
  
  // Roles
  roles: {
    member: 'Collective Member',
    highRoller: 'High Roller',
    council: 'Council Member',
    admin: 'Collective Admin',
  },
};
