import Database, { Database as DatabaseType } from 'better-sqlite3';
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
  max_videos?: number;
  account_id?: string | null;
  pass?: string | null;
  email?: string | null;
  pass_email?: string | null;
  mail_ao?: string | null;
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
export const db: DatabaseType = new Database(DB_PATH);

// Tối ưu hiệu năng SQLite WAL mode
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 10000');
db.pragma('cache_size = -8000'); // 8MB cache
db.pragma('temp_store = MEMORY');

// 1. Tạo bảng profiles, upload_logs & config nếu chưa có
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
    max_videos INTEGER DEFAULT 50,
    account_id TEXT DEFAULT NULL,
    pass TEXT DEFAULT NULL,
    email TEXT DEFAULT NULL,
    pass_email TEXT DEFAULT NULL,
    mail_ao TEXT DEFAULT NULL,
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

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );
`);

// Tự động seed nhóm 'Mặc định' và đồng bộ các nhóm hiện có
try {
  db.prepare("INSERT OR IGNORE INTO groups (id, name) VALUES ('default', 'Mặc định')").run();
  const existingGroups = db.prepare("SELECT DISTINCT group_name FROM profiles WHERE group_name IS NOT NULL AND group_name != ''").all() as any[];
  const insertGroup = db.prepare("INSERT OR IGNORE INTO groups (id, name) VALUES (?, ?)");
  for (const row of existingGroups) {
    if (row.group_name) {
      insertGroup.run(`group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, row.group_name);
    }
  }
} catch (_) {}

// 2. Safe migration: Đảm bảo các cột mới tồn tại
try {
  const tableInfo = db.prepare('PRAGMA table_info(profiles)').all() as any[];
  const cols = new Set(tableInfo.map((c) => c.name));
  if (!cols.has('enable_music')) {
    db.exec('ALTER TABLE profiles ADD COLUMN enable_music INTEGER DEFAULT 1;');
  }
  if (!cols.has('group_name')) {
    db.exec("ALTER TABLE profiles ADD COLUMN group_name TEXT DEFAULT 'Mặc định';");
  }
  if (!cols.has('max_videos')) {
    db.exec('ALTER TABLE profiles ADD COLUMN max_videos INTEGER DEFAULT 50;');
  }
  const credCols = ['account_id', 'pass', 'email', 'pass_email', 'mail_ao'];
  for (const c of credCols) {
    if (!cols.has(c)) {
      db.exec(`ALTER TABLE profiles ADD COLUMN ${c} TEXT DEFAULT NULL;`);
    }
  }
} catch (_) {}

// 3. Tự động sync tài khoản, pass, email từ DB tiktok-at cũ nếu có
try {
  const oldDbPath = '/Users/fanboyrose/Desktop/tiktok-at/data/tiktok.db';
  if (fs.existsSync(oldDbPath)) {
    const oldDb = new Database(oldDbPath, { readonly: true });
    const oldProfiles = oldDb.prepare('SELECT name, account_id, pass, email, pass_email, mail_ao FROM profiles').all() as any[];
    const updateStmt = db.prepare(`
      UPDATE profiles 
      SET account_id = coalesce(account_id, ?),
          pass = coalesce(pass, ?),
          email = coalesce(email, ?),
          pass_email = coalesce(pass_email, ?),
          mail_ao = coalesce(mail_ao, ?)
      WHERE name = ?
    `);
    for (const op of oldProfiles) {
      if (op.name) {
        updateStmt.run(op.account_id || null, op.pass || null, op.email || null, op.pass_email || null, op.mail_ao || null, op.name);
      }
    }
    oldDb.close();
  }
} catch (_) {}

// 4. Tạo Index
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
    CREATE INDEX IF NOT EXISTS idx_profiles_group ON profiles(group_name);
    CREATE INDEX IF NOT EXISTS idx_logs_profile_id ON upload_logs(profile_id);
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON upload_logs(created_at DESC);
  `);
} catch (_) {}

export const configRepo = {
  get: (key: string, defaultValue = ''): string => {
    try {
      const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as any;
      return row ? row.value : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set: (key: string, value: string): void => {
    try {
      db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value);
    } catch (_) {}
  }
};

export const profileRepo = {
  getAll: (): ProfileRecord[] => {
    return db.prepare('SELECT * FROM profiles ORDER BY created_at DESC').all() as ProfileRecord[];
  },

  getById: (id: string): ProfileRecord | undefined => {
    return db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as ProfileRecord | undefined;
  },

  create: (profile: any): void => {
    if (!profile.name || typeof profile.name !== 'string' || !profile.name.trim()) {
      throw new Error('Tên profile (name) là bắt buộc!');
    }

    let serializedCookies: string | null = null;
    if (profile.cookies) {
      if (typeof profile.cookies === 'string') {
        serializedCookies = profile.cookies;
      } else {
        try {
          serializedCookies = JSON.stringify(profile.cookies);
        } catch {
          serializedCookies = String(profile.cookies);
        }
      }
    }

    const normalized = {
      id: profile.id || `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: profile.name.trim(),
      group_name: profile.group_name || profile.group || 'Mặc định',
      status: profile.status || 'idle',
      video_folder: profile.video_folder || '',
      enable_music: profile.enable_music !== undefined ? Number(profile.enable_music) : 1,
      music_mode: profile.music_mode || 'favorite_rotate',
      favorite_index: profile.favorite_index !== undefined ? Number(profile.favorite_index) : 0,
      music_volume: profile.music_volume !== undefined ? Number(profile.music_volume) : -50,
      schedule_mode: profile.schedule_mode || 'auto_increment',
      schedule_interval: profile.schedule_interval !== undefined ? Number(profile.schedule_interval) : 10,
      golden_hours: profile.golden_hours || '11:30,17:30,20:00',
      caption_mode: profile.caption_mode || 'remove_title',
      proxy: profile.proxy || null,
      cookies: serializedCookies,
      max_videos: profile.max_videos !== undefined && profile.max_videos !== null && profile.max_videos !== '' ? Number(profile.max_videos) : 50,
      account_id: profile.account_id || null,
      pass: profile.pass || null,
      email: profile.email || null,
      pass_email: profile.pass_email || null,
      mail_ao: profile.mail_ao || null,
      last_run: profile.last_run || null
    };

    db.prepare(`
      INSERT INTO profiles (
        id, name, group_name, status, video_folder, enable_music, music_mode, favorite_index,
        music_volume, schedule_mode, schedule_interval, golden_hours,
        caption_mode, proxy, cookies, max_videos, account_id, pass, email, pass_email, mail_ao, last_run
      ) VALUES (
        @id, @name, @group_name, @status, @video_folder, @enable_music, @music_mode, @favorite_index,
        @music_volume, @schedule_mode, @schedule_interval, @golden_hours,
        @caption_mode, @proxy, @cookies, @max_videos, @account_id, @pass, @email, @pass_email, @mail_ao, @last_run
      )
    `).run(normalized);
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
  },

  deleteAll: (): void => {
    db.prepare('DELETE FROM profiles').run();
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
  },

  getAll: (limit = 200): (UploadLogRecord & { profile_name?: string; group_name?: string })[] => {
    return db.prepare(`
      SELECT l.*, p.name as profile_name, p.group_name 
      FROM upload_logs l 
      LEFT JOIN profiles p ON l.profile_id = p.id 
      ORDER BY l.created_at DESC LIMIT ?
    `).all(limit) as any[];
  },

  clear: (): void => {
    db.prepare('DELETE FROM upload_logs').run();
  }
};

export interface GroupRecord {
  id: string;
  name: string;
  profile_count?: number;
  created_at: string;
}

export const groupRepo = {
  getAll: (): GroupRecord[] => {
    db.prepare("INSERT OR IGNORE INTO groups (id, name) VALUES ('default', 'Mặc định')").run();

    return db.prepare(`
      SELECT 
        g.id, 
        g.name, 
        g.created_at, 
        COUNT(p.id) as profile_count
      FROM groups g
      LEFT JOIN profiles p ON p.group_name = g.name
      GROUP BY g.id, g.name
      ORDER BY CASE WHEN g.name = 'Mặc định' THEN 0 ELSE 1 END, g.name ASC
    `).all() as GroupRecord[];
  },

  create: (name: string): GroupRecord => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Tên nhóm không được để trống.');

    const existing = db.prepare('SELECT * FROM groups WHERE name = ?').get(trimmed) as GroupRecord | undefined;
    if (existing) return existing;

    const id = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db.prepare('INSERT INTO groups (id, name) VALUES (?, ?)').run(id, trimmed);
    return { id, name: trimmed, profile_count: 0, created_at: new Date().toISOString() };
  },

  rename: (id: string, newName: string): { success: boolean; updatedProfilesCount: number } => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Tên nhóm mới không được để trống.');

    const current = db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as GroupRecord | undefined;
    if (!current) throw new Error('Không tìm thấy nhóm cần đổi tên.');
    if (current.name === trimmed) return { success: true, updatedProfilesCount: 0 };

    const duplicate = db.prepare('SELECT * FROM groups WHERE name = ? AND id != ?').get(trimmed, id);
    if (duplicate) throw new Error(`Tên nhóm "${trimmed}" đã tồn tại. Vui lòng chọn tên khác.`);

    const renameTx = db.transaction(() => {
      db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(trimmed, id);
      const res = db.prepare('UPDATE profiles SET group_name = ? WHERE group_name = ?').run(trimmed, current.name);
      return res.changes;
    });

    const updatedProfilesCount = renameTx();
    return { success: true, updatedProfilesCount };
  },

  delete: (id: string): boolean => {
    const current = db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as GroupRecord | undefined;
    if (!current) return false;
    if (current.name === 'Mặc định') {
      throw new Error('Không thể xóa nhóm "Mặc định".');
    }

    const deleteTx = db.transaction(() => {
      db.prepare("UPDATE profiles SET group_name = 'Mặc định' WHERE group_name = ?").run(current.name);
      db.prepare('DELETE FROM groups WHERE id = ?').run(id);
    });

    deleteTx();
    return true;
  }
};

