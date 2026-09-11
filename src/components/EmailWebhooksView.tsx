import React, { useState } from "react";
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
} from "lucide-react";
import { EmailWebhookLog } from "../types/payment";

interface EmailWebhooksViewProps {
  logs: EmailWebhookLog[];
}

export const EmailWebhooksView: React.FC<EmailWebhooksViewProps> = ({ logs }) => {
  const [emailLogs] = useState<EmailWebhookLog[]>(logs);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<EmailWebhookLog | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <MailCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              邮件 Webhook 事件监听中心
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            实时汇总 SendGrid、AWS SES 与 Resend 的回执事件流（已投递、用户已打开、点击链接、硬退信与退订），保障出海邮件信誉与反垃圾合规。
          </p>
        </div>

        {/* Global Delivery Stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[11px] text-zinc-400 block">综合投递送达率</span>
            <span className="text-sm font-bold font-mono text-emerald-600">99.82%</span>
          </div>
          <div className="h-8 w-px bg-zinc-200" />
          <div className="text-right">
            <span className="text-[11px] text-zinc-400 block">账单邮件打开率</span>
            <span className="text-sm font-bold font-mono text-purple-600">64.50%</span>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-400 text-xs">状态事件:</span>
          {["ALL", "DELIVERED", "OPENED", "BOUNCED"].map((tab) => (
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
                ? "全部回执"
                : tab === "DELIVERED"
                ? "成功送达 (Delivered)"
                : tab === "OPENED"
                ? "客户已读 (Opened)"
                : "退信拦截 (Bounced)"}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            placeholder="搜索收件邮箱 / 邮件主题..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Email Webhook Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/90 border-b border-zinc-200 text-zinc-500 font-semibold text-[11px]">
                <th className="py-3 px-4 w-[220px]">消息 ID & 服务商</th>
                <th className="py-3 px-4 w-[180px]">事件类型</th>
                <th className="py-3 px-4 w-[200px]">目标收件人</th>
                <th className="py-3 px-4 min-w-[220px]">邮件主题与模版</th>
                <th className="py-3 px-4 w-[160px]">发生时间</th>
                <th className="py-3 px-4 w-[120px] sticky right-0 z-20 bg-zinc-50/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((log) => {
                return (
                  <tr key={log.id} className="hover:bg-zinc-50/80 transition-colors group">
                    <td className="py-3.5 px-4 w-[220px]">
                      <div className="font-mono text-zinc-900 truncate max-w-[190px]" title={log.messageId}>{log.messageId}</div>
                      <div className="text-[11px] text-zinc-400 uppercase font-mono mt-0.5">
                        {log.provider}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 w-[180px] whitespace-nowrap">
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

                    <td className="py-3.5 px-4 w-[200px] font-medium text-zinc-900 font-mono truncate" title={log.recipient}>
                      {log.recipient}
                    </td>

                    <td className="py-3.5 px-4 min-w-[220px]">
                      <div className="text-zinc-900 truncate font-medium line-clamp-1">{log.subject}</div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        模版: {log.templateCode}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 w-[160px] font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    {/* Actions: Sticky Right */}
                    <td className="py-3.5 px-4 w-[120px] sticky right-0 z-10 bg-white group-hover:bg-zinc-50/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded font-medium text-[11px] transition-colors"
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
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-bold text-zinc-900 text-sm">邮件投递回执详情</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-zinc-400 hover:text-zinc-700 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1.5 font-mono">
                <div>
                  <span className="text-zinc-400 text-[11px]">Message ID:</span>
                  <div className="text-zinc-900">{selectedLog.messageId}</div>
                </div>
                <div>
                  <span className="text-zinc-400 text-[11px]">Recipient:</span>
                  <div className="text-zinc-900">{selectedLog.recipient}</div>
                </div>
                {selectedLog.ip && (
                  <div>
                    <span className="text-zinc-400 text-[11px]">Client IP:</span>
                    <div className="text-zinc-900">{selectedLog.ip}</div>
                  </div>
                )}
                {selectedLog.userAgent && (
                  <div>
                    <span className="text-zinc-400 text-[11px]">User Agent:</span>
                    <div className="text-zinc-600 text-[11px] break-all">
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

            <div className="pt-3 border-t border-zinc-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
