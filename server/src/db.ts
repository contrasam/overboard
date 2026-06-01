import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '..', 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'overboard.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS storyboards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    px_per_second REAL NOT NULL DEFAULT 40,
    row_width_px INTEGER NOT NULL DEFAULT 1100,
    lane_count INTEGER NOT NULL DEFAULT 3,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shots (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
    "order" INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    duration_sec REAL NOT NULL DEFAULT 3,
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS audio_markers (
    id TEXT PRIMARY KEY,
    storyboard_id TEXT NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
    lane INTEGER NOT NULL DEFAULT 0,
    start_sec REAL NOT NULL,
    end_sec REAL NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#7c3aed'
  );
`);

// Migrate: add user_id column to storyboards if not present
const sbCols = (db.prepare('PRAGMA table_info(storyboards)').all() as { name: string }[]).map(c => c.name);
if (!sbCols.includes('user_id')) {
  db.exec('ALTER TABLE storyboards ADD COLUMN user_id TEXT REFERENCES users(id)');
}

export type UserRow = { id: string; email: string; password_hash: string; created_at: number };
export type StoryboardRow = {
  id: string; name: string; px_per_second: number; row_width_px: number; lane_count: number;
  created_at: number; updated_at: number; user_id: string | null;
};
export type ShotRow = {
  id: string; storyboard_id: string; order: number; title: string; description: string;
  duration_sec: number; image_url: string | null;
};
export type AudioRow = {
  id: string; storyboard_id: string; lane: number; start_sec: number; end_sec: number;
  label: string; color: string;
};

export const toStoryboard = (r: StoryboardRow) => ({
  id: r.id, name: r.name, pxPerSecond: r.px_per_second, rowWidthPx: r.row_width_px,
  laneCount: r.lane_count, createdAt: r.created_at, updatedAt: r.updated_at,
});
export const toShot = (r: ShotRow) => ({
  id: r.id, storyboardId: r.storyboard_id, order: r.order, title: r.title,
  description: r.description, durationSec: r.duration_sec, imageUrl: r.image_url,
});
export const toAudio = (r: AudioRow) => ({
  id: r.id, storyboardId: r.storyboard_id, lane: r.lane, startSec: r.start_sec,
  endSec: r.end_sec, label: r.label, color: r.color,
});

export const touchStoryboard = (id: string) => {
  db.prepare('UPDATE storyboards SET updated_at=? WHERE id=?').run(Date.now(), id);
};
