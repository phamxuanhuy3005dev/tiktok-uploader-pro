import { electronApp, is, optimizer } from "@electron-toolkit/utils";
import { execSync } from "child_process";
import { app, BrowserWindow, Menu, nativeImage, shell } from "electron";
import fs from "fs";
import { join } from "path";
import { closeAllActiveContexts } from "./engine/browser-pool";
import { registerIpcHandlers, setMainWindow } from "./ipc/handlers";

// Tự động kích hoạt mã hóa UTF-8 chuẩn trên Windows CMD / PowerShell (tránh lỗi font tiếng Việt / tiếng Trung)
if (process.platform === "win32") {
  try {
    execSync("chcp 65001", { stdio: "ignore" });
  } catch (_) {}
}

// Đặt tên ứng dụng hiển thị chuẩn trên macOS Dock & Tooltip
app.setName("TikTok Uploader Pro");
app.name = "TikTok Uploader Pro";
process.title = "TikTok Uploader Pro";

function getIconPath(): string | undefined {
  const possiblePaths = [
    join(__dirname, "../../resources/icon.png"),
    join(process.cwd(), "resources/icon.png"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function createWindow(): BrowserWindow {
  const iconPath = getIconPath();

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: "#f8fafc",
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    setMainWindow(null);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  registerIpcHandlers(mainWindow);
  setMainWindow(mainWindow);

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.tiktok.uploaderpro");

  const iconPath = getIconPath();
  if (process.platform === "darwin") {
    if (iconPath) {
      try {
        const img = nativeImage.createFromPath(iconPath);
        if (!img.isEmpty()) {
          app.dock.setIcon(img);
        }
      } catch (err) {
        console.error("Lỗi set dock icon:", err);
      }
    }

    // Đặt Menu bar chuẩn của macOS với tên app "TikTok Uploader Pro"
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: "TikTok Uploader Pro",
        submenu: [
          { role: "about", label: "Giới thiệu TikTok Uploader Pro" },
          { type: "separator" },
          { role: "services", label: "Dịch vụ" },
          { type: "separator" },
          { role: "hide", label: "Ẩn TikTok Uploader Pro" },
          { role: "hideOthers", label: "Ẩn các ứng dụng khác" },
          { role: "unhide", label: "Hiện tất cả" },
          { type: "separator" },
          { role: "quit", label: "Thoát TikTok Uploader Pro" },
        ],
      },
      {
        label: "Chỉnh sửa",
        submenu: [
          { role: "undo", label: "Hoàn tác" },
          { role: "redo", label: "Làm lại" },
          { type: "separator" },
          { role: "cut", label: "Cắt" },
          { role: "copy", label: "Sao chép" },
          { role: "paste", label: "Dán" },
          { role: "selectAll", label: "Chọn tất cả" },
        ],
      },
      {
        label: "Cửa sổ",
        submenu: [
          { role: "minimize", label: "Thu nhỏ" },
          { role: "zoom", label: "Phóng to" },
          { role: "close", label: "Đóng" },
        ],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", async () => {
  try {
    await closeAllActiveContexts().catch(() => {});
  } catch (_) {}
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
