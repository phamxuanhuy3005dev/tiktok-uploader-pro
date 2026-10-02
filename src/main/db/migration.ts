import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { groupRepo, profileRepo, PROFILES_DIR } from "./database";

export function importFromOldTool(
  oldToolPath = "/Users/fanboyrose/Desktop/tiktok-at",
): {
  importedCount: number;
  message: string;
} {
  const oldDbPath = path.join(oldToolPath, "data", "tiktok.db");
  const oldProfilesDir = path.join(oldToolPath, "profiles");

  if (!fs.existsSync(oldDbPath)) {
    throw new Error(`Không tìm thấy cơ sở dữ liệu cũ tại: ${oldDbPath}`);
  }

  const oldDb = new Database(oldDbPath, { readonly: true });

  // Đọc danh sách groups cũ nếu có
  const groupMap = new Map<string, string>();
  try {
    const oldGroups = oldDb
      .prepare("SELECT id, name FROM groups")
      .all() as any[];
    for (const g of oldGroups) {
      if (g.id && g.name) groupMap.set(g.id, g.name);
    }
  } catch (_) {}

  const oldProfiles = oldDb.prepare("SELECT * FROM profiles").all() as any[];

  let count = 0;
  for (const oldP of oldProfiles) {
    if (!oldP.name) continue;

    const groupName = oldP.group_id
      ? groupMap.get(oldP.group_id) || "Mặc định"
      : "Mặc định";

    // Kiểm tra xem profile đã tồn tại trong app mới chưa
    const existing = profileRepo.getAll().find((p) => p.name === oldP.name);
    if (existing) {
      profileRepo.update({
        id: existing.id,
        group_name: groupName,
        account_id: oldP.account_id || existing.account_id,
        pass: oldP.pass || existing.pass,
        email: oldP.email || existing.email,
        pass_email: oldP.pass_email || existing.pass_email,
        mail_ao: oldP.mail_ao || existing.mail_ao,
      });
      count++;
      continue;
    }

    // Copy thư mục session cũ sang thư mục mới nếu có
    const srcDir = path.join(oldProfilesDir, oldP.name);
    const destDir = path.join(PROFILES_DIR, oldP.name);

    if (fs.existsSync(srcDir) && !fs.existsSync(destDir)) {
      try {
        fs.cpSync(srcDir, destDir, { recursive: true });
      } catch (cpErr: any) {
        console.warn(
          `Không thể copy thư mục profile ${oldP.name}:`,
          cpErr.message,
        );
      }
    }

    profileRepo.create({
      id: oldP.id || `profile_${Date.now()}_${count}`,
      name: oldP.name,
      group_name: groupName,
      status: "idle",
      video_folder: oldP.video_folder || "",
      enable_music: oldP.set_music !== undefined ? oldP.set_music : 1,
      music_mode: "favorite_rotate", // Mặc định xoay vòng theo yêu cầu của user
      favorite_index: 0,
      music_volume: -50,
      schedule_mode: oldP.auto_increment_schedule
        ? "auto_increment"
        : "immediate",
      schedule_interval: oldP.schedule_interval || 10,
      golden_hours: "11:30,17:30,20:00",
      caption_mode: oldP.remove_title ? "remove_title" : "from_txt_file",
      proxy: null,
      cookies: oldP.cookies || null,
      account_id: oldP.account_id || null,
      pass: oldP.pass || null,
      email: oldP.email || null,
      pass_email: oldP.pass_email || null,
      mail_ao: oldP.mail_ao || null,
      last_run: oldP.last_run || null,
    });
    count++;
  }

  oldDb.close();
  return {
    importedCount: count,
    message: `Đã nhập thành công ${count} profile và các nhóm từ tool cũ!`,
  };
}

export function exportProfilesToJson(
  targetFilePath: string,
  specificProfiles?: any[],
): void {
  const profiles =
    specificProfiles && specificProfiles.length > 0
      ? specificProfiles
      : profileRepo.getAll();
  const formatted = profiles.map((p) => {
    let parsedCookies = p.cookies;
    if (typeof p.cookies === "string") {
      try {
        parsedCookies = JSON.parse(p.cookies);
      } catch (_) {
        parsedCookies = p.cookies;
      }
    }
    return {
      name: p.name,
      group_name: p.group_name || "Mặc định",
      account_id: p.account_id || p.name,
      pass: p.pass || "",
      two_factor: p.two_factor || "",
      email: p.email || "",
      pass_email: p.pass_email || "",
      mail_ao: p.mail_ao || "",
      proxy: p.proxy || "",
      video_folder: p.video_folder || "",
      cookies: parsedCookies,
      status: "idle",
      enable_music: p.enable_music !== undefined ? p.enable_music : 1,
      music_mode: p.music_mode || "favorite_rotate",
      favorite_index: p.favorite_index || 0,
      music_volume: p.music_volume !== undefined ? p.music_volume : -50,
      schedule_mode: p.schedule_mode || "auto_increment",
      schedule_interval: p.schedule_interval || 10,
      golden_hours: p.golden_hours || "11:30,17:30,20:00",
      caption_mode: p.caption_mode || "remove_title",
      cleanup_mode: p.cleanup_mode || "default",
      max_videos: p.max_videos || 50,
      followers_count: p.followers_count || 0,
      stats_updated_at: p.stats_updated_at || null,
      last_run: p.last_run || null,
    };
  });
  fs.writeFileSync(targetFilePath, JSON.stringify(formatted, null, 2), "utf-8");
}

export function importProfilesFromJsonString(content: string): number {
  let list: any;
  try {
    list = JSON.parse(content);
  } catch (err: any) {
    throw new Error(`Định dạng file JSON bị lỗi: ${err.message}`);
  }

  // Hỗ trợ cả định dạng mảng [...] hoặc bọc trong object { profiles: [...] }
  if (!Array.isArray(list)) {
    if (list && Array.isArray(list.profiles)) {
      list = list.profiles;
    } else {
      throw new Error("Định dạng JSON không hợp lệ (cần mảng profiles).");
    }
  }

  let count = 0;
  const currentProfiles = profileRepo.getAll();

  for (const item of list) {
    if (!item || !item.name) continue;
    const name = String(item.name).trim();
    if (!name) continue;

    const targetGroup =
      String(item.group_name || item.group || "Mặc định").trim() || "Mặc định";
    if (targetGroup !== "Mặc định") {
      try {
        groupRepo.create(targetGroup);
      } catch (_) {}
    }

    let cookiesStr: string | null = null;
    if (item.cookies) {
      cookiesStr =
        typeof item.cookies === "string"
          ? item.cookies
          : JSON.stringify(item.cookies);
    }

    const existing = currentProfiles.find(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    );
    if (!existing) {
      profileRepo.create({
        ...item,
        name,
        group_name: targetGroup,
        cookies: cookiesStr,
      });
      count++;
    } else {
      // Cập nhật thông tin / cookie mới nếu có
      profileRepo.update({
        id: existing.id,
        group_name: targetGroup,
        cookies: cookiesStr || existing.cookies,
        account_id:
          item.account_id !== undefined ? item.account_id : existing.account_id,
        pass: item.pass !== undefined ? item.pass : existing.pass,
        two_factor:
          item.two_factor !== undefined
            ? item.two_factor
            : item.two_fa || item["2fa"] || existing.two_factor,
        email: item.email !== undefined ? item.email : existing.email,
        pass_email:
          item.pass_email !== undefined ? item.pass_email : existing.pass_email,
        mail_ao: item.mail_ao !== undefined ? item.mail_ao : existing.mail_ao,
        video_folder:
          item.video_folder !== undefined
            ? item.video_folder
            : existing.video_folder,
        max_videos:
          item.max_videos !== undefined
            ? Number(item.max_videos)
            : existing.max_videos,
        proxy: item.proxy !== undefined ? item.proxy : existing.proxy,
        enable_music:
          item.enable_music !== undefined
            ? Number(item.enable_music)
            : existing.enable_music,
        music_mode: item.music_mode || existing.music_mode,
        favorite_index:
          item.favorite_index !== undefined
            ? Number(item.favorite_index)
            : existing.favorite_index,
        music_volume:
          item.music_volume !== undefined
            ? Number(item.music_volume)
            : existing.music_volume,
        schedule_mode: item.schedule_mode || existing.schedule_mode,
        schedule_interval:
          item.schedule_interval !== undefined
            ? Number(item.schedule_interval)
            : existing.schedule_interval,
        golden_hours: item.golden_hours || existing.golden_hours,
        cleanup_mode: item.cleanup_mode || existing.cleanup_mode || "default",
      });
      count++;
    }
  }
  return count;
}

export function importProfilesFromJson(sourceFilePath: string): number {
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error("File không tồn tại.");
  }
  const content = fs.readFileSync(sourceFilePath, "utf-8");
  return importProfilesFromJsonString(content);
}
