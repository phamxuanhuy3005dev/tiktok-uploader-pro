import {
  Activity,
  Clock,
  FileJson,
  Layers,
  Plus,
  Settings,
  Sparkles,
  Terminal,
} from "lucide-react";
import React from "react";
import appIcon from "../assets/icon.png";
import { Button } from "./ui/Button";

export type TabType = "profiles" | "queue" | "logs" | "settings";

interface AppHeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onAddProfile: () => void;
  onBulkImport?: () => void;
  onCooldownGuide?: () => void;
  totalProfiles: number;
  runningCount: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  onTabChange,
  onAddProfile,
  onBulkImport,
  onCooldownGuide,
  totalProfiles,
  runningCount,
}) => {
  const tabs = [
    {
      id: "profiles" as TabType,
      label: "Kênh & Profiles",
      icon: Layers,
      badge: totalProfiles > 0 ? totalProfiles : undefined,
    },
    {
      id: "queue" as TabType,
      label: "Tiến Trình Chạy",
      icon: Activity,
      badge: runningCount > 0 ? `${runningCount} đang chạy` : undefined,
      pulse: runningCount > 0,
    },
    {
      id: "logs" as TabType,
      label: "Nhật Ký Upload",
      icon: Terminal,
    },
    {
      id: "settings" as TabType,
      label: "Cài Đặt",
      icon: Settings,
    },
  ];

  return (
    <header className="sticky top-0 z-30 select-none border-b border-slate-200/90 bg-white shadow-sm">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        {/* Top bar: Added pl-20 on macOS so traffic light buttons (red, yellow, green) never overlap */}
        <div
          className="sm:pl-22 flex h-16 items-center justify-between gap-4 pl-20"
          style={{ WebkitAppRegion: "drag" } as any}
        >
          {/* Logo & Brand */}
          <div
            className="flex shrink-0 items-center gap-3"
            style={{ WebkitAppRegion: "no-drag" } as any}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sky-100 bg-sky-50 shadow-md shadow-sky-500/20">
              <img
                src={appIcon}
                alt="App Icon"
                className="h-full w-full rounded-xl object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-800">
                  TikTok Uploader Pro
                </h1>
                <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-600">
                  <Sparkles className="h-3 w-3" /> US / Global MMO
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Tự động hóa đăng video • Gắn nhạc Favorites xoay vòng • Đặt lịch
                giãn cách
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div
            className="flex items-center gap-2"
            style={{ WebkitAppRegion: "no-drag" } as any}
          >
            {onCooldownGuide && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCooldownGuide}
                title="Xem hướng dẫn cơ chế tính 24h & cách đặt tên nhóm kênh nuôi"
                className="h-8 shrink-0 cursor-help border-amber-300 bg-amber-50 px-2.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
              >
                <Clock className="mr-1 h-3.5 w-3.5 text-amber-600" /> HD
                Cooldown 24h
              </Button>
            )}

            {onBulkImport && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkImport}
                title="Nhập danh sách profiles từ file JSON hoặc dán JSON"
                className="border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-50"
              >
                <FileJson className="mr-1 h-3.5 w-3.5 text-sky-500" /> Nhập JSON
              </Button>
            )}

            <Button
              variant="default"
              size="sm"
              onClick={onAddProfile}
              className="text-xs shadow-sm shadow-sky-500/20"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Thêm Profile
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className="scrollbar-none -mb-px flex items-center gap-1 overflow-x-auto pt-1"
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "rounded-t-lg border-sky-500 bg-sky-50/50 text-sky-600"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive ? "text-sky-500" : "text-slate-400"}`}
                />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      tab.pulse
                        ? "animate-pulse bg-rose-500 text-white"
                        : isActive
                          ? "bg-sky-100 text-sky-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
