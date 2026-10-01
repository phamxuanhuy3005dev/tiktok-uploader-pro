import { CheckCircle2, Clock, Play, Sparkles, Tag } from "lucide-react";
import React from "react";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

interface CooldownGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CooldownGuideModal: React.FC<CooldownGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🛡️ Hướng Dẫn Tính Năng Cooldown 24 Giờ"
      description="Cơ chế bảo vệ kênh nuôi tự động giúp kênh tăng uy tín, tránh bị TikTok bóp tương tác hoặc dính lỗi spam."
      className="max-w-xl"
    >
      <div className="space-y-4 text-xs leading-relaxed text-slate-700">
        {/* Section 1: Tại sao cần 24h? */}
        <div className="space-y-1.5 rounded-xl border border-sky-200/80 bg-sky-50/70 p-3.5">
          <div className="flex items-center gap-2 text-[13px] font-bold text-sky-950">
            <Sparkles className="h-4 w-4 text-sky-600" />
            <span>1. Tại sao cần giãn cách 24 tiếng giữa các lần đăng?</span>
          </div>
          <p className="text-slate-600">
            Đối với các tài khoản TikTok đang trong giai đoạn{" "}
            <b>nuôi kênh (warm-up)</b> để tăng uy tín hoặc phấn đấu đạt mốc
            1.000 followers, mỗi ngày chỉ nên đăng từ 1-5 video và khoảng cách
            giữa các đợt đăng phải <b>đủ 24 tiếng thực tế</b>. Đăng quá dồn dập
            sẽ bị thuật toán TikTok đánh giá là hành vi tự động/spam và bóp lượt
            xem (views).
          </p>
        </div>

        {/* Section 2: Cách kích hoạt qua tên nhóm */}
        <div className="space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5">
          <div className="flex items-center gap-2 text-[13px] font-bold text-amber-950">
            <Tag className="h-4 w-4 text-amber-600" />
            <span>2. Cách kích hoạt: Đặt tên nhóm thông minh</span>
          </div>
          <p className="text-slate-600">
            Hệ thống tự động nhận diện và bật tính toán 24h cho tất cả các kênh
            thuộc nhóm có tên chứa các từ khóa:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {[
              "nuôi",
              "nuoi",
              "warmup",
              "warm-up",
              "nurture",
              "kênh mới",
              "mới",
            ].map((keyword) => (
              <span
                key={keyword}
                className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900"
              >
                {keyword}
              </span>
            ))}
          </div>
          <p className="text-[11px] italic text-slate-500">
            Ví dụ: <code>Nuôi US</code>, <code>nuoi-vo-tri</code>,{" "}
            <code>Warmup-01</code>, <code>Kênh Nuôi Mới</code>... Các nhóm không
            có từ khóa này (ví dụ: <i>Kênh Già</i>, <i>Spam Video</i>) sẽ tự
            động chạy tự do không bị giới hạn 24h.
          </p>
        </div>

        {/* Section 3: Nhận biết trên giao diện */}
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center gap-2 text-[13px] font-bold text-slate-900">
            <Clock className="h-4 w-4 text-slate-600" />
            <span>3. Hiển thị đếm ngược trên giao diện</span>
          </div>
          <p className="text-slate-600">
            Ngay khi kênh đăng video thành công, hệ thống tự động ghi nhớ thời
            gian và kích hoạt đồng hồ đếm ngược:
          </p>
          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white p-2.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                <Clock className="h-3 w-3 animate-pulse text-amber-600" />
                Chờ 24h: Còn 23h 53m
              </span>
              <span className="text-[10px] text-slate-500">
                Chưa đủ 24 tiếng
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Đã đủ 24h
              </span>
              <span className="text-[10px] text-slate-500">
                Sẵn sàng đăng an toàn
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Cơ chế không chặn cứng */}
        <div className="space-y-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5">
          <div className="flex items-center gap-2 text-[13px] font-bold text-emerald-950">
            <Play className="h-4 w-4 fill-emerald-600 text-emerald-600" />
            <span>4. Quyền quyết định luôn thuộc về bạn (Không chặn cứng)</span>
          </div>
          <p className="text-slate-600">
            Khi bạn bấm chạy (riêng lẻ hay hàng loạt), nếu có kênh chưa đủ 24h,
            hệ thống sẽ đưa ra bảng cảnh báo kèm 2 lựa chọn:
          </p>
          <ul className="list-inside list-disc space-y-1 pl-1 text-[11px] text-slate-700">
            <li>
              <b>Chỉ chạy kênh đã đủ 24h:</b> Tự động bỏ qua các kênh chưa đủ
              thời gian để bảo vệ tài khoản.
            </li>
            <li>
              <b>Vẫn chạy tất cả:</b> Cho phép bạn chủ động vượt qua cảnh báo và
              chạy ngay lập tức theo nhu cầu.
            </li>
          </ul>
        </div>

        {/* Nút đóng */}
        <div className="flex justify-end border-t border-slate-100 pt-2">
          <Button
            type="button"
            onClick={onClose}
            size="sm"
            className="px-4 text-xs"
          >
            Đã Hiểu
          </Button>
        </div>
      </div>
    </Modal>
  );
};
