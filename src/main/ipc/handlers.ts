import { ipcMain, dialog, BrowserWindow } from 'electron';
import { profileRepo, logRepo, ProfileRecord } from '../db/database';
import { openManualBrowser, closeProfileContext } from '../engine/browser-pool';
import { uploadQueue } from '../queue/task-queue';

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
