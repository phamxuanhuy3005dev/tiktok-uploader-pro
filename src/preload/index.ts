import { contextBridge, ipcRenderer } from "electron";

export const api = {
  // Profiles
  getProfiles: () => ipcRenderer.invoke("profiles:getAll"),
  createProfile: (profile: any) =>
    ipcRenderer.invoke("profiles:create", profile),
  bulkCreateProfiles: (profiles: any[]) =>
    ipcRenderer.invoke("profiles:bulkCreate", profiles),
  updateProfile: (profile: any) =>
    ipcRenderer.invoke("profiles:update", profile),
  bulkUpdateGroup: (profileIds: string[], groupName: string) =>
    ipcRenderer.invoke("profiles:bulkUpdateGroup", { profileIds, groupName }),
  deleteProfile: (id: string) => ipcRenderer.invoke("profiles:delete", id),
  bulkDeleteProfiles: (profileIds: string[]) =>
    ipcRenderer.invoke("profiles:bulkDelete", profileIds),
  deleteAllProfiles: () => ipcRenderer.invoke("profiles:deleteAll"),
  openBrowser: (id: string) => ipcRenderer.invoke("profiles:openBrowser", id),
  closeBrowser: (id: string) => ipcRenderer.invoke("profiles:closeBrowser", id),
  testProxy: (rawProxy: string) => ipcRenderer.invoke("proxy:test", rawProxy),

  // Import / Export
  exportJson: (profiles?: any[]) =>
    ipcRenderer.invoke("profiles:exportJson", profiles),
  importJson: () => ipcRenderer.invoke("profiles:importJson"),
  importJsonString: (content: string) =>
    ipcRenderer.invoke("profiles:importJsonString", content),
  exportAccounts: (accounts: any[]) =>
    ipcRenderer.invoke("profiles:exportAccounts", accounts),
  readJsonFile: () => ipcRenderer.invoke("profiles:readJsonFile"),
  readTxtFile: () => ipcRenderer.invoke("profiles:readJsonFile"), // Alias tương thích
  get2FaCode: (secret: string) =>
    ipcRenderer.invoke("profiles:get2FaCode", secret),

  // File / Folder Picker & Video Distribution
  selectFolder: () => ipcRenderer.invoke("dialog:selectFolder"),
  scanVideoFolder: (folderPath: string) =>
    ipcRenderer.invoke("videos:scanFolder", folderPath),
  distributeVideos: (params: {
    sourceFolder: string;
    targetProfileIds: string[];
    mode?: "move" | "copy";
  }) => ipcRenderer.invoke("videos:distribute", params),

  // Queue & Upload
  startQueue: (profileIds: string[]) =>
    ipcRenderer.invoke("queue:start", profileIds),
  stopQueue: () => ipcRenderer.invoke("queue:stop"),
  getQueueStats: () => ipcRenderer.invoke("queue:getStats"),
  setConcurrency: (concurrency: number) =>
    ipcRenderer.invoke("queue:setConcurrency", concurrency),
  getConcurrency: () => ipcRenderer.invoke("queue:getConcurrency"),
  getCleanupMode: () => ipcRenderer.invoke("config:getCleanupMode"),
  setCleanupMode: (mode: string) =>
    ipcRenderer.invoke("config:setCleanupMode", mode),
  getMaxVideos: () => ipcRenderer.invoke("config:getMaxVideos"),
  setMaxVideos: (limit: number) =>
    ipcRenderer.invoke("config:setMaxVideos", limit),
  getCircuitBreakerLimit: () =>
    ipcRenderer.invoke("config:getCircuitBreakerLimit"),
  setCircuitBreakerLimit: (limit: number) =>
    ipcRenderer.invoke("config:setCircuitBreakerLimit", limit),
  getLogs: (profileId: string) =>
    ipcRenderer.invoke("logs:getByProfile", profileId),
  getAllLogs: () => ipcRenderer.invoke("logs:getAll"),
  clearLogs: () => ipcRenderer.invoke("logs:clear"),

  // Groups Management
  getGroups: () => ipcRenderer.invoke("groups:getAll"),
  createGroup: (name: string) => ipcRenderer.invoke("groups:create", name),
  renameGroup: (id: string, newName: string) =>
    ipcRenderer.invoke("groups:rename", { id, newName }),
  deleteGroup: (id: string) => ipcRenderer.invoke("groups:delete", id),

  // Followers Stats
  fetchStats: (profileId: string) =>
    ipcRenderer.invoke("profiles:fetchStats", profileId),
  fetchBulkStats: (profileIds: string[]) =>
    ipcRenderer.invoke("profiles:fetchBulkStats", profileIds),

  // Events from Main process
  onUploadProgress: (callback: (event: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on("upload:progress", handler);
    return () => ipcRenderer.removeListener("upload:progress", handler);
  },
  onProfilesUpdated: (callback: (profiles: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on("profiles:updated", handler);
    return () => ipcRenderer.removeListener("profiles:updated", handler);
  },
  onStatsProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on("stats:progress", handler);
    return () => ipcRenderer.removeListener("stats:progress", handler);
  },
};

contextBridge.exposeInMainWorld("api", api);
