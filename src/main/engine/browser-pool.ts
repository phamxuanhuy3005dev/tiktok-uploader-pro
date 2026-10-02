import Database from "better-sqlite3";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { BrowserContext, chromium, Page } from "playwright";
import { promisify } from "util";
import { ProfileRecord, profileRepo, PROFILES_DIR } from "../db/database";

const execAsync = promisify(exec);
const activeContexts = new Map<string, BrowserContext>();

const CLEAN_CHROME_ARGS = ["--disable-blink-features=AutomationControlled"];

const LOCK_FILES = ["SingletonLock", "SingletonSocket", "lockfile"];

/**
 * Quét danh sách PID của Chromium/Chrome đang chạy trên thư mục UserDataDir này
 */
export async function getProfilePids(userDataDir: string): Promise<number[]> {
  if (!userDataDir || !fs.existsSync(userDataDir)) return [];
  try {
    if (process.platform === "win32") {
      const dirName = path.basename(userDataDir).replace(/["'\\]/g, "");
      if (!dirName) return [];
      const safeDirName = dirName.replace(/[`$]/g, "");
      const psCmd = `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -like '*chrome*' -or $_.Name -like '*msedge*') -and ($_.CommandLine -like '*${safeDirName}*') } | Select-Object -ExpandProperty ProcessId"`;
      const { stdout } = await execAsync(psCmd).catch(() => ({ stdout: "" }));
      return stdout
        .split("\n")
        .map((s) => parseInt(s.trim(), 10))
        .filter((pid) => pid && !isNaN(pid) && pid > 0);
    } else {
      // macOS và Linux
      const { stdout } = await execAsync("ps -Ao pid,args").catch(() => ({
        stdout: "",
      }));
      const pids: number[] = [];
      for (const line of stdout.split("\n")) {
        if (
          line.includes(userDataDir) &&
          (line.includes("chrome") ||
            line.includes("Chromium") ||
            line.includes("Google Chrome") ||
            line.includes("msedge") ||
            line.includes("Microsoft Edge"))
        ) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[0], 10);
          if (pid && !isNaN(pid) && pid !== process.pid) {
            pids.push(pid);
          }
        }
      }
      return pids;
    }
  } catch {
    return [];
  }
}

/**
 * Dọn sạch triệt để các tiến trình Chromium chạy ngầm và file lock trên macOS/Win
 * Giải quyết 100% lỗi nhấp nháy, kẹt process khi bấm X đóng rồi mở lại
 */
export async function releaseProfileLocks(
  userDataDir: string,
  profileName: string,
): Promise<void> {
  if (!userDataDir || !fs.existsSync(userDataDir)) return;

  let foundLocks: string[] = [];
  for (const file of LOCK_FILES) {
    const p = path.join(userDataDir, file);
    try {
      const s = fs.lstatSync(p);
      if (s.isSymbolicLink() || s.isFile() || s.isSocket()) {
        foundLocks.push(p);
      }
    } catch (_) {}
  }

  // Nếu không có bất kỳ file lock nào, hoàn thành ngay lập tức
  if (foundLocks.length === 0) return;

  // Thử unlink trực tiếp trước: nếu file không bị tiến trình nào giữ thì xóa được ngay (<1ms)
  let hasLockedFile = false;
  for (const lockPath of foundLocks) {
    try {
      fs.unlinkSync(lockPath);
    } catch (err: any) {
      if (err.code === "EBUSY" || err.code === "EPERM") {
        hasLockedFile = true;
      }
    }
  }

  // Nếu bị giữ khóa: Chờ 400ms grace period xem Chrome có đang trong quá trình tự thoát hay không
  if (hasLockedFile) {
    await new Promise((r) => setTimeout(r, 400));
    hasLockedFile = false;
    for (const lockPath of foundLocks) {
      try {
        fs.unlinkSync(lockPath);
      } catch (err: any) {
        if (err.code === "EBUSY" || err.code === "EPERM") {
          hasLockedFile = true;
        }
      }
    }

    // Chỉ khi file thực sự vẫn bị khóa sau grace period thì mới tìm và kill PID
    if (hasLockedFile) {
      const pids = await getProfilePids(userDataDir);
      if (pids.length > 0) {
        console.log(
          `[${profileName}] Phát hiện ${pids.length} tiến trình Chrome cũ còn chạy ngầm. Đang dọn sạch...`,
        );
        for (const pid of pids) {
          try {
            if (process.platform === "win32") {
              await execAsync(`taskkill /F /T /PID ${pid}`).catch(() => {});
            } else {
              process.kill(pid, "SIGKILL");
            }
          } catch (_) {}
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      // Thử unlink lại sau khi kill
      for (const lockPath of foundLocks) {
        try {
          fs.unlinkSync(lockPath);
        } catch (_) {}
      }
    }
  }
}

/**
 * Xóa cache shader GPU tránh lỗi treo WebGL / Captcha
 */
export function cleanProfileGpuCache(userDataDir: string): void {
  if (!fs.existsSync(userDataDir)) return;
  const staleDirs = [
    path.join(userDataDir, "Default", "GPUCache"),
    path.join(userDataDir, "Default", "DawnGraphiteCache"),
    path.join(userDataDir, "Default", "DawnWebGPUCache"),
    path.join(userDataDir, "GrShaderCache"),
    path.join(userDataDir, "ShaderCache"),
  ];
  for (const dir of staleDirs) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

/**
 * Xóa sạch dữ liệu profile trên đĩa (thư mục userDataDir trong profiles/)
 * Dọn dẹp triệt để lock, processes, và toàn bộ thư mục dữ liệu browser
 */
export async function deleteProfileDiskData(
  profileName: string,
): Promise<void> {
  if (!profileName) return;
  const userDataDir = path.join(PROFILES_DIR, profileName);
  try {
    for (const [id, ctx] of Array.from(activeContexts.entries())) {
      const prof = profileRepo.getById(id);
      if (prof && prof.name === profileName) {
        await ctx.close().catch(() => {});
        activeContexts.delete(id);
      }
    }
    await releaseProfileLocks(userDataDir, profileName).catch(() => {});
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
      console.log(
        `[deleteProfileDiskData] Đã xóa vĩnh viễn dữ liệu trình duyệt: ${userDataDir}`,
      );
    }
  } catch (err: any) {
    console.warn(
      `[deleteProfileDiskData] Lỗi khi xóa thư mục ${userDataDir}:`,
      err.message,
    );
  }
}

export interface ParsedProxy {
  server: string;
  username?: string;
  password?: string;
}

export interface ProxyTestResult {
  success: boolean;
  ip?: string;
  latencyMs?: number;
  error?: string;
}

/**
 * Chuẩn hóa và parse mọi định dạng Proxy:
 * - host:port:user:pass
 * - host:port
 * - http://user:pass@host:port
 * - socks5://user:pass@host:port
 * - user:pass@host:port
 */
export function parseProxy(rawProxy?: string | null): ParsedProxy | undefined {
  if (!rawProxy || !rawProxy.trim()) return undefined;
  let str = rawProxy.trim();

  // 1. Guard triệt để: Nếu dính cookie hoặc chuỗi lỗi, TUYỆT ĐỐI không parse thành proxy
  if (
    str.includes(";") ||
    str.includes("sessionid") ||
    str.includes("msToken") ||
    str.includes("sid_tt") ||
    str.includes("ttwid") ||
    str.startsWith("[") ||
    str.startsWith("{") ||
    str.length > 250
  ) {
    console.warn(
      `[parseProxy] Bỏ qua proxy không hợp lệ (chuỗi cookie hoặc dữ liệu lỗi):`,
      str.slice(0, 40),
    );
    return undefined;
  }

  // 2. Format: host:port:username:password
  const colonParts = str.split(":");
  if (!str.includes("://") && !str.includes("@") && colonParts.length === 4) {
    const port = Number(colonParts[1]);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      return {
        server: `http://${colonParts[0]}:${colonParts[1]}`,
        username: colonParts[2],
        password: colonParts[3],
      };
    }
  }

  // 3. Format: host:port
  if (!str.includes("://") && !str.includes("@") && colonParts.length === 2) {
    const port = Number(colonParts[1]);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      return {
        server: `http://${colonParts[0]}:${colonParts[1]}`,
      };
    }
  }

  // 4. Nếu thiếu protocol (ví dụ user:pass@host:port), thêm http://
  if (!str.includes("://")) {
    str = `http://${str}`;
  }

  try {
    const parsed = new URL(str);
    if (!parsed.hostname || !parsed.port) {
      return undefined;
    }
    const protocol = parsed.protocol || "http:";
    const server = `${protocol}//${parsed.hostname}:${parsed.port}`;
    const result: ParsedProxy = { server };

    if (parsed.username) {
      result.username = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
      result.password = decodeURIComponent(parsed.password);
    }

    return result;
  } catch {
    return undefined;
  }
}

/**
 * Tự động chọn engine trình duyệt:
 * Ưu tiên Chromium Playwright nội bộ -> Fallback sang Google Chrome / Edge có sẵn trên máy người dùng
 */
export function resolveBrowserLaunchOptions(): {
  channel?: string;
  executablePath?: string;
} {
  try {
    const pwPath = chromium.executablePath();
    if (pwPath && fs.existsSync(pwPath)) {
      return {};
    }
  } catch (_) {}

  if (process.platform === "darwin") {
    if (
      fs.existsSync(
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      )
    ) {
      return { channel: "chrome" };
    }
  } else if (process.platform === "win32") {
    const winPaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      path.join(
        process.env.LOCALAPPDATA || "",
        "Google\\Chrome\\Application\\chrome.exe",
      ),
    ];
    if (winPaths.some((p) => fs.existsSync(p))) {
      return { channel: "chrome" };
    }
    const edgePaths = [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    if (edgePaths.some((p) => fs.existsSync(p))) {
      return { channel: "msedge" };
    }
  }

  return {};
}

/**
 * Kiểm tra kết nối thực tế qua Proxy bằng Playwright Chromium
 */
export async function testProxyConnection(
  rawProxy?: string | null,
): Promise<ProxyTestResult> {
  const proxyConfig = parseProxy(rawProxy);
  if (!proxyConfig) {
    return {
      success: false,
      error: "Chưa nhập địa chỉ proxy hoặc định dạng không hợp lệ.",
    };
  }

  const startTime = Date.now();
  let testBrowser;
  try {
    const browserOpts: any = {
      headless: true,
      proxy: proxyConfig,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      ...resolveBrowserLaunchOptions(),
    };
    testBrowser = await chromium.launch(browserOpts);

    const context = await testBrowser.newContext({
      locale: "en-US",
    });
    const page = await context.newPage();

    const response = await page.goto("https://api.ipify.org?format=json", {
      timeout: 15000,
      waitUntil: "commit",
    });

    if (!response || !response.ok()) {
      throw new Error(`HTTP ${response?.status() || "Unknown"}`);
    }

    const bodyText = await page.textContent("body");
    const elapsed = Date.now() - startTime;
    const json = JSON.parse(bodyText || "{}");

    return {
      success: true,
      ip: json.ip || "Unknown IP",
      latencyMs: elapsed,
    };
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    let errMsg = err.message || "Lỗi không xác định";
    if (
      errMsg.includes("ERR_TIMED_OUT") ||
      errMsg.includes("Timeout") ||
      errMsg.includes("timeout")
    ) {
      errMsg =
        "Quá thời gian chờ (Proxy Timeout - Kiểm tra lại server proxy hoặc whitelist IP mạng nhà).";
    } else if (errMsg.includes("ERR_PROXY_CONNECTION_FAILED")) {
      errMsg =
        "Không kết nối được tới Proxy (Sai IP/Port hoặc máy chủ proxy offline).";
    } else if (
      errMsg.includes("ERR_PROXY_AUTH_REQUESTED") ||
      errMsg.includes("407")
    ) {
      errMsg =
        "Proxy yêu cầu tài khoản/mật khẩu xác thực (407 Proxy Authentication Required).";
    }
    return {
      success: false,
      latencyMs: elapsed,
      error: errMsg,
    };
  } finally {
    if (testBrowser) {
      await testBrowser.close().catch(() => {});
    }
  }
}

export interface TikTokCookieObject {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Universal Cookie Parser cho TikTok & MMO:
 * Hỗ trợ mọi định dạng cookie phổ biến trên thị trường MMO:
 * 1. Chuỗi header: "sessionid=xxxx; sid_tt=yyyy; tt_chain_token=zzzz; ..."
 * 2. JSON Array từ extensions (EditThisCookie, J2TEAM, Cookie-Editor)
 * 3. Base64 encoded JSON hoặc chuỗi cookie
 * 4. Netscape format (tab-separated)
 */
export function normalizeTikTokCookies(
  rawCookies?: string | any[] | null,
): TikTokCookieObject[] {
  if (!rawCookies) return [];

  let data: any = rawCookies;

  if (typeof data === "string") {
    let str = data.trim();
    if (!str) return [];

    // 1. Thử giải mã nếu là chuỗi Base64
    if (
      !str.startsWith("[") &&
      !str.startsWith("{") &&
      !str.includes(";") &&
      str.length > 30
    ) {
      try {
        const decoded = Buffer.from(str, "base64").toString("utf-8");
        if (
          decoded.startsWith("[") ||
          decoded.startsWith("{") ||
          decoded.includes("=")
        ) {
          str = decoded.trim();
        }
      } catch (_) {}
    }

    // 2. Thử parse nếu là JSON
    if (str.startsWith("[") || str.startsWith("{")) {
      try {
        data = JSON.parse(str);
      } catch (_) {
        // Fallback sang xử lý text
      }
    }

    // 3. Nếu vẫn là chuỗi: parse dạng "name=val; name2=val2" hoặc Netscape
    if (typeof data === "string") {
      const results: TikTokCookieObject[] = [];

      // Netscape tab-separated format
      if (str.includes("\t")) {
        const lines = str.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const cols = trimmed.split("\t");
          if (cols.length >= 7) {
            results.push({
              domain: cols[0].startsWith(".") ? cols[0] : `.${cols[0]}`,
              path: cols[2] || "/",
              secure: cols[3].toUpperCase() === "TRUE",
              expires: parseInt(cols[4], 10) || undefined,
              name: cols[5].trim(),
              value: cols[6].trim(),
            });
          }
        }
        if (results.length > 0) return results;
      }

      // Chuẩn HTTP Cookie string: name=value; name2=value2
      const pairs = str.split(";");
      for (const pair of pairs) {
        const trimmed = pair.trim();
        if (!trimmed) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const name = trimmed.substring(0, eqIdx).trim();
          let value = trimmed.substring(eqIdx + 1).trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          if (name && value) {
            results.push({
              name,
              value,
              domain: ".tiktok.com",
              path: "/",
              secure: true,
              sameSite: name === "sessionid_ss" ? "None" : "Lax",
            });
          }
        }
      }
      return results;
    }
  }

  // 4. Nếu là Array (từ JSON parse hoặc object array)
  if (Array.isArray(data)) {
    return data
      .map((item: any) => {
        if (!item || !item.name || item.value === undefined) return null;
        const name = String(item.name).trim();
        const value = String(item.value).trim();
        if (!name) return null;

        // Bỏ qua các cookie prefix __Host- ngoại lai để tránh lỗi CDP Protocol error
        // Chuẩn hóa domain: nếu thuộc tiktok.com thì chuẩn hóa về .tiktok.com để mọi subdomain (studio, www...) đều dùng được
        let domain = item.domain ? String(item.domain).trim() : ".tiktok.com";
        if (domain.includes("tiktok.com")) {
          domain = ".tiktok.com";
        } else if (!domain.startsWith(".")) {
          domain = `.${domain}`;
        }

        let expires: number | undefined;
        if (typeof item.expires === "number" && item.expires > 0) {
          expires = Math.floor(item.expires);
        } else if (
          typeof item.expirationDate === "number" &&
          item.expirationDate > 0
        ) {
          expires = Math.floor(item.expirationDate);
        }

        // Chuyển đổi timestamp từ milliseconds sang seconds nếu cần (CDP / Playwright yêu cầu seconds)
        if (expires && expires > 100000000000) {
          expires = Math.floor(expires / 1000);
        }

        const isSameSiteNone =
          item.sameSite === "None" || name === "sessionid_ss";
        const secure =
          item.secure !== undefined
            ? Boolean(item.secure)
            : domain.includes("tiktok.com") || isSameSiteNone;

        const res: TikTokCookieObject = {
          name,
          value,
          domain,
          path: item.path || "/",
          expires,
          httpOnly:
            item.httpOnly !== undefined
              ? Boolean(item.httpOnly)
              : name.includes("sessionid") || name.includes("sid_tt")
                ? true
                : undefined,
          secure: isSameSiteNone ? true : secure,
        };

        if (
          item.sameSite === "Strict" ||
          item.sameSite === "Lax" ||
          item.sameSite === "None"
        ) {
          res.sameSite = item.sameSite;
        } else if (name === "sessionid_ss") {
          res.sameSite = "None";
        }

        return res;
      })
      .filter((c): c is TikTokCookieObject => c !== null && Boolean(c.name));
  }

  return [];
}

/**
 * Kiểm tra xem dữ liệu cookies có chứa phiên đăng nhập TikTok hợp lệ hay không.
 * Phiên đăng nhập TikTok bắt buộc phải có sessionid hoặc sessionid_ss hoặc sid_tt.
 * Tránh trường hợp chỉ có các cookie theo dõi ẩn danh (ttwid, tt_csrf_token...) nhưng báo "Đã đăng nhập".
 */
export function isTikTokLoggedIn(rawCookies?: string | any[] | null): boolean {
  if (!rawCookies) return false;
  try {
    const list = normalizeTikTokCookies(rawCookies);
    return list.some(
      (c) =>
        (c.name === "sessionid" ||
          c.name === "sessionid_ss" ||
          c.name === "sid_tt") &&
        c.value &&
        String(c.value).trim().length > 5,
    );
  } catch {
    return false;
  }
}

/**
 * Khởi chạy Browser Context cho một profile
 */
export async function launchProfileContext(
  profile: ProfileRecord,
  headless = false,
  options?: { viewport?: { width: number; height: number } | null },
): Promise<{ context: BrowserContext; page: Page }> {
  const userDataDir = path.join(PROFILES_DIR, profile.name);
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // Nếu context đang tồn tại từ phiên trước, dọn dẹp trước khi mở mới
  if (activeContexts.has(profile.id)) {
    try {
      const oldCtx = activeContexts.get(profile.id);
      await oldCtx?.close().catch(() => {});
    } catch (_) {}
    activeContexts.delete(profile.id);
  }

  // Dọn sạch hoàn toàn các tiến trình Chrome cũ và lock files trước khi mở
  await releaseProfileLocks(userDataDir, profile.name);
  cleanProfileGpuCache(userDataDir);

  const defaultViewport = headless
    ? { width: 1280, height: 800 }
    : options?.viewport !== undefined
      ? options.viewport
      : { width: 1280, height: 800 };

  const launchOptions: any = {
    headless,
    viewport: defaultViewport,
    args: [...CLEAN_CHROME_ARGS],
    ...resolveBrowserLaunchOptions(),
  };

  // Cấu hình Proxy nếu có
  const proxyConfig = parseProxy(profile.proxy);
  if (proxyConfig) {
    launchOptions.proxy = proxyConfig;
    console.log(
      `[${profile.name}] 🌐 Kích hoạt Proxy: ${proxyConfig.server} ${
        proxyConfig.username
          ? `(User: ${proxyConfig.username})`
          : "(Direct Auth)"
      }`,
    );
  }

  const context = await chromium.launchPersistentContext(
    userDataDir,
    launchOptions,
  );

  // Nạp cookies thông minh nếu có (hỗ trợ JSON, Base64, string header sessionid=...)
  if (profile.cookies) {
    try {
      const parsedCookies = normalizeTikTokCookies(profile.cookies);
      if (parsedCookies.length > 0) {
        try {
          await context.addCookies(parsedCookies as any);
        } catch (batchErr: any) {
          console.warn(
            `[${profile.name}] Nạp batch cookies thất bại, đang nạp từng cookie:`,
            batchErr.message,
          );
          for (const c of parsedCookies) {
            try {
              await context.addCookies([c as any]);
            } catch (_) {}
          }
        }
        console.log(
          `[${profile.name}] 🍪 Đã nạp thành công ${parsedCookies.length} cookies vào trình duyệt.`,
        );
      }
    } catch (e: any) {
      console.warn(`[${profile.name}] Cảnh báo khi nạp cookies:`, e.message);
    }
  }

  activeContexts.set(profile.id, context);

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  // Tự động đóng context khi TẤT CẢ các tab đều bị đóng (cho phép mở/đóng tab linh hoạt)
  const checkAllPagesClosed = () => {
    setTimeout(async () => {
      try {
        const remaining = context.pages().filter((p) => !p.isClosed());
        if (remaining.length === 0) {
          await context.close().catch(() => {});
        }
      } catch (_) {}
    }, 250);
  };
  page.on("close", checkAllPagesClosed);
  context.on("page", (p) => p.on("close", checkAllPagesClosed));

  return { context, page };
}

/**
 * Đưa cửa sổ trình duyệt đang mở của profile lên tiền cảnh (focus / bring to front)
 */
export async function focusProfileBrowser(profileId: string): Promise<boolean> {
  const context = activeContexts.get(profileId);
  if (!context) return false;

  const pages = context.pages().filter((p) => !p.isClosed());
  if (pages.length === 0) return false;

  try {
    const page = pages[pages.length - 1];
    await page.bringToFront().catch(() => {});

    const profile = profileRepo.getById(profileId);
    if (profile) {
      const userDataDir = path.join(PROFILES_DIR, profile.name);
      const pids = await getProfilePids(userDataDir);
      if (pids.length > 0) {
        if (process.platform === "win32") {
          // Trên Windows: Đưa cửa sổ Chrome lên tiền cảnh bằng WScript.Shell
          const psFocus = `powershell -NoProfile -NonInteractive -Command "(New-Object -ComObject WScript.Shell).AppActivate(${pids[0]})"`;
          execAsync(psFocus).catch(() => {});
        } else if (process.platform === "darwin") {
          // Trên macOS: Focus chính xác process Chrome/Chromium của profile này bằng unix id (PID)
          for (const pid of pids) {
            execAsync(
              `osascript -e 'tell application "System Events" to set frontmost of first process whose unix id is ${pid} to true'`,
            ).catch(() => {});
          }
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function getCookieDbPath(userDataDir: string): string | null {
  if (!userDataDir || !fs.existsSync(userDataDir)) return null;
  const networkCookies = path.join(
    userDataDir,
    "Default",
    "Network",
    "Cookies",
  );
  if (fs.existsSync(networkCookies)) return networkCookies;
  const legacyCookies = path.join(userDataDir, "Default", "Cookies");
  if (fs.existsSync(legacyCookies)) return legacyCookies;
  return null;
}

/**
 * Kiểm tra nhanh trực tiếp file SQLite Cookies trên đĩa cứng xem có chứa sessionid hay không (< 1ms)
 */
export function hasSessionInCookieDb(userDataDir: string): boolean {
  const cookieDb = getCookieDbPath(userDataDir);
  if (!cookieDb) return false;
  let tempDb: Database.Database | null = null;
  try {
    tempDb = new Database(cookieDb, {
      readonly: true,
      fileMustExist: true,
      timeout: 1000,
    });
    const row = tempDb
      .prepare(
        "SELECT 1 FROM cookies WHERE (name = 'sessionid' OR name = 'sessionid_ss' OR name = 'sid_tt') LIMIT 1",
      )
      .get();
    return Boolean(row);
  } catch {
    return false;
  } finally {
    try {
      tempDb?.close();
    } catch (_) {}
  }
}

/**
 * Trích xuất an toàn mảng cookies đầy đủ từ thư mục userDataDir bằng Chromium headless (< 150ms)
 */
export async function extractProfileCookies(
  userDataDir: string,
): Promise<any[]> {
  if (!userDataDir || !fs.existsSync(userDataDir)) return [];
  try {
    const headlessCtx = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      args: [...CLEAN_CHROME_ARGS],
      ...resolveBrowserLaunchOptions(),
    });
    const cookies = await headlessCtx.cookies().catch(() => []);
    await headlessCtx.close().catch(() => {});
    return cookies;
  } catch (e: any) {
    console.warn(
      `[extractProfileCookies] Lỗi khi trích xuất cookies:`,
      e.message,
    );
    return [];
  }
}

/**
 * Mở trình duyệt để người dùng đăng nhập thủ công, tự động lưu Cookie khi đóng
 */
export async function openManualBrowser(
  profile: ProfileRecord,
  onClosed?: () => void,
  onUpdated?: () => void,
): Promise<void> {
  const { context, page } = await launchProfileContext(profile, false, {
    viewport: null,
  });
  profileRepo.updateStatus(profile.id, "manual_session");

  await page
    .goto("https://www.tiktok.com/", { waitUntil: "domcontentloaded" })
    .catch(() => {});

  const userDataDir = path.join(PROFILES_DIR, profile.name);
  let isCleanedUp = false;

  const handleClose = async () => {
    if (isCleanedUp) return;
    isCleanedUp = true;

    try {
      let cookies: any[] = [];
      try {
        cookies = await context.cookies().catch(() => []);
      } catch (_) {}

      if (cookies.length === 0 && hasSessionInCookieDb(userDataDir)) {
        cookies = await extractProfileCookies(userDataDir);
      }

      const loggedIn = isTikTokLoggedIn(cookies);
      if (loggedIn) {
        profileRepo.update({
          id: profile.id,
          cookies: JSON.stringify(cookies),
          status: "idle",
        });
        console.log(
          `[${profile.name}] ✅ Đã xác nhận đăng nhập TikTok thành công (Có sessionid)!`,
        );
        if (onUpdated) onUpdated();
      } else {
        profileRepo.updateStatus(profile.id, "idle");
      }
    } catch (err: any) {
      console.warn(
        `[${profile.name}] Lỗi khi xử lý đóng trình duyệt:`,
        err?.message,
      );
      profileRepo.updateStatus(profile.id, "idle");
    }

    activeContexts.delete(profile.id);
    await context.close().catch(() => {});

    // Chờ 300ms để Chrome hoàn tất ghi disk và thoát tự nhiên trước khi dọn lock
    await new Promise((r) => setTimeout(r, 300));
    await releaseProfileLocks(userDataDir, profile.name).catch(() => {});

    if (onClosed) onClosed();
  };

  // QUAN TRỌNG: Chỉ lắng nghe context.on('close'), TUYỆT ĐỐI KHÔNG gán page.on('close', handleClose)
  // để người dùng đóng tab đầu tiên (tiktok.com) vẫn không bị đóng luôn toàn bộ trình duyệt!
  context.on("close", handleClose);
}

/**
 * Kiểm tra xem profile có đang mở trình duyệt trong browser pool hay không
 */
export function isProfileActive(profileId: string): boolean {
  return activeContexts.has(profileId);
}

/**
 * Đóng an toàn phiên của một profile
 */
export async function closeProfileContext(profileId: string): Promise<void> {
  const profile = profileRepo.getById(profileId);
  const ctx = activeContexts.get(profileId);
  if (ctx) {
    try {
      const cookies = await ctx.cookies().catch(() => []);
      if (isTikTokLoggedIn(cookies)) {
        profileRepo.update({
          id: profileId,
          cookies: JSON.stringify(cookies),
        });
      }
      await ctx.close().catch(() => {});
    } catch (_) {}
    activeContexts.delete(profileId);
  }

  if (profile) {
    const userDataDir = path.join(PROFILES_DIR, profile.name);
    await releaseProfileLocks(userDataDir, profile.name).catch(() => {});
  }
}

/**
 * Đóng toàn bộ các context browser đang chạy khi app thoát hoặc tắt
 */
export async function closeAllActiveContexts(): Promise<void> {
  const ids = Array.from(activeContexts.keys());
  for (const id of ids) {
    await closeProfileContext(id).catch(() => {});
  }
  activeContexts.clear();
}
