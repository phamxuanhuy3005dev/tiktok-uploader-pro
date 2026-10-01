import React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Clock, ShieldCheck, Tag, Play, CheckCircle2, Info, Sparkles } from 'lucide-react';

interface CooldownGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CooldownGuideModal: React.FC<CooldownGuideModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🛡️ Hướng Dẫn Tính Năng Cooldown 24 Giờ"
      description="Cơ chế bảo vệ kênh nuôi tự động giúp kênh tăng uy tín, tránh bị TikTok bóp tương tác hoặc dính lỗi spam."
      className="max-w-xl"
    >
      <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
        {/* Section 1: Tại sao cần 24h? */}
        <div className="p-3.5 bg-sky-50/70 border border-sky-200/80 rounded-xl space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-sky-950 text-[13px]">
            <Sparkles className="h-4 w-4 text-sky-600" />
            <span>1. Tại sao cần giãn cách 24 tiếng giữa các lần đăng?</span>
          </div>
          <p className="text-slate-600">
            Đối với các tài khoản TikTok đang trong giai đoạn <b>nuôi kênh (warm-up)</b> để tăng uy tín hoặc phấn đấu đạt mốc 1.000 followers, mỗi ngày chỉ nên đăng từ 1-5 video và khoảng cách giữa các đợt đăng phải <b>đủ 24 tiếng thực tế</b>. Đăng quá dồn dập sẽ bị thuật toán TikTok đánh giá là hành vi tự động/spam và bóp lượt xem (views).
          </p>
        </div>

        {/* Section 2: Cách kích hoạt qua tên nhóm */}
        <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-950 text-[13px]">
            <Tag className="h-4 w-4 text-amber-600" />
            <span>2. Cách kích hoạt: Đặt tên nhóm thông minh</span>
          </div>
          <p className="text-slate-600">
            Hệ thống tự động nhận diện và bật tính toán 24h cho tất cả các kênh thuộc nhóm có tên chứa các từ khóa:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {['nuôi', 'nuoi', 'warmup', 'warm-up', 'nurture', 'kênh mới', 'mới'].map((keyword) => (
              <span
                key={keyword}
                className="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-md text-[11px]"
              >
                {keyword}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 italic">
            Ví dụ: <code>Nuôi US</code>, <code>nuoi-vo-tri</code>, <code>Warmup-01</code>, <code>Kênh Nuôi Mới</code>... Các nhóm không có từ khóa này (ví dụ: <i>Kênh Già</i>, <i>Spam Video</i>) sẽ tự động chạy tự do không bị giới hạn 24h.
          </p>
        </div>

        {/* Section 3: Nhận biết trên giao diện */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-[13px]">
            <Clock className="h-4 w-4 text-slate-600" />
            <span>3. Hiển thị đếm ngược trên giao diện</span>
          </div>
          <p className="text-slate-600">
            Ngay khi kênh đăng video thành công, hệ thống tự động ghi nhớ thời gian và kích hoạt đồng hồ đếm ngược:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 bg-white border border-amber-200 rounded-lg flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
                <Clock className="h-3 w-3 text-amber-600 animate-pulse" />
                Chờ 24h: Còn 23h 53m
              </span>
              <span className="text-[10px] text-slate-500">Chưa đủ 24 tiếng</span>
            </div>
            <div className="p-2.5 bg-white border border-emerald-200 rounded-lg flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Đã đủ 24h
              </span>
              <span className="text-[10px] text-slate-500">Sẵn sàng đăng an toàn</span>
            </div>
          </div>
        </div>

        {/* Section 4: Cơ chế không chặn cứng */}
        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-emerald-950 text-[13px]">
            <Play className="h-4 w-4 text-emerald-600 fill-emerald-600" />
            <span>4. Quyền quyết định luôn thuộc về bạn (Không chặn cứng)</span>
          </div>
          <p className="text-slate-600">
            Khi bạn bấm chạy (riêng lẻ hay hàng loạt), nếu có kênh chưa đủ 24h, hệ thống sẽ đưa ra bảng cảnh báo kèm 2 lựa chọn:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-700">
            <li>
              <b>Chỉ chạy kênh đã đủ 24h:</b> Tự động bỏ qua các kênh chưa đủ thời gian để bảo vệ tài khoản.
            </li>
            <li>
              <b>Vẫn chạy tất cả:</b> Cho phép bạn chủ động vượt qua cảnh báo và chạy ngay lập tức theo nhu cầu.
            </li>
          </ul>
        </div>

        {/* Nút đóng */}
        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <Button type="button" onClick={onClose} size="sm" className="text-xs px-4">
            Đã Hiểu
          </Button>
        </div>
      </div>
    </Modal>
  );
};
