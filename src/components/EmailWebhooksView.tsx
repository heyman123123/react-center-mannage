import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as messagingApi from "../api/modules/messaging";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import {
  MailCheck,
  CheckCircle2,
  AlertTriangle,
  Eye,
  MousePointer,
  UserX,
  Search,
  Filter,
  ArrowDownLeft,
  Server,
  Info,
  Download,
} from "lucide-react";
import { EmailWebhookLog } from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { exportToCSV } from "../lib/utils";

export const EmailWebhooksView: React.FC = () => {
  const { t } = useTranslation(["email", "common"]);
  const [emailLogs, setEmailLogs] = useState<EmailWebhookLog[]>([]);

  const loadLogs = useCallback(async () => {
    try {
      const res = await messagingApi.listEmailWebhooks({ page: 1, pageSize: 100 });
      setEmailLogs(res.list);
    } catch {
      setEmailLogs([]);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<EmailWebhookLog | null>(null);
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [filterType, searchQuery, reset]);

  const filtered = emailLogs.filter((log) => {
    const matchesFilter =
      filterType === "ALL" ||
      (filterType === "DELIVERED" && log.eventType === "email.delivered") ||
      (filterType === "OPENED" && log.eventType === "email.opened") ||
      (filterType === "BOUNCED" && log.eventType === "email.bounced");

    const matchesSearch =
      log.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.messageId.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const handleExport = () => {
    exportToCSV(
      t("webhooks.exportFilename"),
      ["消息ID", "事件类型", "服务商", "收件人", "主题", "模板代码", "时间", "状态"],
      filtered.map((l) => [
        l.messageId, l.eventType, l.provider, l.recipient, l.subject, l.templateCode, l.timestamp, l.status,
      ])
    );
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <MailCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">
              {t("webhooks.title")}
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            实时汇总 SendGrid、AWS SES 与 Resend 的回执事件流（已投递、用户已打开、点击链接、硬退信与退订），保障出海邮件信誉与反垃圾合规。
          </p>
        </div>

        {/* Global Delivery Stats */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-line hover:bg-hover text-fg-secondary rounded-lg text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            {t("webhooks.exportCsv")}
          </button>
          <div className="h-8 w-px bg-hover" />
          <div className="text-right">
            <span className="text-[11px] text-fg-tertiary block">{t("webhooks.stats.deliveryRate")}</span>
            <span className="text-sm font-bold font-mono text-emerald-600">99.82%</span>
          </div>
          <div className="h-8 w-px bg-hover" />
          <div className="text-right">
            <span className="text-[11px] text-fg-tertiary block">{t("webhooks.stats.openRate")}</span>
            <span className="text-sm font-bold font-mono text-purple-600">64.50%</span>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-fg-tertiary text-xs">{t("webhooks.filterLabel")}</span>
          {["ALL", "DELIVERED", "OPENED", "BOUNCED"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                filterType === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-hover text-fg-secondary hover:bg-hover"
              }`}
            >
              {tab === "ALL"
                ? t("webhooks.filters.all")
                : tab === "DELIVERED"
                ? t("webhooks.filters.delivered")
                : tab === "OPENED"
                ? t("webhooks.filters.opened")
                : t("webhooks.filters.bounced")}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
          <input
            type="text"
            placeholder={t("webhooks.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Email Webhook Table */}
      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3 w-[220px]">{t("webhooks.table.messageId")}</th>
                <th className="py-2 px-3 w-[180px]">{t("webhooks.table.eventType")}</th>
                <th className="py-2 px-3 w-[200px]">{t("webhooks.table.recipient")}</th>
                <th className="py-2 px-3 min-w-[220px]">{t("webhooks.table.subject")}</th>
                <th className="py-2 px-3 w-[160px]">{t("webhooks.table.time")}</th>
                <th className="py-2 px-3 w-[120px] sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  {t("webhooks.table.operations")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<EmailWebhookLog>(filtered, currentPage, pageSize).map((log) => {
                return (
                  <tr key={log.id} className="hover:bg-subtle/80 transition-colors group">
                    <td className="py-3.5 px-3 w-[220px]">
                      <div className="font-mono text-fg truncate max-w-[190px]" title={log.messageId}>{log.messageId}</div>
                      <div className="text-[11px] text-fg-tertiary uppercase font-mono mt-0.5">
                        {log.provider}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 w-[180px] whitespace-nowrap">
                      {log.eventType === "email.delivered" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          已送达 (Delivered)
                        </span>
                      )}
                      {log.eventType === "email.opened" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          <Eye className="w-3 h-3" />
                          用户已阅读 (Opened)
                        </span>
                      )}
                      {log.eventType === "email.bounced" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3" />
                          硬退信 (Bounced)
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 w-[200px] font-medium text-fg font-mono truncate" title={log.recipient}>
                      {log.recipient}
                    </td>

                    <td className="py-3.5 px-3 min-w-[220px]">
                      <div className="text-fg truncate font-medium line-clamp-1">{log.subject}</div>
                      <div className="text-[11px] text-fg-tertiary font-mono mt-0.5">
                        模版: {log.templateCode}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 w-[160px] font-mono text-[11px] text-fg-secondary whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    {/* Actions: Sticky Right */}
                    <td className="py-3.5 px-3 w-[120px] sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 bg-hover hover:bg-hover text-fg-secondary rounded font-medium text-[11px] transition-colors"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} />
      </div>

      {/* Details SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-email-webhook-detail"
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="邮件投递回执详情"
        description={selectedLog ? `事件: ${selectedLog.eventType} · ${selectedLog.timestamp}` : ""}
        icon={<MailCheck className="w-5 h-5 text-fg" />}
        widthClass="max-w-md"
        footer={
          <button
            type="button"
            onClick={() => setSelectedLog(null)}
            className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer"
          >
            {t("common:actions.close")}
          </button>
        }
      >
        {selectedLog && (
          <div className="space-y-2.5 text-xs">
            <div className="p-3 bg-subtle rounded-xl border border-line space-y-1.5 font-mono">
              <div>
                <span className="text-fg-tertiary text-[11px]">Message ID:</span>
                <div className="text-fg">{selectedLog.messageId}</div>
              </div>
              <div>
                <span className="text-fg-tertiary text-[11px]">Recipient:</span>
                <div className="text-fg">{selectedLog.recipient}</div>
              </div>
              {selectedLog.ip && (
                <div>
                  <span className="text-fg-tertiary text-[11px]">Client IP:</span>
                  <div className="text-fg">{selectedLog.ip}</div>
                </div>
              )}
              {selectedLog.userAgent && (
                <div>
                  <span className="text-fg-tertiary text-[11px]">User Agent:</span>
                  <div className="text-fg-secondary text-[11px] break-all">
                    {selectedLog.userAgent}
                  </div>
                </div>
              )}
            </div>

            {selectedLog.details && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
                <span className="font-bold block text-[11px] mb-0.5">网关回执反馈说明:</span>
                <p>{selectedLog.details}</p>
              </div>
            )}
          </div>
        )}
      </SideSheet>
    </div>
  );
};
