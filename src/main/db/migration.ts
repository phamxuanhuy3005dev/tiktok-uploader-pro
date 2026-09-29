import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { profileRepo, PROFILES_DIR } from './database';

export function importFromOldTool(oldToolPath = '/Users/fanboyrose/Desktop/tiktok-at'): {
  importedCount: number;
  message: string;
} {
  const oldDbPath = path.join(oldToolPath, 'data', 'tiktok.db');
  const oldProfilesDir = path.join(oldToolPath, 'profiles');

  if (!fs.existsSync(oldDbPath)) {
    throw new Error(`Không tìm thấy cơ sở dữ liệu cũ tại: ${oldDbPath}`);
  }

  const oldDb = new Database(oldDbPath, { readonly: true });

  // Đọc danh sách groups cũ nếu có
  const groupMap = new Map<string, string>();
  try {
    const oldGroups = oldDb.prepare('SELECT id, name FROM groups').all() as any[];
    for (const g of oldGroups) {
      if (g.id && g.name) groupMap.set(g.id, g.name);
    }
  } catch (_) {}

  const oldProfiles = oldDb.prepare('SELECT * FROM profiles').all() as any[];

  let count = 0;
  for (const oldP of oldProfiles) {
    if (!oldP.name) continue;

    // Kiểm tra xem profile đã tồn tại trong app mới chưa
    const existing = profileRepo.getAll().find((p) => p.name === oldP.name);
    if (existing) continue;

    // Copy thư mục session cũ sang thư mục mới nếu có
    const srcDir = path.join(oldProfilesDir, oldP.name);
    const destDir = path.join(PROFILES_DIR, oldP.name);

    if (fs.existsSync(srcDir) && !fs.existsSync(destDir)) {
      try {
        fs.cpSync(srcDir, destDir, { recursive: true });
      } catch (cpErr: any) {
        console.warn(`Không thể copy thư mục profile ${oldP.name}:`, cpErr.message);
      }
    }

    const groupName = oldP.group_id ? groupMap.get(oldP.group_id) || 'Mặc định' : 'Mặc định';

    profileRepo.create({
      id: oldP.id || `profile_${Date.now()}_${count}`,
      name: oldP.name,
      group_name: groupName,
      status: 'idle',
      video_folder: oldP.video_folder || '',
      enable_music: oldP.set_music !== undefined ? oldP.set_music : 1,
      music_mode: 'favorite_rotate', // Mặc định xoay vòng theo yêu cầu của user
      favorite_index: 0,
      music_volume: -50,
      schedule_mode: oldP.auto_increment_schedule ? 'auto_increment' : 'immediate',
      schedule_interval: oldP.schedule_interval || 10,
      golden_hours: '11:30,17:30,20:00',
      caption_mode: oldP.remove_title ? 'remove_title' : 'from_txt_file',
      proxy: null,
      cookies: oldP.cookies || null,
      last_run: oldP.last_run || null
    });
    count++;
  }

  oldDb.close();
  return {
    importedCount: count,
    message: `Đã nhập thành công ${count} profile và các nhóm từ tool cũ!`
  };
}

export function exportProfilesToJson(targetFilePath: string): void {
  const profiles = profileRepo.getAll();
  fs.writeFileSync(targetFilePath, JSON.stringify(profiles, null, 2), 'utf-8');
}

export function importProfilesFromJson(sourceFilePath: string): number {
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error('File không tồn tại.');
  }
  const content = fs.readFileSync(sourceFilePath, 'utf-8');
  const list = JSON.parse(content);
  if (!Array.isArray(list)) {
    throw new Error('Định dạng file JSON không hợp lệ (cần danh sách mảng).');
  }

  let count = 0;
  for (const item of list) {
    if (!item.name) continue;
    const existing = profileRepo.getAll().find((p) => p.name === item.name);
    if (!existing) {
      profileRepo.create({
        ...item,
        id: item.id || `profile_${Date.now()}_${count}`
      });
      count++;
    }
  }
  return count;
}
