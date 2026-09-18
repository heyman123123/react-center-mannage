import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as paymentWebhooksApi from "../api/modules/paymentWebhooks";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import {
  Webhook,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  Copy,
  Check,
  Search,
  Filter,
  ArrowUpRight,
  Clock,
  Shield,
  Radio,
  Cpu,
  ExternalLink,
} from "lucide-react";
import { PaymentWebhookLog } from "../types/payment";
import { SideSheet } from "./ui/SideSheet";

export const PaymentWebhooksView: React.FC = () => {
  const { t } = useTranslation(["payments", "common"]);
  const [webhookLogs, setWebhookLogs] = useState<PaymentWebhookLog[]>([]);

  const loadLogs = useCallback(async () => {
    try {
      const res = await paymentWebhooksApi.listPaymentWebhooks({ page: 1, pageSize: 100 });
      setWebhookLogs(res.list);
    } catch {
      setWebhookLogs([]);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);
  const [selectedLog, setSelectedLog] = useState<PaymentWebhookLog | null>(null);
  const [redeliveringId, setRedeliveringId] = useState<string | null>(null);
  const [redeliverToast, setRedeliverToast] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [filterType, searchQuery, reset]);

  const filteredLogs = webhookLogs.filter((log) => {
    const matchesFilter =
      filterType === "ALL" ||
      (filterType === "SUCCESS" && log.httpStatus === 200) ||
      (filterType === "FAILED" && log.httpStatus !== 200) ||
      log.eventType.includes(filterType.toLowerCase());

    const matchesSearch =
      log.eventId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.targetUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.eventType.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const handleRedeliver = async (log: PaymentWebhookLog) => {
    setRedeliveringId(log.id);
    setRedeliverToast(null);
    try {
      await paymentWebhooksApi.redeliverPaymentWebhook(log.id);
      await loadLogs();
      setRedeliverToast(t("payments:webhooks.toastRedeliver", { eventId: log.eventId }));
    } catch {
      setRedeliverToast(t("payments:webhooks.toastRedeliverFailed", { eventId: log.eventId }));
    } finally {
      setRedeliveringId(null);
      setTimeout(() => setRedeliverToast(null), 4000);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
              <Webhook className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">
              {t("payments:webhooks.title")}
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            {t("payments:webhooks.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-sky-50 text-sky-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-sky-200">
            <Radio className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
            <span>{t("payments:webhooks.badge")}</span>
          </div>
        </div>
      </div>

      {/* Dedicated Channels Endpoints Banner */}
      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card">
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-fg">
            <Cpu className="w-4 h-4 text-sky-600" />
            <span>{t("payments:webhooks.endpointsTitle")}</span>
          </div>
          <span className="text-[11px] text-fg-tertiary">{t("payments:webhooks.endpointsHint")}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
          {[
            {
              channel: "Stripe",
              endpoint: "https://api.novaspay.global/v1/webhooks/stripe",
              auth: "Stripe-Signature (HMAC-SHA256)",
              color: "border-violet-200 bg-violet-50/40 text-violet-800",
            },
            {
              channel: "PayPal",
              endpoint: "https://api.novaspay.global/v1/webhooks/paypal",
              auth: "PayPal-Transmission-Sig (RSA-SHA256)",
              color: "border-blue-200 bg-blue-50/40 text-blue-800",
            },
            {
              channel: "Adyen",
              endpoint: "https://api.novaspay.global/v1/webhooks/adyen",
              auth: "HMAC-SHA256 Notification Validation",
              color: "border-emerald-200 bg-emerald-50/40 text-emerald-800",
            },
          ].map((ep) => (
            <div key={ep.channel} className={`p-2.5 rounded-lg border ${ep.color}`}>
              <div className="flex items-center justify-between font-bold">
                <span>{t("payments:webhooks.endpointLabel", { channel: ep.channel })}</span>
                <span className="text-[10px] bg-surface/80 px-1.5 py-0.5 rounded font-mono">
                  {t("payments:webhooks.listening")}
                </span>
              </div>
              <div className="font-mono text-[10px] text-fg-secondary truncate mt-1 select-all">
                {ep.endpoint}
              </div>
              <div className="text-[10px] text-fg-tertiary mt-0.5">{t("payments:webhooks.signatureVerify", { auth: ep.auth })}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Redeliver Toast */}
      {redeliverToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{redeliverToast}</span>
          </div>
          <button onClick={() => setRedeliverToast(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-fg-tertiary text-xs">{t("payments:webhooks.filterLabel")}</span>
          {["ALL", "SUCCESS", "FAILED", "subscription", "dispute"].map((tab) => (
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
                ? t("payments:webhooks.filters.all")
                : tab === "SUCCESS"
                ? t("payments:webhooks.filters.success")
                : tab === "FAILED"
                ? t("payments:webhooks.filters.failed")
                : tab === "subscription"
                ? t("payments:webhooks.filters.subscription")
                : t("payments:webhooks.filters.dispute")}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
          <input
            type="text"
            placeholder={t("payments:webhooks.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Webhook Logs Table */}
      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3 w-[220px]">{t("payments:webhooks.table.eventId")}</th>
                <th className="py-2 px-3 w-[180px]">{t("payments:webhooks.table.eventType")}</th>
                <th className="py-2 px-3 min-w-[220px]">{t("payments:webhooks.table.target")}</th>
                <th className="py-2 px-3 w-[120px]">{t("payments:webhooks.table.httpStatus")}</th>
                <th className="py-2 px-3 w-[120px]">{t("payments:webhooks.table.latency")}</th>
                <th className="py-2 px-3 w-[160px]">{t("payments:webhooks.table.time")}</th>
                <th className="py-2 px-3 w-[160px] sticky right-0 z-20 bg-subtle/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  {t("payments:webhooks.table.operations")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<PaymentWebhookLog>(filteredLogs, currentPage, pageSize).map((log) => {
                const isRedelivering = redeliveringId === log.id;
                return (
                  <tr key={log.id} className="hover:bg-subtle/80 transition-colors group">
                    <td className="py-3.5 px-3 w-[220px]">
                      <div className="font-mono font-medium text-fg truncate max-w-[190px]" title={log.eventId}>{log.eventId}</div>
                      <div className="text-[11px] text-fg-tertiary uppercase font-mono mt-0.5">
                        {log.channel}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 w-[180px] whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                        {log.eventType}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 min-w-[220px]">
                      <div className="font-semibold text-fg line-clamp-1">{log.appName}</div>
                      <div className="font-mono text-[11px] text-fg-secondary truncate mt-0.5 max-w-sm" title={log.targetUrl}>
                        {log.targetUrl}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 w-[120px] whitespace-nowrap">
                      {log.httpStatus === 200 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          200 OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3" />
                          {log.httpStatus} Error
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 w-[120px] whitespace-nowrap font-mono text-[11px] text-fg-secondary">
                      <div>{log.latencyMs}ms</div>
                      <div className="text-fg-tertiary text-[10px]">{t("payments:webhooks.retryCount", { count: log.attempts })}</div>
                    </td>

                    <td className="py-3.5 px-3 w-[160px] font-mono text-[11px] text-fg-secondary whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    {/* Actions: Sticky Right */}
                    <td className="py-3.5 px-3 w-[160px] sticky right-0 z-10 bg-surface group-hover:bg-subtle/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2 py-1 bg-hover hover:bg-hover text-fg-secondary rounded font-medium text-[11px] flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{t("payments:webhooks.viewPayload")}</span>
                        </button>
                        <button
                          onClick={() => handleRedeliver(log)}
                          disabled={isRedelivering}
                          className="px-2 py-1 bg-primary hover:bg-primary-hover text-primary-foreground rounded font-medium text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${isRedelivering ? "animate-spin" : ""}`}
                          />
                          <span>{isRedelivering ? t("payments:webhooks.redelivering") : t("payments:webhooks.redeliver")}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={currentPage} totalItems={filteredLogs.length} pageSize={pageSize} onPageChange={setCurrentPage} />
      </div>

      {/* View Payload SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-webhook-payload"
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? t("payments:webhooks.sheetTitle", { eventId: selectedLog.eventId }) : t("payments:webhooks.sheetTitleFallback")}
        description={selectedLog ? `${selectedLog.eventType} · ${selectedLog.status}` : ""}
        icon={<Webhook className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl"
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
          <div className="space-y-3 text-xs">
            <div className="bg-subtle p-3 rounded-xl border border-line space-y-1">
              <div className="text-fg-tertiary text-[11px]">{t("payments:webhooks.targetHint")}</div>
              <div className="font-mono text-fg break-all">{selectedLog.targetUrl}</div>
              <div className="font-mono text-[11px] text-fg-secondary pt-1">
                X-Novas-Signature: t=1789000000,v1=9812039810293810293810293810
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-fg-secondary">{t("payments:webhooks.requestPayload")}</span>
                <button
                  onClick={() =>
                    copyToClipboard(JSON.stringify(selectedLog.payload, null, 2), "payload")
                  }
                  className="text-fg-tertiary hover:text-fg-secondary flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === "payload" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{t("payments:webhooks.copyJson")}</span>
                </button>
              </div>
              <pre className="p-3 bg-primary text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                {JSON.stringify(selectedLog.payload, null, 2)}
              </pre>
            </div>

            {selectedLog.responseBody && (
              <div>
                <span className="font-semibold text-fg-secondary block mb-1">
                  {t("payments:webhooks.responseBody")}
                </span>
                <pre className="p-3 bg-hover text-fg rounded-xl font-mono text-[11px] overflow-x-auto border border-line">
                  {selectedLog.responseBody}
                </pre>
              </div>
            )}
          </div>
        )}
      </SideSheet>
    </div>
  );
};
