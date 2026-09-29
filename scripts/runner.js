#!/usr/bin/env node

/**
 * TikTok Uploader Pro - Smart Cross-Platform Runner
 * Tự động đồng bộ code (git pull), cài đặt thư viện, tải Chromium,
 * tự động build khi có code mới và khởi chạy app siêu tốc.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, spawn, execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CACHE_FILE = path.join(DATA_DIR, '.runner-cache.json');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_INDEX = path.join(ROOT_DIR, 'out', 'renderer', 'index.html');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function writeCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {}
}

function runCmd(command, args, cwd = ROOT_DIR) {
  const isWin = process.platform === 'win32';
  const cmdToRun = isWin && (command === 'npm' || command === 'npx') ? `${command}.cmd` : command;

  let res = spawnSync(cmdToRun, args, {
    cwd,
    stdio: 'inherit',
    shell: isWin,
    env: process.env
  });

  if (res.error && isWin) {
    res = spawnSync(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: process.env
    });
  }

  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`Lệnh "${command} ${args.join(' ')}" thất bại với mã lỗi ${res.status}`);
  }
}

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

function getFilesRecursively(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      files = files.concat(getFilesRecursively(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function calculateSourceHash() {
  const hash = crypto.createHash('sha256');
  const srcFiles = getFilesRecursively(SRC_DIR);
  const configFiles = [
    path.join(ROOT_DIR, 'package.json'),
    path.join(ROOT_DIR, 'electron.vite.config.ts'),
    path.join(ROOT_DIR, 'tailwind.config.js')
  ];

  const allFiles = [...srcFiles, ...configFiles.filter((f) => fs.existsSync(f))].sort();
  for (const file of allFiles) {
    const relPath = path.relative(ROOT_DIR, file);
    hash.update(relPath);
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

async function main() {
  console.log('==========================================================');
  console.log('    🚀 TikTok Uploader Pro (MMO Automation Engine)');
  console.log('==========================================================\n');

  const cache = readCache();

  // 1. Tự động Git Pull cập nhật code mới nếu là git repo
  if (fs.existsSync(path.join(ROOT_DIR, '.git'))) {
    try {
      console.log('🔄 [1/5] Đang kiểm tra cập nhật từ Git...');
      const pullRes = spawnSync('git', ['pull', '--ff-only'], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        timeout: 10000
      });
      if (pullRes.status === 0) {
        const out = pullRes.stdout ? pullRes.stdout.trim() : '';
        if (out.includes('Already up to date') || out.includes('Already up-to-date')) {
          console.log('✅ Mã nguồn đã ở phiên bản mới nhất.\n');
        } else {
          console.log('✨ Đã tải về các bản cập nhật mới nhất từ Git!\n');
        }
      }
    } catch (_) {
      console.log('ℹ️  Bỏ qua cập nhật Git (offline hoặc đang ở nhánh riêng).\n');
    }
  }

  // 2. Kiểm tra thư viện node_modules
  const pkgPath = path.join(ROOT_DIR, 'package.json');
  const pkgHash = hashFile(pkgPath);
  const electronInstalled = fs.existsSync(path.join(ROOT_DIR, 'node_modules', 'electron'));
  const needsInstall = !electronInstalled || cache.pkgHash !== pkgHash;

  if (needsInstall) {
    console.log('📦 [2/5] Đang chuẩn bị thư viện (lần đầu hoặc có thư viện mới)...');
    runCmd('npm', ['install']);
    cache.pkgHash = pkgHash;
    writeCache(cache);
    console.log('✅ Thư viện npm đã sẵn sàng!\n');
  } else {
    console.log('✅ [2/5] Thư viện npm: Đã sẵn sàng.');
  }

  // 3. Kiểm tra trình duyệt Chromium của Playwright
  try {
    const { chromium } = require('playwright');
    const pPath = chromium.executablePath();
    if (!fs.existsSync(pPath)) {
      console.log('🌐 [3/5] Đang tải engine Chromium cho Playwright (lần đầu tiên)...');
      runCmd('npx', ['playwright', 'install', 'chromium']);
      console.log('✅ Đã tải xong Chromium!\n');
    } else {
      console.log('✅ [3/5] Engine Chromium: Đã sẵn sàng.');
    }
  } catch (_) {
    try {
      runCmd('npx', ['playwright', 'install', 'chromium']);
    } catch (_) {}
  }

  // 4. Đồng bộ tên hiển thị và Icon trên macOS Dock
  if (process.platform === 'darwin') {
    try {
      require('./patch-dev-app.js');
    } catch (_) {}
  }

  // 5. Kiểm tra mã nguồn & Tự động Build
  const currentHash = calculateSourceHash();
  const buildMissing = !fs.existsSync(DIST_INDEX);
  const codeChanged = cache.buildHash !== currentHash;
  const needsBuild = buildMissing || codeChanged;

  if (needsBuild) {
    if (buildMissing) {
      console.log('🔨 [4/5] Chưa có bản build giao diện, đang biên dịch lần đầu...');
    } else {
      console.log('🔨 [4/5] Phát hiện code mới vừa cập nhật, đang tự động build lại...');
    }
    runCmd('npm', ['run', 'build']);
    cache.buildHash = currentHash;
    writeCache(cache);
    console.log('✅ Biên dịch hoàn tất!\n');
  } else {
    console.log('✅ [4/5] Bản build giao diện: Đã sẵn sàng và mới nhất.');
  }

  // 6. Khởi chạy Ứng Dụng ở chế độ Production mượt mà & không tốn tài nguyên dev server
  console.log('\n==========================================================');
  console.log('🎉 [5/5] Đang mở ứng dụng TikTok Uploader Pro...');
  console.log('💡 Đóng cửa sổ ứng dụng để thoát chương trình.');
  console.log('==========================================================\n');

  const electronPath = require('electron');
  const appProcess = spawn(electronPath, ['.'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });

  appProcess.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error('\n❌ [LỖI KHỞI CHẠY]:', err.message);
  process.exit(1);
});
