import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Film,
  Filter,
  Layers,
  List,
  RefreshCw,
  Search,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { formatDateTime, formatTime } from "../utils/date";

interface LogsScreenProps {
  liveLogs?: any[];
  onClearLiveLogs?: () => void;
}

export const LogsScreen: React.FC<LogsScreenProps> = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "success" | "failed"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grouped" | "table">("grouped");
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(
    new Set(),
  );

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await window.api.getAllLogs();
      setLogs(data || []);
    } catch (err: any) {
      toast.error(`Không thể tải nhật ký: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleClearLogs = async () => {
    if (
      confirm(
        "Bạn có chắc chắn muốn xóa toàn bộ lịch sử nhật ký đăng video không?",
      )
    ) {
      try {
        await window.api.clearLogs();
        setLogs([]);
        toast.success("Đã xóa toàn bộ nhật ký.");
      } catch (err: any) {
        toast.error(`Lỗi xóa: ${err.message}`);
      }
    }
  };

  // Tính toán KPI tổng quan
  const totalCount = logs.length;
  const successCount = logs.filter((l) => l.status === "success").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;
  const successRate =
    totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;

  // Lọc theo từ khóa tìm kiếm và trạng thái
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterStatus !== "all" && log.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = (log.profile_name || log.profile_id || "")
          .toLowerCase()
          .includes(query);
        const matchVideo = (log.video_name || "").toLowerCase().includes(query);
        if (!matchName && !matchVideo) return false;
      }
      return true;
    });
  }, [logs, filterStatus, searchQuery]);

  // Gom nhóm theo Kênh cho chế độ "grouped"
  const groupedByChannel = useMemo(() => {
    const map = new Map<
      string,
      {
        channelName: string;
        groupName?: string;
        channelId: string;
        videos: any[];
        successCount: number;
        failedCount: number;
        lastRunTime: string;
      }
    >();

    for (const item of filteredLogs) {
      const channelKey = item.profile_name || item.profile_id || "Khác";
      const existing = map.get(channelKey);

      if (!existing) {
        map.set(channelKey, {
          channelName: channelKey,
          groupName: item.group_name || "Mặc định",
          channelId: item.profile_id,
          videos: [item],
          successCount: item.status === "success" ? 1 : 0,
          failedCount: item.status === "failed" ? 1 : 0,
          lastRunTime: item.created_at,
        });
      } else {
        existing.videos.push(item);
        if (item.status === "success") existing.successCount++;
        if (item.status === "failed") existing.failedCount++;
      }
    }

    return Array.from(map.values());
  }, [filteredLogs]);

  const toggleChannelExpand = (channelName: string) => {
    setExpandedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channelName)) next.delete(channelName);
      else next.add(channelName);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedChannels(new Set(groupedByChannel.map((c) => c.channelName)));
  };

  const collapseAll = () => {
    setExpandedChannels(new Set());
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Film className="h-5 w-5 text-sky-500" /> Nhật Ký & Lịch Sử Upload
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Theo dõi toàn bộ video đã đăng, video ID, liên kết xem bài trên
            TikTok và thông báo lỗi.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw
              className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Làm Mới
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearLogs}
            disabled={logs.length === 0}
            className="text-xs"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Xóa Nhật Ký
          </Button>
        </div>
      </div>

      {/* 2. 3 THẺ KPI TỔNG QUAN */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="p-4.5 flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-sky-600">
            <Film className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500">
              Tổng Video Đã Đăng
            </span>
            <div className="mt-0.5 text-xl font-black text-slate-800">
              {totalCount}{" "}
              <span className="text-xs font-normal text-slate-400">video</span>
            </div>
          </div>
        </div>

        <div className="p-4.5 flex items-center gap-4 rounded-2xl border border-emerald-200/90 bg-white shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-emerald-700">
              Tỉ Lệ Thành Công
            </span>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-xl font-black text-emerald-700">
                {successRate}%
              </span>
              <span className="text-xs font-medium text-slate-400">
                ({successCount} thành công)
              </span>
            </div>
          </div>
        </div>

        <div className="p-4.5 flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
              failedCount > 0
                ? "border-rose-100 bg-rose-50 text-rose-600"
                : "border-slate-100 bg-slate-50 text-slate-400"
            }`}
          >
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <span
              className={`text-xs font-semibold ${
                failedCount > 0 ? "text-rose-700" : "text-slate-500"
              }`}
            >
              Video Thất Bại
            </span>
            <div
              className={`mt-0.5 text-xl font-black ${
                failedCount > 0 ? "text-rose-700" : "text-slate-800"
              }`}
            >
              {failedCount}{" "}
              <span className="text-xs font-normal text-slate-400">video</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. THANH TÌM KIẾM, BỘ LỌC VÀ CHUYỂN CHẾ ĐỘ XEM */}
      <div className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên kênh hoặc tên file video..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none"
          />
        </div>

        {/* Lọc Trạng thái */}
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="mr-1 flex items-center gap-1 text-xs text-slate-400">
            <Filter className="h-3 w-3" /> Lọc:
          </span>
          <button
            onClick={() => setFilterStatus("all")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filterStatus === "all"
                ? "shadow-xs bg-sky-500 font-semibold text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Tất cả ({logs.length})
          </button>
          <button
            onClick={() => setFilterStatus("success")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filterStatus === "success"
                ? "shadow-xs bg-emerald-600 font-semibold text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Thành công ({successCount})
          </button>
          <button
            onClick={() => setFilterStatus("failed")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              filterStatus === "failed"
                ? "shadow-xs bg-rose-600 font-semibold text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Lỗi ({failedCount})
          </button>
        </div>

        {/* Toggle Chế độ xem: Gom theo Kênh vs Bảng phẳng */}
        <div className="flex shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setViewMode("grouped")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              viewMode === "grouped"
                ? "shadow-xs bg-white font-bold text-sky-700"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Gom Theo Kênh
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
              viewMode === "table"
                ? "shadow-xs bg-white font-bold text-sky-700"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <List className="h-3.5 w-3.5" /> Bảng Danh Sách
          </button>
        </div>
      </div>

      {/* 4. HIỂN THỊ DANH SÁCH: CHẾ ĐỘ GOM THEO KÊNH HOẶC BẢNG PHẲNG */}
      {filteredLogs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
          Chưa có lịch sử đăng video nào phù hợp với bộ lọc hiện tại.
        </div>
      ) : viewMode === "grouped" ? (
        /* CHẾ ĐỘ 1: GOM THEO KÊNH (ACCORDION THÔNG MINH) */
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Tìm thấy {groupedByChannel.length} kênh có lịch sử upload:
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="cursor-pointer text-sky-600 hover:underline"
              >
                Mở rộng tất cả
              </button>
              <span>•</span>
              <button
                onClick={collapseAll}
                className="cursor-pointer text-slate-500 hover:underline"
              >
                Thu gọn tất cả
              </button>
            </div>
          </div>

          {groupedByChannel.map((channel) => {
            const isExpanded = expandedChannels.has(channel.channelName);
            const channelRate = Math.round(
              (channel.successCount / channel.videos.length) * 100,
            );

            return (
              <div
                key={channel.channelName}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-all"
              >
                {/* Header Kênh */}
                <div
                  onClick={() => toggleChannelExpand(channel.channelName)}
                  className="flex cursor-pointer select-none items-center justify-between p-4 transition-colors hover:bg-slate-50/70"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-xs font-bold text-sky-600">
                      {channel.channelName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-800">
                          {channel.channelName}
                        </h4>
                        {channel.groupName && (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            <Users className="h-2.5 w-2.5" />
                            {channel.groupName}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Đăng gần nhất: {formatDateTime(channel.lastRunTime)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-700">
                        {channel.videos.length} video
                      </span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                        {channel.successCount} thành công
                      </span>
                      {channel.failedCount > 0 && (
                        <span className="rounded bg-rose-50 px-2 py-0.5 font-bold text-rose-700">
                          {channel.failedCount} lỗi
                        </span>
                      )}
                    </div>

                    <div className="text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Danh sách video của Kênh khi mở rộng */}
                {isExpanded && (
                  <div className="space-y-2 border-t border-slate-100 bg-slate-50/40 p-3">
                    {channel.videos.map((vid) => (
                      <div
                        key={vid.id}
                        className="shadow-xs flex flex-col justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-3 text-xs sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-slate-800">
                              {vid.video_name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              • {formatTime(vid.created_at)}
                            </span>
                          </div>

                          {vid.error_message && (
                            <p className="mt-1 flex items-start gap-1 text-[11px] text-rose-600">
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{vid.error_message}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {vid.status === "success" ? (
                            <>
                              <Badge variant="success" className="text-[10px]">
                                Thành công
                              </Badge>
                              {vid.video_url ? (
                                <a
                                  href={vid.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-600 transition-colors hover:bg-sky-100"
                                  title="Xem trực tiếp trên TikTok"
                                >
                                  <ExternalLink className="h-3 w-3" /> Xem Video
                                </a>
                              ) : (
                                vid.video_id && (
                                  <span className="font-mono text-[11px] text-slate-400">
                                    ID: {vid.video_id}
                                  </span>
                                )
                              )}
                            </>
                          ) : (
                            <Badge variant="error" className="text-[10px]">
                              Thất bại
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* CHẾ ĐỘ 2: BẢNG PHẲNG TRUYỀN THỐNG (TABLE VIEW) */
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Kênh (Profile)</th>
                  <th className="px-4 py-3">Tên Video</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Link TikTok / Video ID</th>
                  <th className="px-4 py-3">Chi tiết / Lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="transition-colors hover:bg-slate-50/60"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-400">
                      {formatDateTime(log.created_at)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span>{log.profile_name || log.profile_id}</span>
                        {log.group_name && (
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] text-slate-500">
                            {log.group_name}
                          </span>
                        )}
                      </div>
                    </td>

                    <td
                      className="max-w-[200px] truncate px-4 py-3 font-mono text-[11px] text-slate-700"
                      title={log.video_name}
                    >
                      {log.video_name}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {log.status === "success" ? (
                        <Badge variant="success" className="text-[10px]">
                          Thành công
                        </Badge>
                      ) : (
                        <Badge variant="error" className="text-[10px]">
                          Lỗi
                        </Badge>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {log.video_url ? (
                        <a
                          href={log.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-sky-600 hover:text-sky-800 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Xem Video
                        </a>
                      ) : log.video_id ? (
                        <span className="font-mono text-[11px] text-slate-500">
                          {log.video_id}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td
                      className="max-w-[250px] truncate px-4 py-3 text-[11px] text-slate-500"
                      title={log.error_message || ""}
                    >
                      {log.error_message ? (
                        <span className="text-rose-600">
                          {log.error_message}
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-600">
                          Đã đăng thành công
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
