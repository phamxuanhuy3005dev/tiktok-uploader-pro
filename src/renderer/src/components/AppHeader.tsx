import React from 'react';
import { 
  Sparkles, 
  Plus, 
  Layers, 
  Activity, 
  Terminal, 
  Settings 
} from 'lucide-react';
import { Button } from './ui/Button';
import appIcon from '../assets/icon.png';

export type TabType = 'profiles' | 'queue' | 'logs' | 'settings';

interface AppHeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onAddProfile: () => void;
  totalProfiles: number;
  runningCount: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  onTabChange,
  onAddProfile,
  totalProfiles,
  runningCount
}) => {
  const tabs = [
    {
      id: 'profiles' as TabType,
      label: 'Kênh & Profiles',
      icon: Layers,
      badge: totalProfiles > 0 ? totalProfiles : undefined
    },
    {
      id: 'queue' as TabType,
      label: 'Tiến Trình Chạy',
      icon: Activity,
      badge: runningCount > 0 ? `${runningCount} đang chạy` : undefined,
      pulse: runningCount > 0
    },
    {
      id: 'logs' as TabType,
      label: 'Nhật Ký Upload',
      icon: Terminal
    },
    {
      id: 'settings' as TabType,
      label: 'Cài Đặt',
      icon: Settings
    }
  ];

  return (
    <header className="bg-white border-b border-slate-200/90 shadow-sm sticky top-0 z-30 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top bar: Added pl-20 on macOS so traffic light buttons (red, yellow, green) never overlap */}
        <div 
          className="flex items-center justify-between h-16 gap-4 pl-20 sm:pl-22"
          style={{ WebkitAppRegion: 'drag' } as any}
        >
          {/* Logo & Brand */}
          <div 
            className="flex items-center gap-3 shrink-0"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <div className="h-10 w-10 rounded-xl shadow-md shadow-sky-500/20 shrink-0 overflow-hidden border border-sky-100 bg-sky-50 flex items-center justify-center">
              <img src={appIcon} alt="App Icon" className="h-full w-full object-cover rounded-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-800 tracking-tight">TikTok Uploader Pro</h1>
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-600 border border-sky-200">
                  <Sparkles className="h-3 w-3" /> US / Global MMO
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Tự động hóa đăng video • Gắn nhạc Favorites xoay vòng • Đặt lịch giãn cách
              </p>
            </div>
          </div>

          {/* Quick Actions (Concurrency picker removed, only Add Profile button) */}
          <div 
            className="flex items-center gap-2.5"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <Button
              variant="default"
              size="sm"
              onClick={onAddProfile}
              className="text-xs shadow-sm shadow-sky-500/20"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Thêm Profile
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div 
          className="flex items-center gap-1 -mb-px overflow-x-auto scrollbar-none pt-1"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
                  isActive
                    ? 'border-sky-500 text-sky-600 bg-sky-50/50 rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-sky-500' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      tab.pulse
                        ? 'bg-rose-500 text-white animate-pulse'
                        : isActive
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-slate-100 text-slate-500'
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
