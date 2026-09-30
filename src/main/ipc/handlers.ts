import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { profileRepo, logRepo, configRepo, groupRepo, ProfileRecord } from '../db/database';
import {
  openManualBrowser,
  closeProfileContext,
  testProxyConnection,
  isProfileActive,
  focusProfileBrowser
} from '../engine/browser-pool';
import { uploadQueue } from '../queue/task-queue';
import { importFromOldTool, exportProfilesToJson, importProfilesFromJson } from '../db/migration';
import { generateTotp } from '../engine/totp';

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
    if (isProfileActive(id)) {
      await closeProfileContext(id).catch(() => {});
    }
    profileRepo.delete(id);
    const updated = profileRepo.getAll();
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send('profiles:updated', updated);
    }
    return updated;
  });

  ipcMain.handle('profiles:bulkCreate', async (_, profiles: any[]) => {
    const count = profileRepo.bulkCreate(profiles);
    const updated = profileRepo.getAll();
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send('profiles:updated', updated);
    }
    return { count, profiles: updated };
  });

  ipcMain.handle('profiles:bulkUpdateGroup', async (_, { profileIds, groupName }: { profileIds: string[]; groupName: string }) => {
    profileRepo.bulkUpdateGroup(profileIds, groupName);
    const updated = profileRepo.getAll();
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send('profiles:updated', updated);
    }
    return updated;
  });

  ipcMain.handle('profiles:bulkDelete', async (_, profileIds: string[]) => {
    const activeIds = profileIds.filter((id) => isProfileActive(id));
    if (activeIds.length > 0) {
      await Promise.allSettled(activeIds.map((id) => closeProfileContext(id)));
    }
    profileRepo.bulkDelete(profileIds);
    const updated = profileRepo.getAll();
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send('profiles:updated', updated);
    }
    return updated;
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

  // Hàm hỗ trợ escape chuỗi sang định dạng ô CSV (Excel tương thích)
  const escapeCsvCell = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Export danh sách tài khoản ra file CSV / TXT với đầy đủ tên cột và nhóm
  ipcMain.handle('profiles:exportAccounts', async (_, accounts: any[]) => {
    const activeWin = getValidWindow();
    const today = new Date().toISOString().slice(0, 10);
    const options = {
      title: 'Xuất Danh Sách Tài Khoản (Excel CSV / TXT)',
      defaultPath: `tiktok_accounts_${today}.csv`,
      filters: [
        { name: 'Excel Spreadsheet (*.csv)', extensions: ['csv'] },
        { name: 'Text Document (*.txt)', extensions: ['txt'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    };
    const res = activeWin 
      ? await dialog.showSaveDialog(activeWin, options)
      : await dialog.showSaveDialog(options);

    if (!res.canceled && res.filePath) {
      const filePath = res.filePath;
      const isCsv = filePath.toLowerCase().endsWith('.csv');

      if (isCsv) {
        const header = ['Username', 'Password', '2FA', 'Email', 'Pass_Email', 'Mail_Ao', 'Proxy', 'Cookie', 'Nhom'];
        const rows = (accounts || []).map((p) => [
          escapeCsvCell(p.account_id || p.name || ''),
          escapeCsvCell(p.pass || ''),
          escapeCsvCell(p.two_factor || ''),
          escapeCsvCell(p.email || ''),
          escapeCsvCell(p.pass_email || ''),
          escapeCsvCell(p.mail_ao || ''),
          escapeCsvCell(p.proxy || ''),
          escapeCsvCell(p.cookies || ''),
          escapeCsvCell(p.group_name || 'Mặc định')
        ].join(','));

        // UTF-8 BOM (\uFEFF) cho phép Excel hiển thị tiếng Việt có dấu chuẩn 100% không bị vỡ font
        const csvContent = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
        fs.writeFileSync(filePath, csvContent, 'utf-8');
      } else {
        const header = '# Username|Password|2FA|Email|Pass_Email|Mail_Ao|Proxy|Cookie|Nhom';
        const rows = (accounts || []).map((p) => [
          p.account_id || p.name || '',
          p.pass || '',
          p.two_factor || '',
          p.email || '',
          p.pass_email || '',
          p.mail_ao || '',
          p.proxy || '',
          p.cookies || '',
          p.group_name || 'Mặc định'
        ].join('|'));

        const txtContent = [header, ...rows].join('\r\n');
        fs.writeFileSync(filePath, txtContent, 'utf-8');
      }
      return { success: true, filePath, format: isCsv ? 'csv' : 'txt' };
    }
    return { success: false, canceled: true };
  });

  // Tải file mẫu danh sách tài khoản (CSV Excel hoặc TXT)
  ipcMain.handle('profiles:downloadTemplate', async () => {
    const activeWin = getValidWindow();
    const options = {
      title: 'Tải File Mẫu Danh Sách Tài Khoản',
      defaultPath: 'tiktok_accounts_template.csv',
      filters: [
        { name: 'Excel Spreadsheet (*.csv)', extensions: ['csv'] },
        { name: 'Text Document (*.txt)', extensions: ['txt'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    };
    const res = activeWin 
      ? await dialog.showSaveDialog(activeWin, options)
      : await dialog.showSaveDialog(options);

    if (!res.canceled && res.filePath) {
      const filePath = res.filePath;
      const isCsv = filePath.toLowerCase().endsWith('.csv');

      if (isCsv) {
        const header = ['Username', 'Password', '2FA', 'Email', 'Pass_Email', 'Mail_Ao', 'Proxy', 'Cookie', 'Nhom'];
        const sampleRows = [
          ['tiktok_user_demo1', 'Pass123456', 'JBSWY3DPEHPK3PXP', 'user01@outlook.com', 'PassMail123', 'mailao01@gmail.com', 'http://user:pass@127.0.0.1:8080', 'sessionid=9f8e7d6c5b4a3...', 'Nhóm Nuôi US'],
          ['tiktok_user_demo2', 'Pass654321', '', 'user02@gmail.com', 'PassMail456', '', 'socks5://192.168.1.100:1080', '', 'Nhóm Reup Phim'],
          ['tiktok_user_demo3', 'Pass789xyz', 'KRSXG5CTMVRXEZLU', '', '', '', '', '', 'Mặc định']
        ].map((row) => row.map(escapeCsvCell).join(','));

        const csvContent = '\uFEFF' + [header.join(','), ...sampleRows].join('\r\n');
        fs.writeFileSync(filePath, csvContent, 'utf-8');
      } else {
        const header = '# CẤU TRÚC: Username|Password|2FA|Email|Pass_Email|Mail_Ao|Proxy|Cookie|Nhom';
        const sampleRows = [
          'tiktok_user_demo1|Pass123456|JBSWY3DPEHPK3PXP|user01@outlook.com|PassMail123|mailao01@gmail.com|http://user:pass@127.0.0.1:8080|sessionid=9f8e7d6c5b4a3...|Nhóm Nuôi US',
          'tiktok_user_demo2|Pass654321||user02@gmail.com|PassMail456||socks5://192.168.1.100:1080||Nhóm Reup Phim',
          'tiktok_user_demo3|Pass789xyz|KRSXG5CTMVRXEZLU||||||Mặc định'
        ];
        const txtContent = [header, ...sampleRows].join('\r\n');
        fs.writeFileSync(filePath, txtContent, 'utf-8');
      }
      return { success: true, filePath, format: isCsv ? 'csv' : 'txt' };
    }
    return { success: false, canceled: true };
  });

  // Lấy mã OTP 2FA trực tiếp từ chuỗi secret theo thuật toán RFC 6238
  ipcMain.handle('profiles:get2FaCode', async (_, secret: string) => {
    return generateTotp(secret);
  });

  // Export danh sách tài khoản ra file TXT (Legacy)
  ipcMain.handle('profiles:exportTxt', async (_, content: string) => {
    const activeWin = getValidWindow();
    const today = new Date().toISOString().slice(0, 10);
    const options = {
      title: 'Lưu Danh Sách Tài Khoản Ra File TXT',
      defaultPath: `tiktok_accounts_${today}.txt`,
      filters: [
        { name: 'Text Document (*.txt)', extensions: ['txt'] },
        { name: 'CSV File (*.csv)', extensions: ['csv'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    };
    const res = activeWin 
      ? await dialog.showSaveDialog(activeWin, options)
      : await dialog.showSaveDialog(options);

    if (!res.canceled && res.filePath) {
      fs.writeFileSync(res.filePath, content, 'utf-8');
      return { success: true, filePath: res.filePath };
    }
    return { success: false, canceled: true };
  });

  // Chọn và đọc file TXT / CSV từ máy tính
  ipcMain.handle('profiles:readTxtFile', async () => {
    const activeWin = getValidWindow();
    const options = {
      title: 'Chọn File Danh Sách Tài Khoản (CSV hoặc TXT)',
      filters: [
        { name: 'Excel CSV & TXT Files (*.csv, *.txt)', extensions: ['csv', 'txt'] },
        { name: 'Excel Spreadsheet (*.csv)', extensions: ['csv'] },
        { name: 'Text Document (*.txt)', extensions: ['txt'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ],
      properties: ['openFile'] as ('openFile')[]
    };
    const res = activeWin
      ? await dialog.showOpenDialog(activeWin, options)
      : await dialog.showOpenDialog(options);

    if (!res.canceled && res.filePaths.length > 0) {
      const filePath = res.filePaths[0];
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath);
      return { success: true, content, fileName, filePath };
    }
    return { success: false, canceled: true };
  });

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

    const notifyUpdated = () => {
      const activeWin = getValidWindow();
      if (activeWin && !activeWin.isDestroyed()) {
        activeWin.webContents.send('profiles:updated', profileRepo.getAll());
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
      () => notifyUpdated()
    );
    notifyUpdated(); // Cập nhật ngay lập tức sang trạng thái manual_session
    return { success: true, alreadyOpen: false };
  });

  ipcMain.handle('profiles:closeBrowser', async (_, id: string) => {
    await closeProfileContext(id);
    profileRepo.updateStatus(id, 'idle');
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send('profiles:updated', profileRepo.getAll());
    }
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
    const updatedProfiles = profileRepo.getAll();
    const updatedGroups = groupRepo.getAll();
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send('profiles:updated', updatedProfiles);
    }
    return { ...res, updatedProfiles, updatedGroups };
  });

  ipcMain.handle('groups:delete', async (_, id: string) => {
    const res = groupRepo.delete(id);
    const updatedProfiles = profileRepo.getAll();
    const updatedGroups = groupRepo.getAll();
    const activeWin = getValidWindow();
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send('profiles:updated', updatedProfiles);
    }
    return { success: res, updatedProfiles, updatedGroups };
  });
}
