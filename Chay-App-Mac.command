#!/bin/bash
clear

# Chuyển vào thư mục chứa script
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# 1. Kiểm tra Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "==========================================================="
    echo "       TIKTOK UPLOADER PRO (MMO AUTOMATION ENGINE)         "
    echo "==========================================================="
    echo ""
    echo "❌ [LỖI] Máy tính của bạn chưa cài đặt Node.js!"
    echo ""
    echo "Vui lòng cài đặt Node.js để chạy công cụ:"
    echo "1. Tải bản cài đặt (LTS khuyên dùng) tại: https://nodejs.org/"
    echo "2. Chạy file cài đặt .pkg vừa tải về."
    echo "3. Nhấp đúp mở lại file Chay-App-Mac.command này."
    echo ""
    read -p "Bạn có muốn mở trang tải Node.js ngay bây giờ? (y/n) " ans
    if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
        open "https://nodejs.org/"
    fi
    exit 1
fi

# 2. Khởi chạy thông qua bộ điều phối Runner thông minh
node scripts/runner.js "$@"
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "==========================================================="
    echo "❌ [THÔNG BÁO] Ứng dụng đã dừng với mã: $EXIT_CODE"
    echo "==========================================================="
    read -n 1 -s -r -p "Nhấn phím bất kỳ để đóng cửa sổ..."
fi
