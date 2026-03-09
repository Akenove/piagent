import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface TransactionClient {
  query: <T = any>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
}

let sqlite: Database.Database | null = null;
let orm: ReturnType<typeof drizzle> | null = null;

function getDbPath(): string {
  return path.resolve(process.cwd(), 'data', 'collective.db');
}

export function getSqlite(): Database.Database {
  if (sqlite) return sqlite;

  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return sqlite;
}

export function getDrizzle() {
  if (!orm) {
    orm = drizzle(getSqlite());
  }
  return orm;
}

function compileSql(text: string, params: unknown[]): { sql: string; values: unknown[] } {
  const positions: number[] = [];
  const sql = text
    .replace(/\$([0-9]+)/g, (_m, idx) => {
      positions.push(Number(idx));
      return '?';
    })
    .replace(/\bNOW\(\)/gi, 'unixepoch()');

  const values = positions.length > 0 ? positions.map((p) => params[p - 1]) : params;
  return { sql, values };
}

async function execute<T = any>(db: Database.Database, text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const { sql, values } = compileSql(text, params);
  const stmt = db.prepare(sql);
  const keyword = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? '';

  if (keyword === 'SELECT' || keyword === 'PRAGMA' || keyword === 'WITH') {
    const rows = stmt.all(...values) as T[];
    return { rows, rowCount: rows.length };
  }

  if (/\bRETURNING\b/i.test(sql)) {
    const rows = stmt.all(...values) as T[];
    return { rows, rowCount: rows.length };
  }

  const info = stmt.run(...values);
  return { rows: [], rowCount: info.changes };
}

export async function query<T = any>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return execute<T>(getSqlite(), text, params);
}

export async function transaction<T>(fn: (client: TransactionClient) => Promise<T>): Promise<T> {
  const db = getSqlite();
  db.exec('BEGIN');

  const client: TransactionClient = {
    query: <R = any>(text: string, params: unknown[] = []) => execute<R>(db, text, params),
  };

  try {
    const result = await fn(client);
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export async function initDatabase(): Promise<void> {
  // Initialize Drizzle instance so migrations/queries can use it elsewhere.
  getDrizzle();

  const db = getSqlite();

  db.exec(`
    CREATE TABLE IF NOT EXISTS server_seeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seed TEXT,
      seed_hash TEXT NOT NULL,
      revealed_seed TEXT,
      is_active INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      total_bets INTEGER DEFAULT 0,
      revealed_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS wallets (
      wallet_id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      username_lower TEXT UNIQUE,
      avatar_hash TEXT,
      balance INTEGER DEFAULT 500,
      shards INTEGER DEFAULT 500,
      gems INTEGER DEFAULT 0,
      rep INTEGER DEFAULT 0,
      seed_encrypted TEXT DEFAULT '',
      seed_iv TEXT DEFAULT '',
      seed_tag TEXT DEFAULT '',
      two_factor_secret TEXT,
      terms_accepted INTEGER DEFAULT 0,
      terms_accepted_at INTEGER,
      onboarding_step INTEGER DEFAULT 0,
      is_verified INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      ban_reason TEXT,
      risk_score INTEGER DEFAULT 0,
      total_wagered INTEGER DEFAULT 0,
      total_won INTEGER DEFAULT 0,
      total_lost INTEGER DEFAULT 0,
      biggest_win INTEGER DEFAULT 0,
      daily_streak INTEGER DEFAULT 0,
      last_daily INTEGER,
      last_active INTEGER DEFAULT (unixepoch()),
      games_played INTEGER DEFAULT 0,
      client_seed TEXT DEFAULT '',
      server_seed_id INTEGER,
      nonce INTEGER DEFAULT 0,
      account_created_at INTEGER,
      joined_server_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (server_seed_id) REFERENCES server_seeds(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_id TEXT UNIQUE,
      wallet_id TEXT,
      type TEXT,
      currency TEXT DEFAULT 'shards',
      amount INTEGER,
      balance_before INTEGER,
      balance_after INTEGER,
      reference_id TEXT,
      reference_type TEXT,
      counterparty_id TEXT,
      description TEXT,
      channel_id TEXT,
      metadata TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      tx_hash TEXT,
      FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id)
    );

    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bet_id TEXT UNIQUE,
      wallet_id TEXT,
      game TEXT,
      amount INTEGER,
      bet_amount INTEGER,
      multiplier REAL,
      payout INTEGER,
      profit INTEGER,
      server_seed_hash TEXT,
      server_seed TEXT,
      client_seed TEXT,
      nonce INTEGER,
      result_hex TEXT,
      result_float REAL,
      result_display TEXT,
      outcome_data TEXT,
      status TEXT DEFAULT 'resolved',
      verified_by_user INTEGER DEFAULT 0,
      channel_id TEXT,
      opponent_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id)
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'shards',
      status TEXT DEFAULT 'pending',
      requested_at INTEGER DEFAULT (unixepoch()),
      cooldown_until INTEGER,
      processed_at INTEGER,
      risk_flags TEXT,
      admin_reviewed INTEGER DEFAULT 0,
      tx_id TEXT,
      FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id),
      FOREIGN KEY (tx_id) REFERENCES transactions(tx_id)
    );

    CREATE TABLE IF NOT EXISTS daily_limits (
      wallet_id TEXT PRIMARY KEY,
      date TEXT DEFAULT (date('now')),
      withdrawals_today INTEGER DEFAULT 0,
      amount_withdrawn INTEGER DEFAULT 0,
      max_withdrawals INTEGER DEFAULT 1,
      max_amount INTEGER DEFAULT 10000,
      last_withdrawal INTEGER,
      next_allowed INTEGER,
      FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id)
    );

    CREATE TABLE IF NOT EXISTS daily_claims (
      wallet_id TEXT PRIMARY KEY,
      claimed_at INTEGER,
      FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id)
    );

    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS stonks (
      ticker TEXT PRIMARY KEY,
      name TEXT,
      price INTEGER DEFAULT 100,
      emoji TEXT,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS stonk_holdings (
      wallet_id TEXT NOT NULL,
      ticker TEXT NOT NULL,
      shares INTEGER NOT NULL DEFAULT 0,
      avg_price REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (wallet_id, ticker),
      FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id)
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      purchased_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(wallet_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS role_assignments (
      wallet_id TEXT PRIMARY KEY,
      role_name TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id)
    );

    CREATE INDEX IF NOT EXISTS idx_wallets_discord ON wallets(discord_id);
    CREATE INDEX IF NOT EXISTS idx_wallets_balance ON wallets(balance DESC);
    CREATE INDEX IF NOT EXISTS idx_wallets_shards ON wallets(shards DESC);
    CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(wallet_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bets_wallet ON bets(wallet_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bets_game ON bets(game);

    CREATE TABLE IF NOT EXISTS security_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_security_audit_guild ON security_audit_logs(guild_id, created_at DESC);
  `);

  console.log('✅ Database initialized (SQLite + Drizzle)');
}
