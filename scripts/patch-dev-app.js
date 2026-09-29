const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (process.platform === 'darwin') {
  const infoPlist = path.join(__dirname, '../node_modules/electron/dist/Electron.app/Contents/Info.plist');
  const icnsDest = path.join(__dirname, '../node_modules/electron/dist/Electron.app/Contents/Resources/electron.icns');
  const icnsSrc = path.join(__dirname, '../resources/icon.icns');

  if (fs.existsSync(infoPlist)) {
    try {
      execSync(`plutil -replace CFBundleDisplayName -string "TikTok Uploader Pro" "${infoPlist}"`);
      execSync(`plutil -replace CFBundleName -string "TikTok Uploader Pro" "${infoPlist}"`);
      console.log('✅ Đã cập nhật tên hiển thị macOS Dock thành "TikTok Uploader Pro"');
    } catch (_) {}
  }

  if (fs.existsSync(icnsSrc) && fs.existsSync(path.dirname(icnsDest))) {
    try {
      fs.copyFileSync(icnsSrc, icnsDest);
      console.log('✅ Đã cập nhật icon mặc định cho dev app');
    } catch (_) {}
  }
}
