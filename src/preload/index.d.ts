export interface IElectronAPI {
  getProfiles: () => Promise<any[]>;
  createProfile: (profile: any) => Promise<any[]>;
  bulkCreateProfiles: (
    profiles: any[],
  ) => Promise<{ count: number; profiles: any[] }>;
  updateProfile: (profile: any) => Promise<any[]>;
  bulkUpdateGroup: (profileIds: string[], groupName: string) => Promise<any[]>;
  deleteProfile: (id: string) => Promise<any[]>;
  bulkDeleteProfiles: (profileIds: string[]) => Promise<any[]>;
  deleteAllProfiles: () => Promise<any[]>;
  openBrowser: (
    id: string,
  ) => Promise<{ success: boolean; alreadyOpen?: boolean }>;
  closeBrowser: (id: string) => Promise<boolean>;
  testProxy: (rawProxy: string) => Promise<{
    success: boolean;
    ip?: string;
    latencyMs?: number;
    error?: string;
  }>;
  importFromOldTool: () => Promise<{
    profiles: any[];
    importedCount: number;
    message: string;
  }>;
  exportJson: (profiles?: any[]) => Promise<{
    success: boolean;
    filePath?: string;
    count?: number;
    canceled?: boolean;
  }>;
  importJson: () => Promise<{
    success: boolean;
    count?: number;
    filePath?: string;
    profiles?: any[];
    canceled?: boolean;
  }>;
  importJsonString: (
    content: string,
  ) => Promise<{ success: boolean; count?: number; profiles?: any[] }>;
  exportTxt: (
    content: string,
  ) => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;
  exportAccounts: (accounts: any[]) => Promise<{
    success: boolean;
    filePath?: string;
    format?: string;
    canceled?: boolean;
  }>;
  downloadTemplate: () => Promise<{
    success: boolean;
    filePath?: string;
    format?: string;
    canceled?: boolean;
  }>;
  readTxtFile: () => Promise<{
    success: boolean;
    content?: string;
    fileName?: string;
    filePath?: string;
    canceled?: boolean;
  }>;
  get2FaCode: (
    secret: string,
  ) => Promise<{ otp: string; remainingSec: number } | null>;
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
    mode?: "move" | "copy";
  }) => Promise<{
    success: boolean;
    totalAssigned: number;
    totalVideos: number;
    profilesCount: number;
    results: any[];
    updatedProfiles: any[];
    details?: Record<string, number>;
  }>;
  startQueue: (
    profileIds: string[],
    runOptions?: { maxVideos?: number },
  ) => Promise<any>;
  getQueueStats: () => Promise<any>;
  setConcurrency: (concurrency: number) => Promise<number>;
  getConcurrency: () => Promise<number>;
  getLogs: (profileId: string) => Promise<any[]>;
  getAllLogs: () => Promise<any[]>;
  clearLogs: () => Promise<boolean>;
  getGroups: () => Promise<
    Array<{
      id: string;
      name: string;
      profile_count?: number;
      created_at: string;
    }>
  >;
  createGroup: (name: string) => Promise<{
    id: string;
    name: string;
    profile_count?: number;
    created_at: string;
  }>;
  renameGroup: (
    id: string,
    newName: string,
  ) => Promise<{
    success: boolean;
    updatedProfilesCount: number;
    updatedProfiles: any[];
    updatedGroups: any[];
  }>;
  deleteGroup: (id: string) => Promise<{
    success: boolean;
    updatedProfiles: any[];
    updatedGroups: any[];
  }>;
  fetchStats: (profileId: string) => Promise<{
    success: boolean;
    profile: any;
    stats: { followers: number };
    error?: string;
  }>;
  fetchBulkStats: (
    profileIds?: string[],
  ) => Promise<{ success: boolean; count: number; profiles: any[] }>;
  onUploadProgress: (callback: (event: any) => void) => () => void;
  onProfilesUpdated: (callback: (profiles: any[]) => void) => () => void;
  onStatsProgress: (
    callback: (progress: {
      current: number;
      total: number;
      profileName: string;
    }) => void,
  ) => () => void;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
