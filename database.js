// node:sqlite is built into Node.js 22+ — no npm install needed
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'jobs.db'));

db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    company       TEXT    NOT NULL,
    position      TEXT    NOT NULL,
    status        TEXT    DEFAULT 'Applied',
    date_applied  DATE,
    notes         TEXT,
    job_url       TEXT,
    location      TEXT,
    salary_range  TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Migration: add source column to existing databases
try {
  db.exec("ALTER TABLE jobs ADD COLUMN source TEXT DEFAULT 'Manual'");
} catch {
  // Column already exists — safe to ignore
}

module.exports = db;
