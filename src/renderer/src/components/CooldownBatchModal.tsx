import React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Clock, ShieldAlert, CheckCircle2, AlertTriangle, ShieldCheck, Play } from 'lucide-react';

export interface CooldownBatchItem {
  name: string;
  groupName?: string | null;
  remainingText: string;
  elapsedHours: number;
  lastRunFormatted?: string;
}

interface CooldownBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  cooldownProfiles: CooldownBatchItem[];
  safeCount: number;
  totalCount: number;
  onConfirmRunAll: () => void;
  onConfirmRunSafeOnly: () => void;
}

export const CooldownBatchModal: React.FC<CooldownBatchModalProps> = ({
  isOpen,
  onClose,
  cooldownProfiles,
  safeCount,
  totalCount,
  onConfirmRunAll,
  onConfirmRunSafeOnly
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚠️ Cảnh Báo Cooldown 24h (Kênh Đang Nuôi)"
      description="Hệ thống phát hiện có kênh nuôi chưa đủ thời gian giãn cách 24h an toàn."
      className="max-w-lg"
    >
      <div className="space-y-4">
        {/* Banner cảnh báo */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-950 block">Tại sao cần giãn cách 24 tiếng?</span>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Đối với các kênh đang trong giai đoạn <b>nuôi tương tác (warmup)</b>, đăng video trước 24h dễ bị thuật toán TikTok nhận diện là spam và bóp phân phối hiển thị (view).
            </p>
          </div>
        </div>

        {/* Danh sách kênh chưa đủ 24h */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5 text-amber-800">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              Kênh chưa đủ 24h ({cooldownProfiles.length})
            </span>
            <span className="text-[11px] text-slate-500 font-normal">Cần chờ thêm</span>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-xl border border-amber-200/80 divide-y divide-amber-100 bg-amber-50/30">
            {cooldownProfiles.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-slate-800 truncate">{item.name}</span>
                  {item.groupName && (
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                      {item.groupName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-semibold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full border border-amber-200">
                  <Clock className="h-3 w-3 animate-pulse" />
                  <span>Còn {item.remainingText}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thông tin kênh an toàn */}
        {safeCount > 0 && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              Có <b>{safeCount}</b> kênh đã đủ 24h và sẵn sàng đăng an toàn.
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
          {safeCount > 0 && (
            <Button
              type="button"
              onClick={onConfirmRunSafeOnly}
              className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm shadow-emerald-600/20"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Chỉ Chạy {safeCount} Kênh Đủ 24h
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={onConfirmRunAll}
            className="flex-1 text-xs border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold gap-1.5"
            title="Chạy tất cả các kênh đã chọn, bỏ qua cảnh báo 24h"
          >
            <Play className="h-3.5 w-3.5 text-amber-600 fill-amber-600" />
            Vẫn Chạy Tất Cả ({totalCount} Kênh)
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs text-slate-600 border-slate-200 hover:bg-slate-100"
          >
            Hủy Bỏ
          </Button>
        </div>
      </div>
    </Modal>
  );
};
