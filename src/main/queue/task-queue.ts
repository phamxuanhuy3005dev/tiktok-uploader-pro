import fs from "fs";
import path from "path";
import { configRepo, ProfileRecord, profileRepo } from "../db/database";
import { closeAllActiveContexts } from "../engine/browser-pool";
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

  public get concurrencyLimit(): number {
    return this.concurrency;
  }

  public clear(): void {
    this.queue = [];
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

  // Quản lý số liệu tổng thể đợt chạy (Batch)
  private batchTotalVideos: number = 0;
  private batchProcessedVideos: number = 0;
  private batchSuccessVideos: number = 0;
  private batchFailedVideos: number = 0;
  private isBatchActive: boolean = false;

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
    // Đính kèm dữ liệu batch chuẩn xác vào mọi event gửi về renderer
    event.batchTotalVideos = this.batchTotalVideos;
    event.batchProcessedVideos = this.batchProcessedVideos;
    event.batchSuccessVideos = this.batchSuccessVideos;
    event.batchFailedVideos = this.batchFailedVideos;

    for (const listener of this.progressListeners) {
      listener(event);
    }
  }

  public isRunning(profileId: string): boolean {
    return this.runningProfiles.has(profileId);
  }

  /**
   * Khởi tạo thông số tổng thể cho toàn bộ đợt chạy (Batch)
   * Quét trước thư mục video của TẤT CẢ các profile trong đợt chạy để biết chính xác tổng số video
   */
  public startBatch(profileIds: string[]): void {
    let totalVideos = 0;
    const validExtensions = new Set([".mp4", ".mov", ".webm", ".mkv"]);
    const configMax = Number(configRepo.get("max_videos", "50"));
    const maxLimit = !isNaN(configMax) ? configMax : 50;

    for (const id of profileIds) {
      const p = profileRepo.getById(id);
      if (p && p.video_folder && fs.existsSync(p.video_folder)) {
        try {
          const files = fs.readdirSync(p.video_folder).filter((f) => {
            if (f.startsWith(".")) return false;
            const ext = path.extname(f).toLowerCase();
            return validExtensions.has(ext);
          });
          const count =
            maxLimit > 0 ? Math.min(files.length, maxLimit) : files.length;
          totalVideos += count;
        } catch (_) {}
      }
    }

    this.batchTotalVideos = totalVideos;
    this.batchProcessedVideos = 0;
    this.batchSuccessVideos = 0;
    this.batchFailedVideos = 0;
    this.isBatchActive = true;
    console.log(
      `[UploadQueueManager] Khởi tạo đợt chạy mới: ${profileIds.length} kênh, tổng ${totalVideos} video.`,
    );
  }

  public async addProfile(profile: ProfileRecord): Promise<void> {
    if (this.runningProfiles.has(profile.id)) {
      throw new Error(`Profile ${profile.name} đang trong tiến trình chạy.`);
    }

    this.runningProfiles.add(profile.id);
    profileRepo.updateStatus(profile.id, "queued");

    this.queue.add(async () => {
      let profileLastSuccess = 0;
      let profileLastFailed = 0;

      try {
        await runUploadPipeline(profile, (event) => {
          if (event.uploadedCount > profileLastSuccess) {
            const diff = event.uploadedCount - profileLastSuccess;
            this.batchSuccessVideos += diff;
            this.batchProcessedVideos += diff;
            profileLastSuccess = event.uploadedCount;
          }
          if (event.failedCount > profileLastFailed) {
            const diff = event.failedCount - profileLastFailed;
            this.batchFailedVideos += diff;
            this.batchProcessedVideos += diff;
            profileLastFailed = event.failedCount;
          }
          this.emitProgress(event);
        });
      } catch (err: any) {
        this.batchFailedVideos += 1;
        this.batchProcessedVideos += 1;
        this.emitProgress({
          profileId: profile.id,
          profileName: profile.name,
          videoName: "",
          videoIndex: 0,
          totalVideos: 0,
          step: "ERROR",
          stepText: "Gặp lỗi",
          message: err.message,
          type: "error",
          uploadedCount: 0,
          failedCount: 1,
        });
      } finally {
        this.runningProfiles.delete(profile.id);
        if (
          this.runningProfiles.size === 0 &&
          this.queue.size === 0 &&
          this.queue.pending === 0
        ) {
          this.isBatchActive = false;
          this.emitProgress({
            profileId: "",
            profileName: "",
            videoName: "",
            videoIndex: 0,
            totalVideos: 0,
            step: "QUEUE_COMPLETED",
            stepText: "Hoàn tất hàng đợi",
            message:
              "Tất cả các kênh trong hàng đợi đã hoàn thành lượt upload.",
            type: "success",
            uploadedCount: 0,
            failedCount: 0,
          });
        }
      }
    });
  }

  /**
   * Dừng toàn bộ hàng đợi đang chờ và reset trạng thái các kênh
   */
  public async stop(): Promise<void> {
    this.queue.clear();
    const stoppedIds = Array.from(this.runningProfiles);
    this.runningProfiles.clear();
    this.isBatchActive = false;

    profileRepo.resetZombieStatuses();

    // Đóng các browser context đang chạy dở
    try {
      await closeAllActiveContexts().catch(() => {});
    } catch (_) {}

    this.emitProgress({
      profileId: "",
      profileName: "",
      videoName: "",
      videoIndex: 0,
      totalVideos: 0,
      step: "QUEUE_STOPPED",
      stepText: "Đã dừng hàng đợi",
      message: `Đã dừng hàng đợi upload theo yêu cầu (Hủy ${stoppedIds.length} kênh đang chạy).`,
      type: "warn",
      uploadedCount: 0,
      failedCount: 0,
    });
  }

  public getConcurrency(): number {
    return this.queue.concurrencyLimit;
  }

  public getStats() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      concurrency: this.getConcurrency(),
      runningProfiles: Array.from(this.runningProfiles),
      batchTotalVideos: this.batchTotalVideos,
      batchProcessedVideos: this.batchProcessedVideos,
      batchSuccessVideos: this.batchSuccessVideos,
      batchFailedVideos: this.batchFailedVideos,
      isBatchActive: this.isBatchActive,
    };
  }
}

const initialConcurrency = Math.max(
  1,
  parseInt(configRepo.get("concurrency", "2"), 10) || 2,
);
export const uploadQueue = new UploadQueueManager(initialConcurrency);
