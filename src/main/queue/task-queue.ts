import { ProfileRecord, profileRepo } from "../db/database";
import {
  PipelineProgressEvent,
  runUploadPipeline,
} from "../engine/upload-pipeline";

/**
 * Hàng đợi bất đồng bộ thuần (Zero-dependency async concurrency queue)
 * Tương thích 100% với Electron Main process mà không gặp lỗi ESM/CJS interop của p-queue.
 */
class SimpleAsyncQueue {
  private concurrency: number;
  private running = 0;
  private queue: (() => Promise<void>)[] = [];

  constructor(concurrency = 2) {
    this.concurrency = concurrency;
  }

  public setConcurrency(limit: number): void {
    this.concurrency = Math.max(1, limit);
    this.next();
  }

  public add(task: () => Promise<void>): void {
    this.queue.push(task);
    this.next();
  }

  private next(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;
      this.running++;
      task().finally(() => {
        this.running--;
        this.next();
      });
    }
  }

  public get size(): number {
    return this.queue.length;
  }

  public get pending(): number {
    return this.running;
  }
}

export class UploadQueueManager {
  private queue: SimpleAsyncQueue;
  private runningProfiles: Set<string> = new Set();
  private progressListeners: ((event: PipelineProgressEvent) => void)[] = [];

  constructor(concurrency = 2) {
    this.queue = new SimpleAsyncQueue(concurrency);
  }

  public setConcurrency(limit: number): void {
    this.queue.setConcurrency(limit);
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

  public async addProfile(
    profile: ProfileRecord,
    runOptions?: { maxVideos?: number },
  ): Promise<void> {
    if (this.runningProfiles.has(profile.id)) {
      throw new Error(`Profile ${profile.name} đang trong tiến trình chạy.`);
    }

    this.runningProfiles.add(profile.id);
    profileRepo.updateStatus(profile.id, "queued");

    const effectiveProfile =
      runOptions?.maxVideos !== undefined
        ? { ...profile, max_videos: runOptions.maxVideos }
        : profile;

    this.queue.add(async () => {
      try {
        await runUploadPipeline(effectiveProfile, (event) => {
          this.emitProgress(event);
        });
      } catch (err: any) {
        this.emitProgress({
          profileId: profile.id,
          videoName: "",
          step: "ERROR",
          message: err.message,
          type: "error",
        });
      } finally {
        this.runningProfiles.delete(profile.id);
      }
    });
  }

  public getConcurrency(): number {
    return (this.queue as any).concurrency || 2;
  }

  public getStats() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      concurrency: this.getConcurrency(),
      runningProfiles: Array.from(this.runningProfiles),
    };
  }
}

import { configRepo } from "../db/database";
const initialConcurrency = Math.max(
  1,
  parseInt(configRepo.get("concurrency", "2"), 10) || 2,
);
export const uploadQueue = new UploadQueueManager(initialConcurrency);
