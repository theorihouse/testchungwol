// SQLite(로컬 개발) / PostgreSQL(Render) 겸용 DB 어댑터.
// SQL은 ? 자리표시자로 작성하고, Postgres일 때 $1, $2…로 바꾼다.
const fs = require('fs');
const path = require('path');

const isPg = !!process.env.DATABASE_URL;
let impl = null;

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + ++i);
}

function clean(params) {
  return params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
}

const ID = () => (isPg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT');

function schema() {
  return [
    `CREATE TABLE IF NOT EXISTS users (
      id ${ID()}, username TEXT UNIQUE NOT NULL, pw_hash TEXT NOT NULL, email TEXT,
      role TEXT NOT NULL DEFAULT 'user', status TEXT NOT NULL DEFAULT 'active',
      invite_code TEXT, created_at TEXT, last_seen TEXT)`,
    `CREATE TABLE IF NOT EXISTS agents (
      user_id INTEGER PRIMARY KEY, name TEXT, age INTEGER, prev_job TEXT, intro TEXT, motive TEXT,
      avatar TEXT, dept TEXT, rank TEXT, shift TEXT, level INTEGER NOT NULL DEFAULT 1, exp INTEGER NOT NULL DEFAULT 0,
      onboarding TEXT NOT NULL DEFAULT 'profile', house_dong TEXT, house_ho TEXT, house_status TEXT,
      contracted_at TEXT, prologue_node TEXT, prologue_log TEXT, prologue_done INTEGER NOT NULL DEFAULT 0,
      UNIQUE (house_dong, house_ho))`,
    `CREATE TABLE IF NOT EXISTS invites (
      code TEXT PRIMARY KEY, memo TEXT, max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1, expires_at TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER, gate_code TEXT, created_at TEXT, expires_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
    `CREATE TABLE IF NOT EXISTS posts (
      id ${ID()}, board TEXT NOT NULL, category TEXT, title TEXT NOT NULL, summary TEXT, body TEXT,
      image TEXT, status TEXT, featured INTEGER NOT NULL DEFAULT 0, author_id INTEGER, author_name TEXT,
      views INTEGER NOT NULL DEFAULT 0, md TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS comments (
      id ${ID()}, post_id INTEGER NOT NULL, user_id INTEGER, author_name TEXT, body TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS messages (
      id ${ID()}, from_id INTEGER, to_id INTEGER, title TEXT, body TEXT, read_at TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS schedule (id ${ID()}, md TEXT NOT NULL, title TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS images (id ${ID()}, name TEXT, mime TEXT, data TEXT, created_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS vn_nodes (
      id TEXT PRIMARY KEY, sort INTEGER NOT NULL DEFAULT 0, step INTEGER NOT NULL DEFAULT 1, location TEXT,
      bg TEXT, sprite TEXT, speaker TEXT, text TEXT, choices TEXT, next TEXT)`,
  ];
}

async function init() {
  if (isPg) {
    const { Pool } = require('pg');
    const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl });
    impl = {
      all: async (sql, p) => (await pool.query(toPg(sql), clean(p))).rows,
      exec: async (sql) => pool.query(sql),
    };
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
    fs.mkdirSync(dir, { recursive: true });
    const db = new DatabaseSync(path.join(dir, 'chungwol.db'));
    db.exec('PRAGMA journal_mode = WAL;');
    impl = {
      all: async (sql, p) => db.prepare(sql).all(...clean(p)),
      exec: async (sql) => db.exec(sql),
    };
  }
  for (const s of schema()) await impl.exec(s);
}

const all = (sql, params = []) => impl.all(sql, params);
const get = async (sql, params = []) => (await impl.all(sql, params))[0] || null;
const run = (sql, params = []) => impl.all(sql, params);

module.exports = { init, all, get, run, isPg };
