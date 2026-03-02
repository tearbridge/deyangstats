const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/deyangstats.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    realm TEXT NOT NULL,
    region TEXT DEFAULT 'cn',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    score REAL,
    data TEXT,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_character_id ON snapshots(character_id);
  CREATE INDEX IF NOT EXISTS idx_snapshots_fetched_at ON snapshots(fetched_at);

  CREATE TABLE IF NOT EXISTS runners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    athlete_id TEXT NOT NULL UNIQUE,
    api_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS runner_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    runner_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    summary TEXT NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(runner_id, month)
  );

  CREATE TABLE IF NOT EXISTS val_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    riot_id TEXT NOT NULL,
    tagline TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'ap',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS val_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    tier TEXT,
    rank_in_tier INTEGER,
    rr INTEGER,
    elo INTEGER,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    data TEXT,
    FOREIGN KEY (player_id) REFERENCES val_players(id)
  );

  CREATE INDEX IF NOT EXISTS idx_val_snapshots_player_id ON val_snapshots(player_id);
`);

module.exports = db;
