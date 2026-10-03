import fs from "fs";
import path from "path";
import {
  configRepo,
  logRepo,
  ProfileRecord,
  profileRepo,
} from "../db/database";
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
  profileName: string;
  videoName: string;
  videoIndex: number;
  totalVideos: number;
  step: string;
  stepText: string;
  message: string;
  type?: "info" | "warn" | "error" | "success";
  uploadedCount: number;
  failedCount: number;
  batchTotalVideos?: number;
  batchProcessedVideos?: number;
  batchSuccessVideos?: number;
  batchFailedVideos?: number;
}

export function getStepText(step: string): string {
  switch (step) {
    case "INIT":
      return "Khởi tạo";
    case "LAUNCH_BROWSER":
      return "Mở trình duyệt";
    case "CHECKING_CONTENT":
      return "Kiểm tra lịch có sẵn";
    case "NAVIGATING":
      return "Mở trang upload";
    case "ATTACHING_FILE":
      return "Nạp file video";
    case "CLEARING_CAPTION":
      return "Xóa tiêu đề";
    case "ATTACHING_MUSIC":
      return "Chèn nhạc Favorites";
    case "SCHEDULING":
      return "Lên lịch đăng";
    case "SUBMITTING":
      return "Xuất bản bài viết";
    case "FINISH":
      return "Hoàn tất";
    default:
      return step;
  }
}

export async function runUploadPipeline(
  profile: ProfileRecord,
  onProgress?: (event: PipelineProgressEvent) => void,
): Promise<{ uploaded: number; failed: number }> {
  let uploadedCount = 0;
  let failedCount = 0;
  let currentStep = "INIT";
  let currentVideoName = "";
  let currentVideoIndex = 0;
  let totalVideoCount = 0;

  const log = (
    message: string,
    type: "info" | "warn" | "error" | "success" = "info",
    overrideStep?: string,
  ) => {
    const activeStep = overrideStep || currentStep;
    console.log(`[${profile.name}] [${activeStep}] ${message}`);
    if (onProgress) {
      onProgress({
        profileId: profile.id,
        profileName: profile.name,
        videoName: currentVideoName,
        videoIndex: currentVideoIndex,
        totalVideos: totalVideoCount,
        step: activeStep,
        stepText: getStepText(activeStep),
        message,
        type,
        uploadedCount,
        failedCount,
      });
    }
  };

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
  const configMax = Number(configRepo.get("max_videos", "50"));
  const maxLimit = !isNaN(configMax) ? configMax : 50;

  if (maxLimit > 0 && totalFound > maxLimit) {
    videoFiles = videoFiles.slice(0, maxLimit);
    log(
      `Tìm thấy ${totalFound} video. Áp dụng giới hạn tải lên ${maxLimit} video theo Cài đặt chung.`,
    );
  } else {
    log(
      `Tìm thấy ${totalFound} video hợp lệ trong thư mục. Sẽ tải lên toàn bộ ${videoFiles.length} video.`,
    );
  }

  totalVideoCount = videoFiles.length;
  profileRepo.updateStatus(profile.id, "uploading");

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

    const MAX_RETRIES = 2;
    const rawLimit = Number(configRepo.get("circuit_breaker_limit", "2"));
    const circuitBreakerLimit = !isNaN(rawLimit) ? rawLimit : 2;
    let consecutiveFails = 0;

    for (let i = 0; i < videoFiles.length; i++) {
      const videoFileName = videoFiles[i];
      currentVideoName = videoFileName;
      currentVideoIndex = i + 1;
      const videoPath = path.join(profile.video_folder, videoFileName);

      // Nếu file đã bị di chuyển hoặc không còn tồn tại
      if (!fs.existsSync(videoPath)) continue;

      let videoSuccess = false;
      let attempt = 0;

      while (attempt <= MAX_RETRIES && !videoSuccess) {
        attempt++;
        if (attempt > 1) {
          log(
            `[Video ${i + 1}/${videoFiles.length}] Đang thử lại lần ${attempt - 1} cho video: ${videoFileName}...`,
            "warn",
          );

          if (page.isClosed()) {
            try {
              page = await context.newPage();
              await dismissPopups(page, (m) => log(m));
            } catch {
              log("Không thể tạo lại tab mới để thử lại.", "warn");
              break;
            }
          } else {
            await page
              .goto("https://www.tiktok.com/tiktokstudio/upload", {
                waitUntil: "domcontentloaded",
              })
              .catch(() => {});
            await page.waitForTimeout(2000);
          }
        } else {
          log(
            `[Video ${i + 1}/${videoFiles.length}] Đang xử lý: ${videoFileName}`,
          );
        }

        try {
          // BƯỚC 1: Truy cập trang Upload
          currentStep = "NAVIGATING";
          log("Đang mở trang upload TikTok Studio...");
          await navigateToUpload(page, profile.name, (m) => log(m));

          // BƯỚC 2: Đính kèm file video
          currentStep = "ATTACHING_FILE";
          log(`Đang nạp file video: ${videoFileName}...`);
          await attachVideoFile(page, videoPath, (m) => log(m));

          // BƯỚC 3: Xóa sạch tiêu đề video (Nằm ở đỉnh trang UI, thực hiện trước để tránh cuộn trang lên xuống)
          currentStep = "CLEARING_CAPTION";
          log("Đang xóa sạch tiêu đề video...");
          await processCaption(page, (m) => log(m));

          // BƯỚC 4: GẮN NHẠC FAVORITES (Nếu profile bật tính năng này)
          if (profile.enable_music !== 0) {
            currentStep = "ATTACHING_MUSIC";
            log("Đang mở editor gắn nhạc Favorites...");
            await attachFavoriteMusic(page, profile, uploadedCount, (m) =>
              log(m),
            );
          } else {
            log(
              "Profile cấu hình TẮT chèn nhạc: Bỏ qua editor, giữ nguyên âm thanh gốc của video.",
            );
          }

          // BƯỚC 5: Cài đặt Lên lịch
          currentStep = "SCHEDULING";
          log("Đang thiết lập lịch hẹn giờ đăng video...");
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
          log("Đang bấm xuất bản video lên TikTok...");
          const result = await submitAndConfirmPost(
            page,
            profile,
            videoPath,
            (m) => log(m),
          );

          uploadedCount++;
          videoSuccess = true;
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
          log(
            `Lỗi khi xử lý video ${videoFileName} (lần ${attempt}/${MAX_RETRIES + 1}): ${videoError.message}`,
            "error",
          );

          // Nếu lỗi do thiếu nhạc Favorites -> Dừng toàn bộ tiến trình của profile này luôn!
          if (videoError.message.includes("MỤC FAVORITES RỖNG")) {
            log(
              "Dừng toàn bộ hàng đợi vì kênh không có nhạc yêu thích!",
              "error",
            );
            failedCount++;
            logRepo.add({
              profile_id: profile.id,
              video_name: videoFileName,
              video_id: null,
              video_url: null,
              status: "failed",
              error_message: videoError.message,
            });
            return { uploaded: uploadedCount, failed: failedCount };
          }

          // Nếu trình duyệt hoặc context bị đóng (người dùng tắt hoặc crash) -> Dừng luôn profile này
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
            failedCount++;
            logRepo.add({
              profile_id: profile.id,
              video_name: videoFileName,
              video_id: null,
              video_url: null,
              status: "failed",
              error_message: videoError.message,
            });
            return { uploaded: uploadedCount, failed: failedCount };
          }

          // Nếu đã hết số lần retry cho video này
          if (attempt > MAX_RETRIES) {
            failedCount++;
            consecutiveFails++;
            logRepo.add({
              profile_id: profile.id,
              video_name: videoFileName,
              video_id: null,
              video_url: null,
              status: "failed",
              error_message: videoError.message,
            });
            log(
              `Đã thử lại ${MAX_RETRIES} lần nhưng không thành công. Bỏ qua video ${videoFileName}.`,
              "warn",
            );

            // Kiểm tra Circuit Breaker: Tự động ngắt kênh nếu lỗi liên tiếp chạm ngưỡng
            if (
              circuitBreakerLimit > 0 &&
              consecutiveFails >= circuitBreakerLimit
            ) {
              log(
                `[BẢO VỆ TÀI KHOẢN] Kênh ${profile.name} đã gặp lỗi liên tiếp ${consecutiveFails} video. Tự động tạm dừng kênh này ngay lập tức để tránh checkpoint/khóa nick! Các kênh khác vẫn tiếp tục chạy bình thường.`,
                "error",
              );
              break; // Thoát vòng lặp video của kênh này
            }

            // Nếu lỗi do mất phiên đăng nhập -> Tạm dừng kênh này ngay lập tức, không cố thử các video sau
            if (
              videoError.message.toLowerCase().includes("đăng nhập") ||
              videoError.message.toLowerCase().includes("login") ||
              videoError.message.toLowerCase().includes("session")
            ) {
              log(
                `[MẤT PHIÊN ĐĂNG NHẬP] Kênh ${profile.name} cần đăng nhập lại. Tạm dừng kênh này để các kênh khác tiếp tục chạy!`,
                "error",
              );
              break;
            }

            // Reset trang upload để chuẩn bị video tiếp theo
            if (!page.isClosed()) {
              await page
                .goto("https://www.tiktok.com/tiktokstudio/upload", {
                  waitUntil: "domcontentloaded",
                })
                .catch(() => {});
              await page.waitForTimeout(2000);
            }
          } else {
            await page.waitForTimeout(3000);
          }
        }
      }

      if (videoSuccess) {
        consecutiveFails = 0; // Reset chuỗi lỗi khi có 1 video upload thành công
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

    // Kiểm tra xem trong thư mục nguồn còn video nào chưa được tải không
    try {
      if (fs.existsSync(profile.video_folder)) {
        const remainingVideos = fs
          .readdirSync(profile.video_folder)
          .filter((f) => {
            if (f.startsWith(".")) return false;
            return validExtensions.includes(path.extname(f).toLowerCase());
          });
        if (remainingVideos.length > 0) {
          log(
            `Thư mục nguồn vẫn còn ${remainingVideos.length} video chưa được tải lên.`,
            "warn",
          );
        }
      }
    } catch (_) {}

    log(
      `Tiến trình upload hoàn tất. Thành công: ${uploadedCount}, Thất bại: ${failedCount}.`,
      "info",
    );
  }

  return { uploaded: uploadedCount, failed: failedCount };
}
