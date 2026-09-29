import { ipcMain, dialog, BrowserWindow } from 'electron';
import { profileRepo, logRepo, ProfileRecord } from '../db/database';
import { openManualBrowser, closeProfileContext } from '../engine/browser-pool';
import { uploadQueue } from '../queue/task-queue';
import { importFromOldTool, exportProfilesToJson, importProfilesFromJson } from '../db/migration';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Đăng ký listener cập nhật tiến độ upload gửi về UI
  uploadQueue.onProgress((event) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('upload:progress', event);
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

  // Import từ tool cũ tiktok-at
  ipcMain.handle('profiles:importOld', async () => {
    const res = importFromOldTool();
    return {
      profiles: profileRepo.getAll(),
      ...res
    };
  });

  // Export profiles ra file JSON
  ipcMain.handle('profiles:exportJson', async () => {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Xuất danh sách Profiles',
      defaultPath: 'tiktok_profiles_backup.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    if (!res.canceled && res.filePath) {
      exportProfilesToJson(res.filePath);
      return { success: true, filePath: res.filePath };
    }
    return { success: false };
  });

  // Import profiles từ file JSON
  ipcMain.handle('profiles:importJson', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Nhập danh sách Profiles từ JSON',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (!res.canceled && res.filePaths.length > 0) {
      const count = importProfilesFromJson(res.filePaths[0]);
      return {
        success: true,
        count,
        profiles: profileRepo.getAll()
      };
    }
    return { success: false };
  });

  // Mở trình duyệt đăng nhập thủ công
  ipcMain.handle('profiles:openBrowser', async (_, id: string) => {
    const profile = profileRepo.getById(id);
    if (!profile) throw new Error('Không tìm thấy profile');

    await openManualBrowser(profile, () => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('profiles:updated', profileRepo.getAll());
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
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Bắt đầu upload cho danh sách profile
  ipcMain.handle('queue:start', async (_, profileIds: string[]) => {
    for (const id of profileIds) {
      const profile = profileRepo.getById(id);
      if (profile) {
        await uploadQueue.addProfile(profile);
      }
    }
    return uploadQueue.getStats();
  });

  ipcMain.handle('queue:getStats', async () => {
    return uploadQueue.getStats();
  });

  ipcMain.handle('logs:getByProfile', async (_, profileId: string) => {
    return logRepo.getByProfile(profileId);
  });
}
