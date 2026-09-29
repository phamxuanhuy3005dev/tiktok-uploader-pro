export interface IElectronAPI {
  getProfiles: () => Promise<any[]>;
  createProfile: (profile: any) => Promise<any[]>;
  updateProfile: (profile: any) => Promise<any[]>;
  deleteProfile: (id: string) => Promise<any[]>;
  openBrowser: (id: string) => Promise<boolean>;
  closeBrowser: (id: string) => Promise<boolean>;
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
