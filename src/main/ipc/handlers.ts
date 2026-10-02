import { BrowserWindow, dialog, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import {
  configRepo,
  groupRepo,
  logRepo,
  ProfileRecord,
  profileRepo,
  PROFILES_DIR,
} from "../db/database";
import {
  exportProfilesToJson,
  importProfilesFromJson,
  importProfilesFromJsonString,
} from "../db/migration";
import {
  closeProfileContext,
  deleteProfileDiskData,
  focusProfileBrowser,
  isProfileActive,
  openManualBrowser,
  testProxyConnection,
} from "../engine/browser-pool";
import { fetchAndSaveProfileStats } from "../engine/stats-fetcher";
import { generateTotp } from "../engine/totp";
import { uploadQueue } from "../queue/task-queue";

let currentMainWindow: BrowserWindow | null = null;
let isIpcRegistered = false;

export function setMainWindow(win: BrowserWindow | null): void {
  currentMainWindow = win;
}

function getValidWindow(): BrowserWindow | undefined {
  if (currentMainWindow && !currentMainWindow.isDestroyed()) {
    return currentMainWindow;
  }
  const allWindows = BrowserWindow.getAllWindows();
  return allWindows.length > 0 ? allWindows[0] : undefined;
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  currentMainWindow = mainWindow;

  // Tránh đăng ký IPC lần 2 gây crash khi cửa sổ được mở lại trên macOS (app.on('activate'))
  if (isIpcRegistered) {
    return;
  }
  isIpcRegistered = true;

  // Tự động giải phóng các profile bị kẹt trạng thái từ phiên trước do crash/kill app
  profileRepo.resetZombieStatuses();

  // Đăng ký listener cập nhật tiến độ upload gửi về UI
  uploadQueue.onProgress((event) => {
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send("upload:progress", event);
    }
  });

  // Profiles
  ipcMain.handle("profiles:getAll", async () => {
    return profileRepo.getAll();
  });

  ipcMain.handle(
    "profiles:create",
    async (_, profile: Omit<ProfileRecord, "created_at">) => {
      // Nếu có thư mục zombie cũ còn sót trên đĩa từ profile bị xóa trước đó, dọn sạch để đảm bảo profile mới hoàn toàn sạch sẽ
      await deleteProfileDiskData(profile.name);
      profileRepo.create(profile);
      return profileRepo.getAll();
    },
  );

  ipcMain.handle(
    "profiles:update",
    async (_, profile: Partial<ProfileRecord> & { id: string }) => {
      profileRepo.update(profile);
      return profileRepo.getAll();
    },
  );

  ipcMain.handle("profiles:delete", async (_, id: string) => {
    const profile = profileRepo.getById(id);
    if (profile) {
      if (isProfileActive(id)) {
        await closeProfileContext(id).catch(() => {});
      }
      // Xóa triệt để thư mục dữ liệu trình duyệt trên đĩa cứng
      await deleteProfileDiskData(profile.name);
    }
    profileRepo.delete(id);
    const updated = profileRepo.getAll();
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send("profiles:updated", updated);
    }
    return updated;
  });

  ipcMain.handle("profiles:bulkCreate", async (_, profiles: any[]) => {
    const count = profileRepo.bulkCreate(profiles);
    const updated = profileRepo.getAll();
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send("profiles:updated", updated);
    }
    return { count, profiles: updated };
  });

  ipcMain.handle(
    "profiles:bulkUpdateGroup",
    async (
      _,
      { profileIds, groupName }: { profileIds: string[]; groupName: string },
    ) => {
      profileRepo.bulkUpdateGroup(profileIds, groupName);
      const updated = profileRepo.getAll();
      const activeWin = getValidWindow();
      if (activeWin && !activeWin.isDestroyed()) {
        activeWin.webContents.send("profiles:updated", updated);
      }
      return updated;
    },
  );

  ipcMain.handle("profiles:bulkDelete", async (_, profileIds: string[]) => {
    for (const id of profileIds) {
      const profile = profileRepo.getById(id);
      if (profile) {
        if (isProfileActive(id)) {
          await closeProfileContext(id).catch(() => {});
        }
        await deleteProfileDiskData(profile.name);
      }
    }
    profileRepo.bulkDelete(profileIds);
    const updated = profileRepo.getAll();
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send("profiles:updated", updated);
    }
    return updated;
  });

  ipcMain.handle("profiles:deleteAll", async () => {
    const all = profileRepo.getAll();
    for (const p of all) {
      await closeProfileContext(p.id).catch(() => {});
      await deleteProfileDiskData(p.name);
    }
    // Dọn sạch thư mục profiles rác còn sót lại trên đĩa
    try {
      if (fs.existsSync(PROFILES_DIR)) {
        const entries = fs.readdirSync(PROFILES_DIR);
        for (const entry of entries) {
          const entryPath = path.join(PROFILES_DIR, entry);
          fs.rmSync(entryPath, { recursive: true, force: true });
        }
      }
    } catch (_) {}
    profileRepo.deleteAll();
    return profileRepo.getAll();
  });

  // Kiểm tra kết nối Proxy thực tế
  ipcMain.handle("proxy:test", async (_, rawProxy: string) => {
    return testProxyConnection(rawProxy);
  });

  // Helper định dạng ngày tháng năm cho tên file xuất (dd-mm-yyyy)
  const getExportDateStr = (): string => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // Export profiles ra file JSON
  ipcMain.handle("profiles:exportJson", async (_, specificProfiles?: any[]) => {
    const activeWin = getValidWindow();
    const count = (specificProfiles || profileRepo.getAll()).length;
    const options = {
      title: "Xuất Danh Sách Kênh (JSON)",
      defaultPath: `tiktok_profiles_${count}_kenh_${getExportDateStr()}.json`,
      filters: [{ name: "JSON Files (*.json)", extensions: ["json"] }],
    };
    const res = activeWin
      ? await dialog.showSaveDialog(activeWin, options)
      : await dialog.showSaveDialog(options);

    if (!res.canceled && res.filePath) {
      exportProfilesToJson(res.filePath, specificProfiles);
      return {
        success: true,
        filePath: res.filePath,
        count,
      };
    }
    return { success: false, canceled: true };
  });

  // Import profiles từ file JSON
  ipcMain.handle("profiles:importJson", async () => {
    const activeWin = getValidWindow();
    const options = {
      title: "Chọn File JSON Profiles Cần Nhập",
      filters: [
        { name: "JSON Backup Files (*.json)", extensions: ["json"] },
        { name: "All Files (*.*)", extensions: ["*"] },
      ],
      properties: ["openFile"] as "openFile"[],
    };
    const res = activeWin
      ? await dialog.showOpenDialog(activeWin, options)
      : await dialog.showOpenDialog(options);

    if (!res.canceled && res.filePaths.length > 0) {
      const filePath = res.filePaths[0];
      const count = importProfilesFromJson(filePath);
      const updated = profileRepo.getAll();
      const validWin = getValidWindow();
      if (validWin && !validWin.isDestroyed()) {
        validWin.webContents.send("profiles:updated", updated);
      }
      return { success: true, count, filePath, profiles: updated };
    }
    return { success: false, canceled: true };
  });

  // Import profiles từ chuỗi JSON (paste hoặc drag-drop)
  ipcMain.handle(
    "profiles:importJsonString",
    async (_, jsonContent: string) => {
      const count = importProfilesFromJsonString(jsonContent);
      const updated = profileRepo.getAll();
      const activeWin = getValidWindow();
      if (activeWin && !activeWin.isDestroyed()) {
        activeWin.webContents.send("profiles:updated", updated);
      }
      return { success: true, count, profiles: updated };
    },
  );

  // Hàm hỗ trợ escape chuỗi sang định dạng ô CSV (Excel tương thích)
  const escapeCsvCell = (val: any): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (
      str.includes(",") ||
      str.includes('"') ||
      str.includes("\n") ||
      str.includes("\r")
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const TIKTOK_COOKIE_NAMES = new Set([
    "sessionid",
    "sessionid_ss",
    "sid_tt",
    "sid_guard",
    "uid_tt",
    "uid_tt_ss",
    "tt_chain_token",
    "csrf_token",
    "ttwid",
    "msToken",
    "odin_tt",
    "store-country-sign",
    "passport_csrf_token",
    "passport_csrf_token_default",
    "tt_csrf_token",
    "s_v_web_id",
  ]);

  const cleanCookieForExport = (rawCookies: any): string => {
    if (!rawCookies) return "";
    let str = typeof rawCookies === "string" ? rawCookies.trim() : "";
    if (!str && !Array.isArray(rawCookies)) return "";

    if (
      Array.isArray(rawCookies) ||
      str.startsWith("[") ||
      str.startsWith("{")
    ) {
      try {
        const parsed = Array.isArray(rawCookies) ? rawCookies : JSON.parse(str);
        if (Array.isArray(parsed)) {
          const matched = parsed.filter(
            (c: any) => c && c.name && TIKTOK_COOKIE_NAMES.has(c.name),
          );
          const listToUse = matched.length > 0 ? matched : parsed.slice(0, 15);
          return listToUse
            .map((c: any) => `${c.name}=${c.value}`)
            .join("; ")
            .replace(/[\r\n|]/g, " ")
            .trim();
        }
      } catch (_) {}
    }

    return str.replace(/[\r\n|]/g, " ").trim();
  };

  // Export danh sách tài khoản ra file CSV / TXT / JSON với đầy đủ tên cột và nhóm
  ipcMain.handle("profiles:exportAccounts", async (_, accounts: any[]) => {
    const activeWin = getValidWindow();
    const count = (accounts || []).length;
    const options = {
      title: "Xuất Danh Sách Tài Khoản (Excel CSV / TXT / JSON)",
      defaultPath: `tiktok_accounts_${count}_kenh_${getExportDateStr()}.csv`,
      filters: [
        { name: "Excel Spreadsheet (*.csv)", extensions: ["csv"] },
        { name: "Text Document (*.txt)", extensions: ["txt"] },
        { name: "JSON Backup (*.json)", extensions: ["json"] },
        { name: "All Files (*.*)", extensions: ["*"] },
      ],
    };
    const res = activeWin
      ? await dialog.showSaveDialog(activeWin, options)
      : await dialog.showSaveDialog(options);

    if (!res.canceled && res.filePath) {
      const filePath = res.filePath;
      const lowerPath = filePath.toLowerCase();

      if (lowerPath.endsWith(".json")) {
        const jsonContent = JSON.stringify(accounts || [], null, 2);
        fs.writeFileSync(filePath, jsonContent, "utf-8");
        return { success: true, filePath, format: "json" };
      }

      if (lowerPath.endsWith(".csv")) {
        const header = [
          "Username",
          "Password",
          "2FA",
          "Email",
          "Pass_Email",
          "Mail_Ao",
          "Proxy",
          "Cookie",
          "Nhom",
        ];
        const rows = (accounts || []).map((p) =>
          [
            escapeCsvCell(p.account_id || p.name || ""),
            escapeCsvCell(p.pass || ""),
            escapeCsvCell(p.two_factor || ""),
            escapeCsvCell(p.email || ""),
            escapeCsvCell(p.pass_email || ""),
            escapeCsvCell(p.mail_ao || ""),
            escapeCsvCell(p.proxy || ""),
            escapeCsvCell(cleanCookieForExport(p.cookies)),
            escapeCsvCell(p.group_name || "Mặc định"),
          ].join(","),
        );

        // UTF-8 BOM (\uFEFF) cho phép Excel hiển thị tiếng Việt có dấu chuẩn 100% không bị vỡ font
        const csvContent = "\uFEFF" + [header.join(","), ...rows].join("\r\n");
        fs.writeFileSync(filePath, csvContent, "utf-8");
        return { success: true, filePath, format: "csv" };
      }

      // Mặc định là TXT (chuẩn MMO pipe |)
      const header =
        "# Username|Password|2FA|Email|Pass_Email|Mail_Ao|Proxy|Cookie|Nhom";
      const rows = (accounts || []).map((p) =>
        [
          p.account_id || p.name || "",
          p.pass || "",
          p.two_factor || "",
          p.email || "",
          p.pass_email || "",
          p.mail_ao || "",
          p.proxy || "",
          cleanCookieForExport(p.cookies),
          p.group_name || "Mặc định",
        ].join("|"),
      );

      const txtContent = [header, ...rows].join("\r\n");
      fs.writeFileSync(filePath, txtContent, "utf-8");
      return { success: true, filePath, format: "txt" };
    }
    return { success: false, canceled: true };
  });

  // Lấy mã OTP 2FA trực tiếp từ chuỗi secret theo thuật toán RFC 6238
  ipcMain.handle("profiles:get2FaCode", async (_, secret: string) => {
    return generateTotp(secret);
  });

  // Chọn và đọc file JSON profiles từ máy tính
  const handleReadJsonFile = async () => {
    const activeWin = getValidWindow();
    const options = {
      title: "Chọn File JSON Profiles",
      filters: [
        { name: "JSON Profiles (*.json)", extensions: ["json"] },
        { name: "All Files (*.*)", extensions: ["*"] },
      ],
      properties: ["openFile"] as "openFile"[],
    };
    const res = activeWin
      ? await dialog.showOpenDialog(activeWin, options)
      : await dialog.showOpenDialog(options);

    if (!res.canceled && res.filePaths.length > 0) {
      const filePath = res.filePaths[0];
      const content = fs.readFileSync(filePath, "utf-8");
      const fileName = path.basename(filePath);
      return { success: true, content, fileName, filePath };
    }
    return { success: false, canceled: true };
  };

  ipcMain.handle("profiles:readJsonFile", handleReadJsonFile);
  ipcMain.handle("profiles:readTxtFile", handleReadJsonFile); // Tương thích ngược

  // Mở trình duyệt đăng nhập thủ công
  ipcMain.handle("profiles:openBrowser", async (_, id: string) => {
    const profile = profileRepo.getById(id);
    if (!profile) throw new Error("Không tìm thấy profile");

    const notifyUpdated = () => {
      const activeWin = getValidWindow();
      if (activeWin && !activeWin.isDestroyed()) {
        activeWin.webContents.send("profiles:updated", profileRepo.getAll());
      }
    };

    // Nếu trình duyệt của profile này đã mở sẵn -> Focus lên trước, TUYỆT ĐỐI không mở thêm browser thứ 2!
    if (isProfileActive(id)) {
      await focusProfileBrowser(id);
      notifyUpdated();
      return { success: true, alreadyOpen: true };
    }

    await openManualBrowser(
      profile,
      () => notifyUpdated(),
      () => notifyUpdated(),
    );
    notifyUpdated(); // Cập nhật ngay lập tức sang trạng thái manual_session
    return { success: true, alreadyOpen: false };
  });

  ipcMain.handle("profiles:closeBrowser", async (_, id: string) => {
    await closeProfileContext(id);
    profileRepo.updateStatus(id, "idle");
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send("profiles:updated", profileRepo.getAll());
    }
    return true;
  });

  // Native folder selector
  ipcMain.handle("dialog:selectFolder", async () => {
    const activeWin = getValidWindow();
    const options = {
      properties: ["openDirectory", "createDirectory"] as (
        "openDirectory" | "createDirectory"
      )[],
    };
    const result = activeWin
      ? await dialog.showOpenDialog(activeWin, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Quét thư mục video
  ipcMain.handle("videos:scanFolder", async (_, folderPath: string) => {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return {
        exists: false,
        count: 0,
        totalCount: 0,
        files: [],
        videoFiles: [],
      };
    }
    const validExts = new Set([".mp4", ".mov", ".webm", ".mkv"]);
    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      const files = entries
        .filter((entry) => {
          if (!entry.isFile()) return false;
          if (entry.name.startsWith(".")) return false;
          const ext = path.extname(entry.name).toLowerCase();
          return validExts.has(ext);
        })
        .map((entry) => entry.name);

      return {
        exists: true,
        count: files.length,
        totalCount: files.length,
        files,
        videoFiles: files,
      };
    } catch {
      return {
        exists: false,
        count: 0,
        totalCount: 0,
        files: [],
        videoFiles: [],
      };
    }
  });

  // Chia đều video từ 1 folder cho các kênh (hoặc theo nhóm)
  ipcMain.handle(
    "videos:distribute",
    async (
      _,
      {
        sourceFolder,
        targetProfileIds,
        mode = "move",
      }: {
        sourceFolder: string;
        targetProfileIds: string[];
        mode?: "move" | "copy";
      },
    ) => {
      if (!sourceFolder || !fs.existsSync(sourceFolder)) {
        throw new Error("Thư mục nguồn không tồn tại!");
      }

      if (!targetProfileIds || targetProfileIds.length === 0) {
        throw new Error("Vui lòng chọn ít nhất 1 profile để chia đều video!");
      }

      const validExts = new Set([".mp4", ".mov", ".webm", ".mkv"]);
      let allFiles: string[] = [];
      try {
        const entries = fs.readdirSync(sourceFolder, { withFileTypes: true });
        allFiles = entries
          .filter((entry) => {
            if (!entry.isFile()) return false;
            if (entry.name.startsWith(".")) return false;
            const ext = path.extname(entry.name).toLowerCase();
            return validExts.has(ext);
          })
          .map((entry) => entry.name)
          .sort((a, b) =>
            a.localeCompare(b, undefined, {
              numeric: true,
              sensitivity: "base",
            }),
          );
      } catch (err: any) {
        throw new Error(`Không thể đọc thư mục nguồn: ${err.message}`);
      }

      if (allFiles.length === 0) {
        throw new Error(
          "Không tìm thấy video hợp lệ nào (.mp4, .mov, .webm, .mkv) trong thư mục nguồn!",
        );
      }

      const profiles = targetProfileIds
        .map((id) => profileRepo.getById(id))
        .filter(Boolean) as ProfileRecord[];

      if (profiles.length === 0) {
        throw new Error("Không tìm thấy thông tin các kênh hợp lệ.");
      }

      const results: Array<{
        profileId: string;
        profileName: string;
        folder: string;
        assignedVideos: string[];
      }> = [];

      for (let i = 0; i < profiles.length; i++) {
        const p = profiles[i];
        // Phân bổ xoay vòng đều (Round-Robin)
        const assigned = allFiles.filter(
          (_, idx) => idx % profiles.length === i,
        );

        // Chuẩn hóa tên thư mục an toàn trên Windows và macOS (loại bỏ ký tự cấm: < > : " / \ | ? *)
        const safeFolderName =
          p.name.replace(/[<>:"/\\|?*]/g, "_").trim() || `profile_${p.id}`;
        const pFolder = path.join(sourceFolder, safeFolderName);
        if (!fs.existsSync(pFolder)) {
          fs.mkdirSync(pFolder, { recursive: true });
        }

        for (const file of assigned) {
          const srcPath = path.join(sourceFolder, file);
          const dstPath = path.join(pFolder, file);
          if (mode === "move") {
            try {
              fs.renameSync(srcPath, dstPath);
            } catch {
              // Dự phòng khi move trên Windows gặp locked file hoặc khác volume
              fs.copyFileSync(srcPath, dstPath);
              fs.unlinkSync(srcPath);
            }
          } else {
            fs.copyFileSync(srcPath, dstPath);
          }
        }

        // Cập nhật video_folder cho profile trong database
        profileRepo.update({
          id: p.id,
          video_folder: pFolder,
        });

        results.push({
          profileId: p.id,
          profileName: p.name,
          folder: pFolder,
          assignedVideos: assigned,
        });
      }

      return {
        success: true,
        totalAssigned: allFiles.length,
        totalVideos: allFiles.length,
        profilesCount: profiles.length,
        results,
        updatedProfiles: profileRepo.getAll(),
      };
    },
  );

  // Bắt đầu upload cho danh sách profile
  ipcMain.handle("queue:start", async (_, profileIds: string[]) => {
    for (const id of profileIds) {
      const profile = profileRepo.getById(id);
      if (profile) {
        await uploadQueue.addProfile(profile);
      }
    }
    return uploadQueue.getStats();
  });

  ipcMain.handle("queue:getStats", async () => {
    return uploadQueue.getStats();
  });

  ipcMain.handle("queue:stop", async () => {
    await uploadQueue.stop();
    const updated = profileRepo.getAll();
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send("profiles:updated", updated);
    }
    return uploadQueue.getStats();
  });

  ipcMain.handle("queue:setConcurrency", async (_, concurrency: number) => {
    const limit = Math.max(1, Math.min(10, Number(concurrency) || 2));
    uploadQueue.setConcurrency(limit);
    configRepo.set("concurrency", String(limit));
    return uploadQueue.getStats();
  });

  ipcMain.handle("queue:getConcurrency", async () => {
    return uploadQueue.getConcurrency();
  });

  ipcMain.handle("config:getCleanupMode", async () => {
    return configRepo.get("cleanup_mode", "delete");
  });

  ipcMain.handle("config:setCleanupMode", async (_, mode: string) => {
    const validMode = mode === "done" ? "done" : "delete";
    configRepo.set("cleanup_mode", validMode);
    return validMode;
  });

  ipcMain.handle("config:getMaxVideos", async () => {
    const val = configRepo.get("max_videos", "50");
    return val !== "" && !isNaN(Number(val)) ? Number(val) : 50;
  });

  ipcMain.handle("config:setMaxVideos", async (_, maxVideos: number) => {
    const limit = Math.max(0, Math.min(9999, Number(maxVideos) || 0));
    configRepo.set("max_videos", String(limit));
    return limit;
  });

  // Cấu hình Circuit Breaker (Số lần lỗi liên tiếp để tạm dừng kênh)
  ipcMain.handle("config:getCircuitBreakerLimit", async () => {
    const val = configRepo.get("circuit_breaker_limit", "2");
    return !isNaN(Number(val)) ? Number(val) : 2;
  });

  ipcMain.handle("config:setCircuitBreakerLimit", async (_, limit: number) => {
    const validLimit = Math.max(
      0,
      Math.min(10, Math.floor(Number(limit) || 0)),
    );
    configRepo.set("circuit_breaker_limit", String(validLimit));
    return validLimit;
  });

  ipcMain.handle("logs:getByProfile", async (_, profileId: string) => {
    return logRepo.getByProfile(profileId);
  });

  ipcMain.handle("logs:getAll", async () => {
    return logRepo.getAll(500);
  });

  ipcMain.handle("logs:clear", async () => {
    logRepo.clear();
    return true;
  });

  // Quản lý Danh Sách Nhóm (Groups)
  ipcMain.handle("groups:getAll", async () => {
    return groupRepo.getAll();
  });

  ipcMain.handle("groups:create", async (_, name: string) => {
    return groupRepo.create(name);
  });

  ipcMain.handle(
    "groups:rename",
    async (_, { id, newName }: { id: string; newName: string }) => {
      const res = groupRepo.rename(id, newName);
      const updatedProfiles = profileRepo.getAll();
      const updatedGroups = groupRepo.getAll();
      const activeWin = getValidWindow();
      if (activeWin && !activeWin.isDestroyed()) {
        activeWin.webContents.send("profiles:updated", updatedProfiles);
      }
      return { ...res, updatedProfiles, updatedGroups };
    },
  );

  ipcMain.handle("groups:delete", async (_, id: string) => {
    const res = groupRepo.delete(id);
    const updatedProfiles = profileRepo.getAll();
    const updatedGroups = groupRepo.getAll();
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send("profiles:updated", updatedProfiles);
    }
    return { success: res, updatedProfiles, updatedGroups };
  });

  // Lấy chỉ số lượt theo dõi (Followers) và Lượt xem (Views) theo yêu cầu (On-demand)
  ipcMain.handle("profiles:fetchStats", async (_, profileId: string) => {
    const profile = profileRepo.getById(profileId);
    if (!profile) {
      throw new Error("Không tìm thấy kênh hợp lệ.");
    }
    const res = await fetchAndSaveProfileStats(profile);
    const updatedProfiles = profileRepo.getAll();
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send("profiles:updated", updatedProfiles);
    }
    return res;
  });

  ipcMain.handle("profiles:fetchBulkStats", async (_, profileIds: string[]) => {
    const all = profileRepo.getAll();
    const ids =
      Array.isArray(profileIds) && profileIds.length > 0
        ? profileIds
        : all.map((p) => p.id);

    let successCount = 0;
    const activeWin = getValidWindow();

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const p = profileRepo.getById(id);
      if (!p) continue;

      if (activeWin && !activeWin.isDestroyed()) {
        activeWin.webContents.send("stats:progress", {
          current: i + 1,
          total: ids.length,
          profileName: p.name,
        });
      }

      try {
        const res = await fetchAndSaveProfileStats(p);
        if (res.success) successCount++;
      } catch (_) {}

      // Giãn cách nhẹ giữa các request tránh bị TikTok rate limit
      if (i < ids.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    const updatedProfiles = profileRepo.getAll();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send("profiles:updated", updatedProfiles);
    }
    return { success: true, count: successCount, profiles: updatedProfiles };
  });
}
