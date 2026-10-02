import fs from "fs";
import path from "path";
import { logRepo, ProfileRecord, profileRepo } from "../db/database";
import { closeProfileContext, launchProfileContext } from "./browser-pool";
import { checkExistingScheduledTime } from "./tasks/task-content";
import { processCaption, submitAndConfirmPost } from "./tasks/task-finalize";
import { attachFavoriteMusic } from "./tasks/task-music";
import {
  attachVideoFile,
  dismissPopups,
  navigateToUpload,
} from "./tasks/task-navigate";
import { applySchedule } from "./tasks/task-schedule";

export interface PipelineProgressEvent {
  profileId: string;
  videoName: string;
  step: string;
  message: string;
  type?: "info" | "warn" | "error" | "success";
}

export async function runUploadPipeline(
  profile: ProfileRecord,
  onProgress?: (event: PipelineProgressEvent) => void,
): Promise<{ uploaded: number; failed: number }> {
  const log = (
    message: string,
    type: "info" | "warn" | "error" | "success" = "info",
  ) => {
    console.log(`[${profile.name}] ${message}`);
    if (onProgress) {
      onProgress({
        profileId: profile.id,
        videoName: currentVideoName,
        step: currentStep,
        message,
        type,
      });
    }
  };

  let currentStep = "INIT";
  let currentVideoName = "";

  // 1. Kiểm tra thư mục video
  if (!profile.video_folder || !fs.existsSync(profile.video_folder)) {
    throw new Error(`Thư mục video không tồn tại: ${profile.video_folder}`);
  }

  const validExtensions = [".mp4", ".mov", ".webm", ".mkv"];
  let videoFiles = fs
    .readdirSync(profile.video_folder)
    .filter((f) => {
      if (f.startsWith(".")) return false;
      const ext = path.extname(f).toLowerCase();
      return validExtensions.includes(ext);
    })
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );

  if (videoFiles.length === 0) {
    log("Không có video nào trong thư mục để upload.", "warn");
    profileRepo.updateStatus(profile.id, "idle");
    return { uploaded: 0, failed: 0 };
  }

  const totalFound = videoFiles.length;
  const maxLimit =
    profile.max_videos !== undefined &&
    profile.max_videos !== null &&
    !isNaN(Number(profile.max_videos))
      ? Number(profile.max_videos)
      : 50;

  if (maxLimit > 0 && totalFound > maxLimit) {
    videoFiles = videoFiles.slice(0, maxLimit);
    log(
      `Tìm thấy ${totalFound} video. Áp dụng giới hạn tải lên tối đa ${maxLimit} video cho đợt này.`,
    );
  } else {
    log(
      `Tìm thấy ${totalFound} video hợp lệ trong thư mục. Sẽ tải lên toàn bộ ${videoFiles.length} video.`,
    );
  }

  profileRepo.updateStatus(profile.id, "uploading");

  let uploadedCount = 0;
  let failedCount = 0;
  let lastScheduledDate: Date | null = null;
  let hasExistingBatch = false;

  // 2. Khởi chạy trình duyệt
  currentStep = "LAUNCH_BROWSER";
  const { context, page: initialPage } = await launchProfileContext(
    profile,
    false,
  );
  let page = initialPage;
  await dismissPopups(page, (m) => log(m));

  try {
    // BƯỚC 0: Kiểm tra bài đăng hiện tại & phát hiện mốc thời gian đã lên lịch trước đó
    if (profile.schedule_mode !== "immediate") {
      currentStep = "CHECKING_CONTENT";
      const contentSummary = await checkExistingScheduledTime(page, (m) =>
        log(m),
      );
      if (
        contentSummary.hasScheduledPosts &&
        contentSummary.latestScheduledDate
      ) {
        lastScheduledDate = contentSummary.latestScheduledDate;
        hasExistingBatch = true;
        log(
          `Đã phát hiện lịch có sẵn. Tất cả video mới sẽ được lên lịch nối tiếp từ mốc: ${lastScheduledDate.toLocaleString("vi-VN")}`,
        );
      }
    }

    for (let i = 0; i < videoFiles.length; i++) {
      const videoFileName = videoFiles[i];
      currentVideoName = videoFileName;
      const videoPath = path.join(profile.video_folder, videoFileName);

      // Nếu file đã bị di chuyển hoặc không còn tồn tại
      if (!fs.existsSync(videoPath)) continue;

      log(`[Video ${i + 1}/${videoFiles.length}] Đang xử lý: ${videoFileName}`);

      try {
        // BƯỚC 1: Truy cập trang Upload
        currentStep = "NAVIGATING";
        await navigateToUpload(page, profile.name, (m) => log(m));

        // BƯỚC 2: Đính kèm file video
        currentStep = "ATTACHING_FILE";
        await attachVideoFile(page, videoPath, (m) => log(m));

        // BƯỚC 3: GẮN NHẠC FAVORITES (Nếu profile bật tính năng này)
        if (profile.enable_music !== 0) {
          currentStep = "ATTACHING_MUSIC";
          await attachFavoriteMusic(page, profile, uploadedCount, (m) =>
            log(m),
          );
        } else {
          log(
            "Profile cấu hình TẮT chèn nhạc: Bỏ qua editor, giữ nguyên âm thanh gốc của video.",
          );
        }

        // BƯỚC 4: Xử lý Caption / Hashtag
        currentStep = "PROCESSING_CAPTION";
        await processCaption(page, videoPath, profile, (m) => log(m));

        // BƯỚC 5: Cài đặt Lên lịch
        currentStep = "SCHEDULING";
        lastScheduledDate = await applySchedule(
          page,
          profile,
          uploadedCount,
          (m) => log(m),
          lastScheduledDate,
          hasExistingBatch,
        );

        // BƯỚC 6: Bấm đăng, bắt Video ID và lưu trữ sang done/
        currentStep = "SUBMITTING";
        const result = await submitAndConfirmPost(
          page,
          profile,
          videoPath,
          (m) => log(m),
        );

        uploadedCount++;
        logRepo.add({
          profile_id: profile.id,
          video_name: videoFileName,
          video_id: result.videoId,
          video_url: result.videoUrl,
          status: "success",
          error_message: null,
        });

        log(`Hoàn thành xuất sắc video ${videoFileName}!`, "success");
        await page.waitForTimeout(3000);
      } catch (videoError: any) {
        failedCount++;
        log(
          `Lỗi khi xử lý video ${videoFileName}: ${videoError.message}`,
          "error",
        );

        logRepo.add({
          profile_id: profile.id,
          video_name: videoFileName,
          video_id: null,
          video_url: null,
          status: "failed",
          error_message: videoError.message,
        });

        // Nếu lỗi do thiếu nhạc Favorites -> Dừng toàn bộ tiến trình của profile này luôn!
        if (videoError.message.includes("MỤC FAVORITES RỖNG")) {
          log(
            "Dừng toàn bộ hàng đợi vì kênh không có nhạc yêu thích!",
            "error",
          );
          break;
        }

        // Nếu trình duyệt hoặc context bị đóng (người dùng tắt hoặc crash) -> Dừng luôn profile này, không lặp lỗi 50 lần
        if (
          videoError.message.includes(
            "Target page, context or browser has been closed",
          ) ||
          videoError.message.includes("Target closed") ||
          context.pages().length === 0
        ) {
          log(
            "Trình duyệt của kênh đã bị đóng. Dừng các video còn lại của profile này.",
            "warn",
          );
          break;
        }

        // Nếu chỉ tab hiện tại bị crash/đóng nhưng context vẫn còn sống: tạo lại tab mới
        if (page.isClosed()) {
          try {
            page = await context.newPage();
            await dismissPopups(page, (m) => log(m));
          } catch {
            log("Không thể mở lại tab mới, dừng profile này.", "warn");
            break;
          }
        }

        // Reset trang upload để chuẩn bị video tiếp theo
        await page
          .goto("https://www.tiktok.com/tiktokstudio/upload", {
            waitUntil: "domcontentloaded",
          })
          .catch(() => {});
        await page.waitForTimeout(2000);
      }
    }
  } finally {
    currentStep = "FINISH";
    profileRepo.update({
      id: profile.id,
      status: "idle",
      last_run: new Date().toISOString(),
    });
    await closeProfileContext(profile.id);
    log(
      `Tiến trình upload hoàn tất. Thành công: ${uploadedCount}, Thất bại: ${failedCount}.`,
      "info",
    );
  }

  return { uploaded: uploadedCount, failed: failedCount };
}
