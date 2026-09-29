import { contextBridge, ipcRenderer } from 'electron';

export const api = {
  // Profiles
  getProfiles: () => ipcRenderer.invoke('profiles:getAll'),
  createProfile: (profile: any) => ipcRenderer.invoke('profiles:create', profile),
  updateProfile: (profile: any) => ipcRenderer.invoke('profiles:update', profile),
  deleteProfile: (id: string) => ipcRenderer.invoke('profiles:delete', id),
  openBrowser: (id: string) => ipcRenderer.invoke('profiles:openBrowser', id),
  closeBrowser: (id: string) => ipcRenderer.invoke('profiles:closeBrowser', id),

  // Import / Export
  importFromOldTool: () => ipcRenderer.invoke('profiles:importOld'),
  exportJson: () => ipcRenderer.invoke('profiles:exportJson'),
  importJson: () => ipcRenderer.invoke('profiles:importJson'),

  // File / Folder Picker
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // Queue & Upload
  startQueue: (profileIds: string[]) => ipcRenderer.invoke('queue:start', profileIds),
  getQueueStats: () => ipcRenderer.invoke('queue:getStats'),
  getLogs: (profileId: string) => ipcRenderer.invoke('logs:getByProfile', profileId),

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
