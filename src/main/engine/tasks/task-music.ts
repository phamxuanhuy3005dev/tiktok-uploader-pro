import { Page } from "playwright";
import { ProfileRecord } from "../../db/database";
import { dismissPopups } from "./task-navigate";

export async function attachFavoriteMusic(
  page: Page,
  profile: ProfileRecord,
  videoIndex: number,
  log: (msg: string) => void,
): Promise<void> {
  log("Bắt đầu quy trình gắn nhạc từ mục Favorites (Yêu thích)...");

  let success = false;
  const MAX_RETRY = 3;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    log(`[Nhạc Favorites] Lần thử ${attempt}/${MAX_RETRY}...`);

    try {
      await dismissPopups(page, log);

      // 1. Tìm nút mở Sounds Editor chính xác trên video card (chuẩn theo tiktok-at)
      const soundsSelector =
        '.editor-entrance[data-button-name="sounds"], button[data-button-name="sounds"]';
      const soundsBtn = page.locator(soundsSelector).first();

      let soundsVisible = false;
      log("Đang kiểm tra và đợi nút Sounds Editor sẵn sàng...");
      for (let waitSec = 0; waitSec < 120; waitSec++) {
        await page
          .evaluate(() => {
            const btn = document.querySelector(
              '.editor-entrance[data-button-name="sounds"], [data-button-name="sounds"]',
            );
            if (btn) btn.scrollIntoView({ block: "center" });
          })
          .catch(() => null);

        if (await soundsBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          soundsVisible = true;
          break;
        }
        await page.waitForTimeout(1000);
        await dismissPopups(page, log);
      }

      if (!soundsVisible) {
        throw new Error("Không tìm thấy nút Sounds Editor sau khi nạp video.");
      }

      await soundsBtn.scrollIntoViewIfNeeded().catch(() => {});
      try {
        await soundsBtn.click({ force: true, timeout: 5000 });
      } catch (_) {
        await soundsBtn
          .evaluate((el: HTMLElement) => el.click())
          .catch(() => {});
      }
      log("Đã nhấn nút mở Sounds Editor. Đang tải trình biên tập âm thanh...");
      await page.waitForTimeout(3000);

      // Dismiss "Phone mode" tutorial popup nếu có trong editor
      const phoneModeGotIt = page
        .locator(
          'div:has-text("Phone mode") button:has-text("Got it"), button:has-text("Got it")',
        )
        .first();
      if (
        await phoneModeGotIt.isVisible({ timeout: 3500 }).catch(() => false)
      ) {
        await phoneModeGotIt.scrollIntoViewIfNeeded().catch(() => {});
        try {
          await phoneModeGotIt.click({ force: true, timeout: 3000 });
        } catch (_) {
          await phoneModeGotIt
            .evaluate((el: HTMLElement) => el.click())
            .catch(() => {});
        }
        log("Đã tắt hướng dẫn Phone mode.");
        await page.waitForTimeout(1000);
      }

      await dismissPopups(page, log);

      // 2. Chuyển sang Tab "Favorites" (Yêu thích) và đảm bảo tab đã ACTIVE
      log('Đang mở tab "Favorites"...');
      const favTabSelector =
        'button[role="tab"][aria-controls="panel-favorites"], button[role="tab"]:has-text("Favorites"), button[role="tab"]:has-text("Yêu thích")';
      const favTab = page.locator(favTabSelector).first();

      await favTab.waitFor({ state: "visible", timeout: 15000 });
      await favTab.scrollIntoViewIfNeeded().catch(() => {});

      // Kiểm tra và click cho đến khi tab Favorites thực sự ACTIVE (data-state="active" hoặc aria-selected="true")
      let isFavTabActive = false;
      for (let t = 0; t < 10; t++) {
        const state = await favTab.getAttribute("data-state").catch(() => null);
        const ariaSelected = await favTab
          .getAttribute("aria-selected")
          .catch(() => null);
        if (state === "active" || ariaSelected === "true") {
          isFavTabActive = true;
          break;
        }
        try {
          await favTab.click({ force: true, timeout: 3000 });
        } catch (_) {
          await favTab
            .evaluate((el: HTMLElement) => el.click())
            .catch(() => {});
        }
        await page.waitForTimeout(600);
      }

      if (!isFavTabActive) {
        throw new Error(
          "Không thể chuyển sang tab Favorites (tab chưa kích hoạt).",
        );
      }
      log('Đã kích hoạt tab "Favorites" thành công (active).');
      await page.waitForTimeout(1000);

      // 3. Định vị PANEL Favorites (#panel-favorites) - CHỈ QUÉT BÊN TRONG PANEL NÀY
      // Tuyệt đối không quét toàn trang để tránh lấy nhầm bài ở tab "For You"
      const favPanel = page
        .locator(
          '#panel-favorites, [role="tabpanel"][id="panel-favorites"], [role="tabpanel"][data-state="active"]',
        )
        .first();
      await favPanel.waitFor({ state: "visible", timeout: 10000 });

      log("Đang quét danh sách bài hát bên trong mục Favorites...");
      const favItemSelector =
        ".MusicPanelMusicItem__wrap, .MusicPanelMusicItem__container";
      const plusButtonInPanelSelector =
        ".MusicPanelMusicItem__operation button, button.Button__root--type-primary";

      let favItems = favPanel.locator(favItemSelector);
      let totalFavs = 0;

      for (let waitSec = 0; waitSec < 15; waitSec++) {
        totalFavs = await favItems.count().catch(() => 0);
        if (totalFavs > 0) break;

        // Nếu sau 3s hoặc 7s chưa thấy item tải về, nhấp lại tab Favorites để kích hoạt fetch
        if (waitSec === 3 || waitSec === 7) {
          log("Đang kích hoạt lại tab Favorites để nạp danh sách bài hát...");
          await favTab.click({ force: true }).catch(() => {});
        }

        await page.waitForTimeout(1000);
      }

      log(`Tìm thấy ${totalFavs} bài hát trong mục Favorites của kênh.`);

      // Nếu vẫn không có bài hát nào trong mục Favorites
      if (totalFavs === 0) {
        if (attempt === MAX_RETRY) {
          throw new Error(
            "MỤC FAVORITES RỖNG: Kênh chưa lưu bài hát nào vào mục Yêu thích! Dừng upload ngay để tránh mất tiền view.",
          );
        } else {
          throw new Error(
            `Chưa tìm thấy bài hát Favorites sau 15s chờ ở lần thử ${attempt}. Sẽ thử lại...`,
          );
        }
      }

      // Xác định bài hát cần chọn theo cấu hình profile
      let targetIndex = 0;
      if (profile.music_mode === "favorite_rotate") {
        targetIndex = videoIndex % totalFavs;
        log(
          `Chế độ xoay vòng nhạc: Chọn bài số ${targetIndex + 1}/${totalFavs}`,
        );
      } else {
        targetIndex = Math.min(profile.favorite_index || 0, totalFavs - 1);
        log(
          `Chế độ chọn bài cố định: Chọn bài số ${targetIndex + 1}/${totalFavs}`,
        );
      }

      // Trích xuất thông tin bài hát được chọn để log minh bạch
      const chosenItem = favItems.nth(targetIndex);
      const songTitle = await chosenItem
        .locator(".MusicPanelMusicItem__infoBasicTitle")
        .first()
        .innerText()
        .catch(() => `Bài hát #${targetIndex + 1}`);
      const songDesc = await chosenItem
        .locator(".MusicPanelMusicItem__infoBasicDesc")
        .first()
        .innerText()
        .catch(() => "");

      log(
        `Chuẩn bị thêm bài nhạc Favorites: "${songTitle}" ${songDesc ? `(${songDesc})` : ""}`,
      );

      // Bấm nút "+" của bài hát đã chọn bên trong panel Favorites
      const chosenButton = chosenItem
        .locator(plusButtonInPanelSelector)
        .first();
      await chosenButton.scrollIntoViewIfNeeded().catch(() => {});
      try {
        await chosenButton.click({ force: true, timeout: 5000 });
      } catch (_) {
        await chosenButton
          .evaluate((el: HTMLElement) => el.click())
          .catch(() => {});
      }
      log(
        `Đã thêm bài nhạc "${songTitle}" vào Timeline. Đang chờ bảng thuộc tính âm thanh...`,
      );
      await page.waitForTimeout(3000);

      // 4. Giảm âm lượng nhạc nền xuống -50 dB (giữ trọn âm thanh gốc của video)
      const targetVolume = profile.music_volume ?? -50;
      log(`Đang cài đặt âm lượng nhạc nền về ${targetVolume} dB...`);

      try {
        const volumeInputs = page.locator(
          'input.PropSettingInput__input, input[class*="PropSettingInput"], .property-panel input, input[type="text"][value="0"]',
        );
        const count = await volumeInputs.count();
        if (count > 0) {
          const volInput = volumeInputs.first();
          await volInput.scrollIntoViewIfNeeded().catch(() => {});
          try {
            await volInput.click({ clickCount: 3, timeout: 3000 });
          } catch (_) {
            await volInput
              .evaluate((el: HTMLInputElement) => {
                el.focus();
                el.select();
              })
              .catch(() => {});
          }
          const selectAll =
            process.platform === "darwin" ? "Meta+A" : "Control+A";
          await page.keyboard.press(selectAll);
          await volInput.fill(String(targetVolume));
          await page.keyboard.press("Enter");
          await page.waitForTimeout(600);
          log(`Âm lượng đã được đặt thành công: ${targetVolume} dB.`);
        } else {
          log(
            "Lưu ý: Không tìm thấy ô nhập volume cụ thể, giữ mức âm lượng của editor.",
          );
        }
      } catch (volErr: any) {
        log(`Bỏ qua bước chỉnh volume: ${volErr.message}`);
      }

      // 5. Bấm nút "Save" để lưu bản dựng và quay lại màn hình đăng video
      log('Đang bấm nút "Save" để lưu bản dựng trong Editor...');
      const saveBtn = page
        .locator(
          'button:has-text("Save"), button.Button__root--type-primary:has-text("Save"), button:has-text("Lưu")',
        )
        .first();

      await saveBtn.waitFor({ state: "visible", timeout: 10000 });
      try {
        await saveBtn.click({ force: true, timeout: 5000 });
      } catch (_) {
        await saveBtn.evaluate((el: HTMLElement) => el.click()).catch(() => {});
      }

      // Đợi trở về màn hình Upload form
      log("Đang chờ trình duyệt lưu và quay lại màn hình đăng video...");
      await page.waitForSelector(
        'button[data-e2e="post_video_button"], button:has-text("Post"), button:has-text("Schedule")',
        { timeout: 35000 },
      );
      await page.waitForTimeout(2000);

      log(
        "Đã lưu bản dựng thành công! Video đã được gắn nhạc Favorites chuẩn MMO.",
      );
      success = true;
      break;
    } catch (err: any) {
      log(`Lỗi trong quá trình gắn nhạc: ${err.message}`);

      // Nếu lỗi là do Favorites rỗng -> lập tức dừng tiến trình, không retry vô ích
      if (err.message.includes("MỤC FAVORITES RỖNG")) {
        throw err;
      }

      // Đóng modal/editor nếu còn mở để chuẩn bị retry (TUYỆT ĐỐI KHÔNG CLICK CANCEL TOÀN TRANG TRÁNH CANCEL UPLOAD)
      try {
        const editorCloseBtn = page
          .locator(
            '.editor-header button:has-text("Cancel"), .editor-header button:has-text("Exit"), [class*="MusicPanel"] button:has-text("Cancel"), [class*="MusicPanel"] [aria-label="Close"], button.music-panel-close',
          )
          .first();
        if (
          await editorCloseBtn.isVisible({ timeout: 1000 }).catch(() => false)
        ) {
          await editorCloseBtn.click({ force: true }).catch(() => {});
        } else {
          // Nếu editor đang mở dạng dialog, bấm Escape để thoát nhẹ nhàng
          const isEditorOpen = await page
            .locator('[role="dialog"], [class*="MusicPanel"]')
            .first()
            .isVisible()
            .catch(() => false);
          if (isEditorOpen) {
            await page.keyboard.press("Escape").catch(() => {});
          }
        }
      } catch (_) {}

      if (attempt === MAX_RETRY) {
        throw new Error(
          `GẮN NHẠC THẤT BẠI sau ${MAX_RETRY} lần thử: ${err.message}. Hủy upload video để bảo toàn doanh thu.`,
        );
      }
      await page.waitForTimeout(2000);
    }
  }

  if (!success) {
    throw new Error("Không thể hoàn tất việc gắn nhạc yêu thích cho video.");
  }
}
