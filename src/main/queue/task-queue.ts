import PQueue from 'p-queue';
import { ProfileRecord, profileRepo } from '../db/database';
import { runUploadPipeline, PipelineProgressEvent } from '../engine/upload-pipeline';

export class UploadQueueManager {
  private queue: PQueue;
  private runningProfiles: Set<string> = new Set();
  private progressListeners: ((event: PipelineProgressEvent) => void)[] = [];

  constructor(concurrency = 2) {
    this.queue = new PQueue({ concurrency });
  }

  public setConcurrency(limit: number): void {
    this.queue.concurrency = Math.max(1, limit);
  }

  public onProgress(listener: (event: PipelineProgressEvent) => void): void {
    this.progressListeners.push(listener);
  }

  private emitProgress(event: PipelineProgressEvent): void {
    for (const listener of this.progressListeners) {
      listener(event);
    }
  }

  public isRunning(profileId: string): boolean {
    return this.runningProfiles.has(profileId);
  }

  public async addProfile(profile: ProfileRecord): Promise<void> {
    if (this.runningProfiles.has(profile.id)) {
      throw new Error(`Profile ${profile.name} đang trong tiến trình chạy.`);
    }

    this.runningProfiles.add(profile.id);
    profileRepo.updateStatus(profile.id, 'queued');

    this.queue.add(async () => {
      try {
        await runUploadPipeline(profile, (event) => {
          this.emitProgress(event);
        });
      } catch (err: any) {
        this.emitProgress({
          profileId: profile.id,
          videoName: '',
          step: 'ERROR',
          message: err.message,
          type: 'error'
        });
      } finally {
        this.runningProfiles.delete(profile.id);
      }
    });
  }

  public getStats() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      runningProfiles: Array.from(this.runningProfiles)
    };
  }
}

export const uploadQueue = new UploadQueueManager(2);
