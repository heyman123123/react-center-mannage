import React, { useState } from "react";
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

interface PaymentWebhooksViewProps {
  logs: PaymentWebhookLog[];
}

export const PaymentWebhooksView: React.FC<PaymentWebhooksViewProps> = ({ logs }) => {
  const [webhookLogs, setWebhookLogs] = useState<PaymentWebhookLog[]>(logs);
  const [selectedLog, setSelectedLog] = useState<PaymentWebhookLog | null>(null);
  const [redeliveringId, setRedeliveringId] = useState<string | null>(null);
  const [redeliverToast, setRedeliverToast] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const handleRedeliver = (log: PaymentWebhookLog) => {
    setRedeliveringId(log.id);
    setRedeliverToast(null);

    setTimeout(() => {
      setRedeliveringId(null);
      const updated = {
        ...log,
        attempts: log.attempts + 1,
        httpStatus: 200,
        status: "DELIVERED" as const,
        latencyMs: 135,
        responseBody: '{"received": true, "replayed_at": "' + new Date().toISOString() + '"}',
      };
      setWebhookLogs((prev) => prev.map((item) => (item.id === log.id ? updated : item)));
      setRedeliverToast(`Webhook ${log.eventId} 已成功重新投递至下游，收到 200 OK 确认响应！`);
      setTimeout(() => setRedeliverToast(null), 4000);
    }, 1000);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
              <Webhook className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              支付 Webhook 调度与监听中心
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            监听海外网关（Stripe、PayPal、Adyen）的实时扣款与退款回调，并安全向集团下游 SaaS 应用推送事件签名通知，支持自动重试与单号重放。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-sky-50 text-sky-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-sky-200">
            <Radio className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
            <span>全事件双工自动全量接收 (全渠道独立监听)</span>
          </div>
        </div>
      </div>

      {/* Dedicated Channels Endpoints Banner */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-zinc-800">
            <Cpu className="w-4 h-4 text-sky-600" />
            <span>海外渠道专用 Webhook 监听端点列表 (各渠道独立协议，全量自动接收)：</span>
          </div>
          <span className="text-[11px] text-zinc-400">无需配置过滤，中台全自动校验网关签名并入库</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
          {[
            {
              channel: "Stripe",
              endpoint: "https://api.novaspay.global/v1/webhooks/stripe",
              auth: "Stripe-Signature (HMAC-SHA256)",
              status: "全事件监听中",
              color: "border-violet-200 bg-violet-50/40 text-violet-800",
            },
            {
              channel: "PayPal",
              endpoint: "https://api.novaspay.global/v1/webhooks/paypal",
              auth: "PayPal-Transmission-Sig (RSA-SHA256)",
              status: "全事件监听中",
              color: "border-blue-200 bg-blue-50/40 text-blue-800",
            },
            {
              channel: "Adyen",
              endpoint: "https://api.novaspay.global/v1/webhooks/adyen",
              auth: "HMAC-SHA256 Notification Validation",
              status: "全事件监听中",
              color: "border-emerald-200 bg-emerald-50/40 text-emerald-800",
            },
          ].map((ep) => (
            <div key={ep.channel} className={`p-2.5 rounded-lg border ${ep.color}`}>
              <div className="flex items-center justify-between font-bold">
                <span>{ep.channel} 专用接收端点</span>
                <span className="text-[10px] bg-white/80 px-1.5 py-0.5 rounded font-mono">
                  {ep.status}
                </span>
              </div>
              <div className="font-mono text-[10px] text-zinc-600 truncate mt-1 select-all">
                {ep.endpoint}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">签名验证: {ep.auth}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Redeliver Toast */}
      {redeliverToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between animate-in fade-in">
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
      <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-zinc-400 text-xs">事件筛选:</span>
          {["ALL", "SUCCESS", "FAILED", "subscription", "dispute"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                filterType === tab
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {tab === "ALL"
                ? "全部事件"
                : tab === "SUCCESS"
                ? "投递成功 (200)"
                : tab === "FAILED"
                ? "异常与重试"
                : tab === "subscription"
                ? "订阅生命周期"
                : "拒付与退款"}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            placeholder="搜索事件ID / 应用 / 目标URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Webhook Logs Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/90 border-b border-zinc-200 text-zinc-500 font-semibold text-[11px]">
                <th className="py-3 px-4 w-[220px]">事件 ID & 来源渠道</th>
                <th className="py-3 px-4 w-[180px]">事件类型 (Event Type)</th>
                <th className="py-3 px-4 min-w-[220px]">下游目标应用 & 回调地址</th>
                <th className="py-3 px-4 w-[120px]">HTTP 状态</th>
                <th className="py-3 px-4 w-[120px]">耗时 / 重试</th>
                <th className="py-3 px-4 w-[160px]">触发时间</th>
                <th className="py-3 px-4 w-[160px] sticky right-0 z-20 bg-zinc-50/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredLogs.map((log) => {
                const isRedelivering = redeliveringId === log.id;
                return (
                  <tr key={log.id} className="hover:bg-zinc-50/80 transition-colors group">
                    <td className="py-3.5 px-4 w-[220px]">
                      <div className="font-mono font-medium text-zinc-900 truncate max-w-[190px]" title={log.eventId}>{log.eventId}</div>
                      <div className="text-[11px] text-zinc-400 uppercase font-mono mt-0.5">
                        {log.channel}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 w-[180px] whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                        {log.eventType}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 min-w-[220px]">
                      <div className="font-semibold text-zinc-900 line-clamp-1">{log.appName}</div>
                      <div className="font-mono text-[11px] text-zinc-500 truncate mt-0.5 max-w-sm" title={log.targetUrl}>
                        {log.targetUrl}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 w-[120px] whitespace-nowrap">
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

                    <td className="py-3.5 px-4 w-[120px] whitespace-nowrap font-mono text-[11px] text-zinc-600">
                      <div>{log.latencyMs}ms</div>
                      <div className="text-zinc-400 text-[10px]">重试: {log.attempts} 次</div>
                    </td>

                    <td className="py-3.5 px-4 w-[160px] font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    {/* Actions: Sticky Right */}
                    <td className="py-3.5 px-4 w-[160px] sticky right-0 z-10 bg-white group-hover:bg-zinc-50/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded font-medium text-[11px] flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>报文</span>
                        </button>
                        <button
                          onClick={() => handleRedeliver(log)}
                          disabled={isRedelivering}
                          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded font-medium text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${isRedelivering ? "animate-spin" : ""}`}
                          />
                          <span>{isRedelivering ? "重推中..." : "重新投递"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Payload SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-webhook-payload"
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? `Webhook 原始报文 - ${selectedLog.eventId}` : "Webhook 原始报文"}
        description={selectedLog ? `${selectedLog.eventType} · ${selectedLog.deliveryStatus}` : ""}
        icon={<Webhook className="w-5 h-5 text-zinc-800" />}
        widthClass="max-w-2xl"
        footer={
          <button
            type="button"
            onClick={() => setSelectedLog(null)}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            关闭
          </button>
        }
      >
        {selectedLog && (
          <div className="space-y-3 text-xs">
            <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 space-y-1">
              <div className="text-zinc-400 text-[11px]">推送目标与签名标头:</div>
              <div className="font-mono text-zinc-800 break-all">{selectedLog.targetUrl}</div>
              <div className="font-mono text-[11px] text-zinc-500 pt-1">
                X-Novas-Signature: t=1789000000,v1=9812039810293810293810293810
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-zinc-700">Request Payload (JSON):</span>
                <button
                  onClick={() =>
                    copyToClipboard(JSON.stringify(selectedLog.payload, null, 2), "payload")
                  }
                  className="text-zinc-400 hover:text-zinc-700 flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === "payload" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>复制 JSON</span>
                </button>
              </div>
              <pre className="p-3 bg-zinc-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto">
                {JSON.stringify(selectedLog.payload, null, 2)}
              </pre>
            </div>

            {selectedLog.responseBody && (
              <div>
                <span className="font-semibold text-zinc-700 block mb-1">
                  下游客户端 HTTP 响应 (Response Body):
                </span>
                <pre className="p-3 bg-zinc-100 text-zinc-800 rounded-xl font-mono text-[11px] overflow-x-auto border border-zinc-200">
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
