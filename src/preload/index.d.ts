export interface IElectronAPI {
  getProfiles: () => Promise<any[]>;
  createProfile: (profile: any) => Promise<any[]>;
  updateProfile: (profile: any) => Promise<any[]>;
  deleteProfile: (id: string) => Promise<any[]>;
  deleteAllProfiles: () => Promise<any[]>;
  openBrowser: (id: string) => Promise<boolean>;
  closeBrowser: (id: string) => Promise<boolean>;
  testProxy: (rawProxy: string) => Promise<{ success: boolean; ip?: string; latencyMs?: number; error?: string }>;
  importFromOldTool: () => Promise<{ profiles: any[]; importedCount: number; message: string }>;
  exportJson: () => Promise<{ success: boolean; filePath?: string }>;
  importJson: () => Promise<{ success: boolean; count?: number; profiles?: any[] }>;
  selectFolder: () => Promise<string | null>;
  scanVideoFolder: (folderPath: string) => Promise<{
    exists: boolean;
    count: number;
    totalCount: number;
    files: string[];
    videoFiles: string[];
  }>;
  distributeVideos: (params: {
    sourceFolder: string;
    targetProfileIds: string[];
    mode?: 'move' | 'copy';
  }) => Promise<{
    success: boolean;
    totalAssigned: number;
    totalVideos: number;
    profilesCount: number;
    results: any[];
    updatedProfiles: any[];
    details?: Record<string, number>;
  }>;
  startQueue: (profileIds: string[]) => Promise<any>;
  getQueueStats: () => Promise<any>;
  setConcurrency: (concurrency: number) => Promise<number>;
  getConcurrency: () => Promise<number>;
  getLogs: (profileId: string) => Promise<any[]>;
  getAllLogs: () => Promise<any[]>;
  clearLogs: () => Promise<boolean>;
  onUploadProgress: (callback: (event: any) => void) => () => void;
  onProfilesUpdated: (callback: (profiles: any[]) => void) => () => void;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
