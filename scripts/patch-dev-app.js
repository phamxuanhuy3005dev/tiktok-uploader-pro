const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (process.platform === 'darwin') {
  const electronDist = path.join(__dirname, '../node_modules/electron/dist');
  const oldApp = path.join(electronDist, 'Electron.app');
  const newApp = path.join(electronDist, 'TikTok Uploader Pro.app');
  const pathFile = path.join(__dirname, '../node_modules/electron/path.txt');

  // 1. Đổi tên bundle từ "Electron.app" sang "TikTok Uploader Pro.app"
  if (fs.existsSync(oldApp) && !fs.existsSync(newApp)) {
    try {
      fs.renameSync(oldApp, newApp);
      console.log('✅ Đã đổi tên bundle macOS thành "TikTok Uploader Pro.app"');
    } catch (e) {
      console.warn('Không thể đổi tên Electron.app:', e.message);
    }
  }

  const targetApp = fs.existsSync(newApp) ? newApp : oldApp;
  const bundleName = path.basename(targetApp);

  // 2. Cập nhật path.txt để require('electron') trỏ thẳng vào bundle mới
  if (fs.existsSync(pathFile)) {
    try {
      fs.writeFileSync(pathFile, `${bundleName}/Contents/MacOS/Electron`, 'utf8');
    } catch (_) {}
  }

  // 3. Cập nhật Info.plist hiển thị chuẩn tên "TikTok Uploader Pro"
  const infoPlist = path.join(targetApp, 'Contents/Info.plist');
  if (fs.existsSync(infoPlist)) {
    try {
      execSync(`plutil -replace CFBundleDisplayName -string "TikTok Uploader Pro" "${infoPlist}"`);
      execSync(`plutil -replace CFBundleName -string "TikTok Uploader Pro" "${infoPlist}"`);
    } catch (_) {}
  }

  // 4. Cập nhật Icon ứng dụng
  const icnsSrc = path.join(__dirname, '../resources/icon.icns');
  const icnsDest = path.join(targetApp, 'Contents/Resources/electron.icns');
  if (fs.existsSync(icnsSrc) && fs.existsSync(path.dirname(icnsDest))) {
    try {
      fs.copyFileSync(icnsSrc, icnsDest);
      const iconDest2 = path.join(targetApp, 'Contents/Resources/icon.icns');
      fs.copyFileSync(icnsSrc, iconDest2);
    } catch (_) {}
  }

  // 5. Làm mới bộ nhớ đệm LaunchServices của macOS
  try {
    const lsregister =
      '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
    if (fs.existsSync(lsregister)) {
      execSync(`"${lsregister}" -f "${targetApp}"`, { stdio: 'ignore' });
    }
  } catch (_) {}
}

