import { contextBridge, ipcRenderer } from 'electron';

export const api = {
  // Profiles
  getProfiles: () => ipcRenderer.invoke('profiles:getAll'),
  createProfile: (profile: any) => ipcRenderer.invoke('profiles:create', profile),
  updateProfile: (profile: any) => ipcRenderer.invoke('profiles:update', profile),
  deleteProfile: (id: string) => ipcRenderer.invoke('profiles:delete', id),
  deleteAllProfiles: () => ipcRenderer.invoke('profiles:deleteAll'),
  openBrowser: (id: string) => ipcRenderer.invoke('profiles:openBrowser', id),
  closeBrowser: (id: string) => ipcRenderer.invoke('profiles:closeBrowser', id),
  testProxy: (rawProxy: string) => ipcRenderer.invoke('proxy:test', rawProxy),

  // Import / Export
  importFromOldTool: () => ipcRenderer.invoke('profiles:importOld'),
  exportJson: () => ipcRenderer.invoke('profiles:exportJson'),
  importJson: () => ipcRenderer.invoke('profiles:importJson'),

  // File / Folder Picker & Video Distribution
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  scanVideoFolder: (folderPath: string) => ipcRenderer.invoke('videos:scanFolder', folderPath),
  distributeVideos: (params: {
    sourceFolder: string;
    targetProfileIds: string[];
    mode?: 'move' | 'copy';
  }) => ipcRenderer.invoke('videos:distribute', params),

  // Queue & Upload
  startQueue: (profileIds: string[], runOptions?: { maxVideos?: number }) => ipcRenderer.invoke('queue:start', profileIds, runOptions),
  getQueueStats: () => ipcRenderer.invoke('queue:getStats'),
  setConcurrency: (concurrency: number) => ipcRenderer.invoke('queue:setConcurrency', concurrency),
  getConcurrency: () => ipcRenderer.invoke('queue:getConcurrency'),
  getLogs: (profileId: string) => ipcRenderer.invoke('logs:getByProfile', profileId),
  getAllLogs: () => ipcRenderer.invoke('logs:getAll'),
  clearLogs: () => ipcRenderer.invoke('logs:clear'),

  // Groups Management
  getGroups: () => ipcRenderer.invoke('groups:getAll'),
  createGroup: (name: string) => ipcRenderer.invoke('groups:create', name),
  renameGroup: (id: string, newName: string) => ipcRenderer.invoke('groups:rename', { id, newName }),
  deleteGroup: (id: string) => ipcRenderer.invoke('groups:delete', id),

  // Events from Main process
  onUploadProgress: (callback: (event: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('upload:progress', handler);
    return () => ipcRenderer.removeListener('upload:progress', handler);
  },
  onProfilesUpdated: (callback: (profiles: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('profiles:updated', handler);
    return () => ipcRenderer.removeListener('profiles:updated', handler);
  }
};

contextBridge.exposeInMainWorld('api', api);
