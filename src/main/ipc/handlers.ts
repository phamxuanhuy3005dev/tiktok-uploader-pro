import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { profileRepo, logRepo, configRepo, groupRepo, ProfileRecord } from '../db/database';
import { openManualBrowser, closeProfileContext, testProxyConnection } from '../engine/browser-pool';
import { uploadQueue } from '../queue/task-queue';
import { importFromOldTool, exportProfilesToJson, importProfilesFromJson } from '../db/migration';

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

  // Đăng ký listener cập nhật tiến độ upload gửi về UI
  uploadQueue.onProgress((event) => {
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send('upload:progress', event);
    }
  });

  // Profiles
  ipcMain.handle('profiles:getAll', async () => {
    return profileRepo.getAll();
  });

  ipcMain.handle('profiles:create', async (_, profile: Omit<ProfileRecord, 'created_at'>) => {
    profileRepo.create(profile);
    return profileRepo.getAll();
  });

  ipcMain.handle('profiles:update', async (_, profile: Partial<ProfileRecord> & { id: string }) => {
    profileRepo.update(profile);
    return profileRepo.getAll();
  });

  ipcMain.handle('profiles:delete', async (_, id: string) => {
    await closeProfileContext(id);
    profileRepo.delete(id);
    return profileRepo.getAll();
  });

  ipcMain.handle('profiles:deleteAll', async () => {
    const all = profileRepo.getAll();
    for (const p of all) {
      await closeProfileContext(p.id).catch(() => {});
    }
    profileRepo.deleteAll();
    return profileRepo.getAll();
  });

  // Kiểm tra kết nối Proxy thực tế
  ipcMain.handle('proxy:test', async (_, rawProxy: string) => {
    return testProxyConnection(rawProxy);
  });

  // Import từ tool cũ tiktok-at
  ipcMain.handle('profiles:importOld', async () => {
    const res = importFromOldTool();
    return {
      profiles: profileRepo.getAll(),
      ...res
    };
  });

  // Export profiles ra file JSON
  const handleExport = async () => {
    const activeWin = getValidWindow();
    const options = {
      title: 'Xuất danh sách Profiles',
      defaultPath: 'tiktok_profiles_backup.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    };
    const res = activeWin 
      ? await dialog.showSaveDialog(activeWin, options)
      : await dialog.showSaveDialog(options);

    if (!res.canceled && res.filePath) {
      exportProfilesToJson(res.filePath);
      return { success: true, filePath: res.filePath };
    }
    return { success: false };
  };
  ipcMain.handle('profiles:exportJson', handleExport);

  // Import profiles từ file JSON
  const handleImport = async () => {
    const activeWin = getValidWindow();
    const options = {
      title: 'Nhập danh sách Profiles từ JSON',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile'] as ('openFile')[]
    };
    const res = activeWin
      ? await dialog.showOpenDialog(activeWin, options)
      : await dialog.showOpenDialog(options);

    if (!res.canceled && res.filePaths.length > 0) {
      const count = importProfilesFromJson(res.filePaths[0]);
      return {
        success: true,
        count,
        profiles: profileRepo.getAll()
      };
    }
    return { success: false };
  };
  ipcMain.handle('profiles:importJson', handleImport);

  // Mở trình duyệt đăng nhập thủ công
  ipcMain.handle('profiles:openBrowser', async (_, id: string) => {
    const profile = profileRepo.getById(id);
    if (!profile) throw new Error('Không tìm thấy profile');

    await openManualBrowser(profile, () => {
      const activeWin = getValidWindow();
      if (activeWin && !activeWin.isDestroyed()) {
        activeWin.webContents.send('profiles:updated', profileRepo.getAll());
      }
    });
    return true;
  });

  ipcMain.handle('profiles:closeBrowser', async (_, id: string) => {
    await closeProfileContext(id);
    profileRepo.updateStatus(id, 'idle');
    return true;
  });

  // Native folder selector
  ipcMain.handle('dialog:selectFolder', async () => {
    const activeWin = getValidWindow();
    const options = {
      properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[]
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
  ipcMain.handle('videos:scanFolder', async (_, folderPath: string) => {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return { exists: false, count: 0, totalCount: 0, files: [], videoFiles: [] };
    }
    const validExts = new Set(['.mp4', '.mov', '.webm', '.mkv']);
    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      const files = entries
        .filter((entry) => {
          if (!entry.isFile()) return false;
          if (entry.name.startsWith('.')) return false;
          const ext = path.extname(entry.name).toLowerCase();
          return validExts.has(ext);
        })
        .map((entry) => entry.name);

      return {
        exists: true,
        count: files.length,
        totalCount: files.length,
        files,
        videoFiles: files
      };
    } catch {
      return { exists: false, count: 0, totalCount: 0, files: [], videoFiles: [] };
    }
  });

  // Chia đều video từ 1 folder cho các kênh (hoặc theo nhóm)
  ipcMain.handle(
    'videos:distribute',
    async (
      _,
      {
        sourceFolder,
        targetProfileIds,
        mode = 'move'
      }: {
        sourceFolder: string;
        targetProfileIds: string[];
        mode?: 'move' | 'copy';
      }
    ) => {
      if (!sourceFolder || !fs.existsSync(sourceFolder)) {
        throw new Error('Thư mục nguồn không tồn tại!');
      }

      if (!targetProfileIds || targetProfileIds.length === 0) {
        throw new Error('Vui lòng chọn ít nhất 1 profile để chia đều video!');
      }

      const validExts = new Set(['.mp4', '.mov', '.webm', '.mkv']);
      let allFiles: string[] = [];
      try {
        const entries = fs.readdirSync(sourceFolder, { withFileTypes: true });
        allFiles = entries
          .filter((entry) => {
            if (!entry.isFile()) return false;
            if (entry.name.startsWith('.')) return false;
            const ext = path.extname(entry.name).toLowerCase();
            return validExts.has(ext);
          })
          .map((entry) => entry.name)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      } catch (err: any) {
        throw new Error(`Không thể đọc thư mục nguồn: ${err.message}`);
      }

      if (allFiles.length === 0) {
        throw new Error('Không tìm thấy video hợp lệ nào (.mp4, .mov, .webm, .mkv) trong thư mục nguồn!');
      }

      const profiles = targetProfileIds
        .map((id) => profileRepo.getById(id))
        .filter(Boolean) as ProfileRecord[];

      if (profiles.length === 0) {
        throw new Error('Không tìm thấy thông tin các kênh hợp lệ.');
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
        const assigned = allFiles.filter((_, idx) => idx % profiles.length === i);
        
        // Chuẩn hóa tên thư mục an toàn trên Windows và macOS (loại bỏ ký tự cấm: < > : " / \ | ? *)
        const safeFolderName = p.name.replace(/[<>:"/\\|?*]/g, '_').trim() || `profile_${p.id}`;
        const pFolder = path.join(sourceFolder, safeFolderName);
        if (!fs.existsSync(pFolder)) {
          fs.mkdirSync(pFolder, { recursive: true });
        }

        for (const file of assigned) {
          const srcPath = path.join(sourceFolder, file);
          const dstPath = path.join(pFolder, file);
          if (mode === 'move') {
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
          video_folder: pFolder
        });

        results.push({
          profileId: p.id,
          profileName: p.name,
          folder: pFolder,
          assignedVideos: assigned
        });
      }

      return {
        success: true,
        totalAssigned: allFiles.length,
        totalVideos: allFiles.length,
        profilesCount: profiles.length,
        results,
        updatedProfiles: profileRepo.getAll()
      };
    }
  );

  // Bắt đầu upload cho danh sách profile
  ipcMain.handle('queue:start', async (_, profileIds: string[], runOptions?: { maxVideos?: number }) => {
    for (const id of profileIds) {
      const profile = profileRepo.getById(id);
      if (profile) {
        await uploadQueue.addProfile(profile, runOptions);
      }
    }
    return uploadQueue.getStats();
  });

  ipcMain.handle('queue:getStats', async () => {
    return uploadQueue.getStats();
  });

  ipcMain.handle('queue:setConcurrency', async (_, concurrency: number) => {
    const limit = Math.max(1, Math.min(10, Number(concurrency) || 2));
    uploadQueue.setConcurrency(limit);
    configRepo.set('concurrency', String(limit));
    return uploadQueue.getStats();
  });

  ipcMain.handle('queue:getConcurrency', async () => {
    return uploadQueue.getConcurrency();
  });

  ipcMain.handle('logs:getByProfile', async (_, profileId: string) => {
    return logRepo.getByProfile(profileId);
  });

  ipcMain.handle('logs:getAll', async () => {
    return logRepo.getAll(500);
  });

  ipcMain.handle('logs:clear', async () => {
    logRepo.clear();
    return true;
  });

  // Quản lý Danh Sách Nhóm (Groups)
  ipcMain.handle('groups:getAll', async () => {
    return groupRepo.getAll();
  });

  ipcMain.handle('groups:create', async (_, name: string) => {
    return groupRepo.create(name);
  });

  ipcMain.handle('groups:rename', async (_, { id, newName }: { id: string; newName: string }) => {
    const res = groupRepo.rename(id, newName);
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send('profiles:updated', profileRepo.getAll());
    }
    return res;
  });

  ipcMain.handle('groups:delete', async (_, id: string) => {
    const res = groupRepo.delete(id);
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send('profiles:updated', profileRepo.getAll());
    }
    return res;
  });
}
