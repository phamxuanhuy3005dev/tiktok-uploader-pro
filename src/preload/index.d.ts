export interface IElectronAPI {
  getProfiles: () => Promise<any[]>;
  createProfile: (profile: any) => Promise<any[]>;
  updateProfile: (profile: any) => Promise<any[]>;
  deleteProfile: (id: string) => Promise<any[]>;
  deleteAllProfiles: () => Promise<any[]>;
  openBrowser: (id: string) => Promise<boolean>;
  closeBrowser: (id: string) => Promise<boolean>;
  importFromOldTool: () => Promise<{ profiles: any[]; importedCount: number; message: string }>;
  exportJson: () => Promise<{ success: boolean; filePath?: string }>;
  importJson: () => Promise<{ success: boolean; count?: number; profiles?: any[] }>;
  selectFolder: () => Promise<string | null>;
  startQueue: (profileIds: string[]) => Promise<any>;
  getQueueStats: () => Promise<any>;
  getLogs: (profileId: string) => Promise<any[]>;
  onUploadProgress: (callback: (event: any) => void) => () => void;
  onProfilesUpdated: (callback: (profiles: any[]) => void) => () => void;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
