#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "    📦 Đang Đóng Gói (Build) TikTok Uploader Pro Cho macOS..."
echo "=========================================================="

npm run build:mac

echo ""
echo "=========================================================="
echo "    🎉 BUILD HOÀN TẤT!"
echo "    File cài đặt (.dmg) và nén (.zip) nằm trong thư mục: dist/"
echo "=========================================================="
open dist/
read -p "Bấm phím bất kỳ để thoát..."
