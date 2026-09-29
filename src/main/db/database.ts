import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface ProfileRecord {
  id: string;
  name: string;
  group_name: string;
  status: string;
  video_folder: string;
  enable_music: number; // 1: Bật, 0: Tắt
  music_mode: 'favorite_single' | 'favorite_rotate';
  favorite_index: number;
  music_volume: number;
  schedule_mode: 'immediate' | 'auto_increment' | 'golden_hours';
  schedule_interval: number;
  golden_hours: string;
  caption_mode: 'remove_title' | 'from_txt_file';
  proxy: string | null;
  cookies: string | null;
  last_run: string | null;
  created_at?: string;
}

export interface UploadLogRecord {
  id?: number;
  profile_id: string;
  video_name: string;
  video_id: string | null;
  video_url: string | null;
  status: 'success' | 'failed';
  error_message: string | null;
  created_at?: string;
}

const isDev = !app.isPackaged;
const ROOT_DIR = isDev ? process.cwd() : path.dirname(app.getPath('exe'));
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const PROFILES_DIR = path.join(ROOT_DIR, 'profiles');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'tiktok_uploader.db');
export const db = new Database(DB_PATH);

// Tối ưu hiệu năng SQLite WAL mode
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 10000');
db.pragma('cache_size = -8000'); // 8MB cache
db.pragma('temp_store = MEMORY');

// Khởi tạo bảng dữ liệu chuẩn
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT UNIQUE NOT NULL,
    group_name TEXT DEFAULT 'Mặc định',
    status TEXT DEFAULT 'idle',
    video_folder TEXT DEFAULT '',
    enable_music INTEGER DEFAULT 1,
    music_mode TEXT DEFAULT 'favorite_rotate',
    favorite_index INTEGER DEFAULT 0,
    music_volume INTEGER DEFAULT -50,
    schedule_mode TEXT DEFAULT 'auto_increment',
    schedule_interval INTEGER DEFAULT 10,
    golden_hours TEXT DEFAULT '11:30,17:30,20:00',
    caption_mode TEXT DEFAULT 'remove_title',
    proxy TEXT DEFAULT NULL,
    cookies TEXT DEFAULT NULL,
    last_run TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS upload_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL,
    video_name TEXT NOT NULL,
    video_id TEXT DEFAULT NULL,
    video_url TEXT DEFAULT NULL,
    status TEXT NOT NULL,
    error_message TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
  CREATE INDEX IF NOT EXISTS idx_profiles_group ON profiles(group_name);
  CREATE INDEX IF NOT EXISTS idx_logs_profile_id ON upload_logs(profile_id);
`);

// Safe migration: thêm cột enable_music và group_name nếu DB cũ chưa có
try {
  const tableInfo = db.prepare('PRAGMA table_info(profiles)').all() as any[];
  const cols = new Set(tableInfo.map((c) => c.name));
  if (!cols.has('enable_music')) {
    db.exec('ALTER TABLE profiles ADD COLUMN enable_music INTEGER DEFAULT 1;');
  }
  if (!cols.has('group_name')) {
    db.exec("ALTER TABLE profiles ADD COLUMN group_name TEXT DEFAULT 'Mặc định';");
  }
} catch (_) {}

export const profileRepo = {
  getAll: (): ProfileRecord[] => {
    return db.prepare('SELECT * FROM profiles ORDER BY created_at DESC').all() as ProfileRecord[];
  },

  getById: (id: string): ProfileRecord | undefined => {
    return db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as ProfileRecord | undefined;
  },

  create: (profile: Omit<ProfileRecord, 'created_at'>): void => {
    db.prepare(`
      INSERT INTO profiles (
        id, name, group_name, status, video_folder, enable_music, music_mode, favorite_index,
        music_volume, schedule_mode, schedule_interval, golden_hours,
        caption_mode, proxy, cookies, last_run
      ) VALUES (
        @id, @name, @group_name, @status, @video_folder, @enable_music, @music_mode, @favorite_index,
        @music_volume, @schedule_mode, @schedule_interval, @golden_hours,
        @caption_mode, @proxy, @cookies, @last_run
      )
    `).run({
      ...profile,
      group_name: profile.group_name || 'Mặc định',
      enable_music: profile.enable_music ?? 1
    });
  },

  update: (profile: Partial<ProfileRecord> & { id: string }): void => {
    const fields = Object.keys(profile).filter((k) => k !== 'id');
    if (fields.length === 0) return;
    const setClause = fields.map((f) => `${f} = @${f}`).join(', ');
    db.prepare(`UPDATE profiles SET ${setClause} WHERE id = @id`).run(profile);
  },

  updateStatus: (id: string, status: string): void => {
    db.prepare('UPDATE profiles SET status = ? WHERE id = ?').run(status, id);
  },

  delete: (id: string): void => {
    db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
  }
};

export const logRepo = {
  add: (log: UploadLogRecord): void => {
    db.prepare(`
      INSERT INTO upload_logs (profile_id, video_name, video_id, video_url, status, error_message)
      VALUES (@profile_id, @video_name, @video_id, @video_url, @status, @error_message)
    `).run(log);
  },

  getByProfile: (profileId: string, limit = 50): UploadLogRecord[] => {
    return db.prepare(`
      SELECT * FROM upload_logs WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(profileId, limit) as UploadLogRecord[];
  }
};
