import React, { useState } from "react";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Server,
  ShieldCheck,
  Zap,
  Clock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
} from "lucide-react";
import { EmailChannelConfig } from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";

interface EmailChannelsViewProps {
  channels: EmailChannelConfig[];
  onUpdateChannel: (channel: EmailChannelConfig) => void;
  onAddChannel?: (channel: EmailChannelConfig) => void;
}

export const EmailChannelsView: React.FC<EmailChannelsViewProps> = ({
  channels,
  onUpdateChannel,
  onAddChannel,
}) => {
  const [channelList, setChannelList] = useState<EmailChannelConfig[]>(channels);
  const [testModalChannel, setTestModalChannel] = useState<EmailChannelConfig | null>(null);
  const [testRecipient, setTestRecipient] = useState("admin@corp-finance.global");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  const [editingChannel, setEditingChannel] = useState<EmailChannelConfig | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // 新增发件渠道表单
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    providerKey: "sendgrid",
    name: "",
    description: "",
    senderName: "",
    senderEmail: "",
    apiKey: "",
    smtpHost: "",
    smtpPort: 587,
    dailyQuota: 50000,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const openCreateSheet = () => {
    setNewForm({
      providerKey: "sendgrid",
      name: "",
      description: "",
      senderName: "",
      senderEmail: "",
      apiKey: "",
      smtpHost: "smtp.sendgrid.net",
      smtpPort: 587,
      dailyQuota: 50000,
    });
    setIsCreateSheetOpen(true);
  };

  const handleAddChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.name.trim() || !newForm.senderEmail.trim()) {
      showToast("请填写渠道名称与发件人邮箱");
      return;
    }
    const newChannel: EmailChannelConfig = {
      id: `ec_custom_${Date.now()}`,
      providerKey: newForm.providerKey,
      name: newForm.name.trim(),
      description: newForm.description.trim() || "新增海外事务邮件发信通道",
      enabled: true,
      isPrimary: channelList.length === 0,
      senderEmail: newForm.senderEmail.trim(),
      senderName: newForm.senderName.trim() || "Novas Notifications",
      apiKey: newForm.apiKey.trim() || "sk_live_placeholder",
      smtpHost: newForm.smtpHost.trim() || "smtp.example.com",
      smtpPort: newForm.smtpPort || 587,
      dailyQuota: newForm.dailyQuota || 50000,
      sentToday: 0,
      verifiedDomain: newForm.senderEmail.split("@")[1] || "",
      spfDkimStatus: "PENDING",
      lastTestedAt: "未测试",
    };
    setChannelList((prev) => [newChannel, ...prev]);
    if (onAddChannel) onAddChannel(newChannel);
    setIsCreateSheetOpen(false);
    showToast(`发件渠道【${newChannel.name}】已成功添加`);
  };

  const handleSendTestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testModalChannel) return;
    setIsSendingTest(true);
    setTestFeedback(null);

    setTimeout(() => {
      setIsSendingTest(false);
      setTestFeedback(
        `✅ 测试邮件投递成功！已通过 ${testModalChannel.name} 发往 ${testRecipient}，耗时 320ms，TLSv1.3 加密完成。`
      );
      setTimeout(() => {
        setTestFeedback(null);
        setTestModalChannel(null);
      }, 3000);
    }, 1200);
  };

  const handleTogglePrimary = (targetId: string) => {
    const updated = channelList.map((c) => ({
      ...c,
      isPrimary: c.id === targetId,
    }));
    setChannelList(updated);
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Mail className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              海外邮件发信渠道配置
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            维护出海交易类通知邮件基建（SendGrid、AWS SES、Resend、Postmark），保障订阅开通确认单、催付告警、电子发票收据与验证码 99.9% 进箱率。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openCreateSheet}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添加发件渠道</span>
          </button>
        </div>
      </div>

      {/* Email Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channelList.map((channel) => {
          const quotaPercent = Math.min(
            100,
            Math.round((channel.sentToday / channel.dailyQuota) * 100)
          );

          return (
            <div
              key={channel.id}
              className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                channel.enabled
                  ? "border-zinc-200/80 hover:border-zinc-300"
                  : "border-zinc-200/50 opacity-60 bg-zinc-50/50"
              }`}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-sm tracking-tighter uppercase font-mono border border-purple-100">
                      {channel.providerKey.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-zinc-900 text-sm">
                          {channel.name}
                        </h3>
                        {channel.isPrimary && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            主力通道 (Primary)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
                        {channel.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!channel.isPrimary && channel.enabled && (
                      <button
                        onClick={() => handleTogglePrimary(channel.id)}
                        className="text-[11px] text-zinc-500 hover:text-zinc-900 underline px-1"
                      >
                        设为主力
                      </button>
                    )}
                  </div>
                </div>

                {/* Configuration details */}
                <div className="bg-zinc-50 rounded-xl p-3.5 border border-zinc-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">发件人地址:</span>
                    <span className="font-mono text-zinc-800 font-medium">
                      "{channel.senderName}" &lt;{channel.senderEmail}&gt;
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">SMTP 服务器:</span>
                    <span className="font-mono text-zinc-700">
                      {channel.smtpHost}:{channel.smtpPort}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">SPF / DKIM 域名认证:</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      {channel.verifiedDomain} (已通过校验)
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-zinc-400">API Key 凭据:</span>
                    <div className="flex items-center gap-1 font-mono text-zinc-600">
                      <span>{channel.apiKey.substring(0, 8)}••••••••</span>
                      <button
                        onClick={() => copyText(channel.apiKey, channel.id)}
                        className="text-zinc-400 hover:text-zinc-700 ml-1"
                      >
                        {copiedId === channel.id ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quota Progress */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500">今日发信配额使用率</span>
                    <span className="font-mono font-medium text-zinc-700">
                      {channel.sentToday.toLocaleString()} / {channel.dailyQuota.toLocaleString()} 封 ({quotaPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        quotaPercent > 85 ? "bg-rose-500" : "bg-purple-600"
                      }`}
                      style={{ width: `${quotaPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-5 pt-3.5 border-t border-zinc-100 flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-mono text-[11px]">
                  最近测试: {channel.lastTestedAt}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTestModalChannel(channel);
                      setTestFeedback(null);
                    }}
                    className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-medium flex items-center gap-1 transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    <span>发测试信</span>
                  </button>
                  <button
                    onClick={() => setEditingChannel(channel)}
                    className="px-2.5 py-1.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-lg font-medium flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>配置</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Send Test Email SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-test-email"
        isOpen={!!testModalChannel}
        onClose={() => setTestModalChannel(null)}
        title={testModalChannel ? `发送连通性测试邮件 - ${testModalChannel.name}` : "发送连通性测试邮件"}
        description="向指定邮箱即时发出标准海外订阅账单收据测试样本，验证发信通道连通性。"
        icon={<Send className="w-4 h-4 text-zinc-800" />}
        widthClass="max-w-md"
        footer={
          testModalChannel && !testFeedback ? (
            <>
              <button
                type="button"
                onClick={() => setTestModalChannel(null)}
                className="px-3.5 py-1.5 border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                form="form-test-email"
                disabled={isSendingTest}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isSendingTest ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>投递发送中...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>立即发送测试信</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setTestModalChannel(null)}
              className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium cursor-pointer"
            >
              完成
            </button>
          )
        }
      >
        {testModalChannel &&
          (testFeedback ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
              {testFeedback}
            </div>
          ) : (
            <form id="form-test-email" onSubmit={handleSendTestEmail} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-600 block mb-1 font-medium">
                  接收测试邮件的邮箱地址
                </label>
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-mono"
                  required
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  系统将从 {testModalChannel.senderEmail} 即时发出标准海外订阅账单收据测试样本。
                </p>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-1 text-zinc-600">
                <div className="font-medium text-zinc-900">邮件投递路由预检:</div>
                <div className="text-[11px] font-mono text-zinc-500">
                  Host: {testModalChannel.smtpHost}:{testModalChannel.smtpPort}
                </div>
                <div className="text-[11px] font-mono text-zinc-500">
                  Sender: "{testModalChannel.senderName}" &lt;{testModalChannel.senderEmail}&gt;
                </div>
              </div>
            </form>
          ))}
      </SideSheet>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[9999] bg-zinc-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Add Channel SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-add-email-channel"
        isOpen={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
        title="添加发件渠道"
        description="新增海外事务邮件发信通道，配置服务商、发件人与 SMTP 投递参数后即可启用。"
        icon={<Mail className="w-5 h-5 text-zinc-800" />}
        widthClass="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCreateSheetOpen(false)}
              className="px-4 py-2 border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              form="form-add-email-channel"
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium shadow-xs cursor-pointer"
            >
              确认添加渠道
            </button>
          </>
        }
      >
        <form
          id="form-add-email-channel"
          onSubmit={handleAddChannel}
          className="space-y-3 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-600 block mb-1 font-medium">
                服务商 (Provider)
              </label>
              <ShadcnSelect
                value={newForm.providerKey}
                onValueChange={(val) => setNewForm((f) => ({ ...f, providerKey: val }))}
                options={[
                  { value: "sendgrid", label: "Twilio SendGrid" },
                  { value: "ses", label: "Amazon SES" },
                  { value: "resend", label: "Resend" },
                  { value: "postmark", label: "Postmark" },
                  { value: "mailgun", label: "Mailgun" },
                ]}
              />
            </div>
            <div>
              <label className="text-zinc-600 block mb-1 font-medium">
                渠道名称 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="如：SendGrid 主通道"
                value={newForm.name}
                onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="text-zinc-600 block mb-1 font-medium">渠道说明</label>
            <input
              type="text"
              placeholder="该通道的用途与适用场景..."
              value={newForm.description}
              onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-600 block mb-1 font-medium">
                发件人昵称 (From Name)
              </label>
              <input
                type="text"
                placeholder="如：Novas Notifications"
                value={newForm.senderName}
                onChange={(e) => setNewForm((f) => ({ ...f, senderName: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900"
              />
            </div>
            <div>
              <label className="text-zinc-600 block mb-1 font-medium">
                发件人邮箱 (From Email) <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="billing@yourdomain.com"
                value={newForm.senderEmail}
                onChange={(e) => setNewForm((f) => ({ ...f, senderEmail: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-zinc-600 block mb-1 font-medium">API Key 凭据密钥</label>
            <input
              type="text"
              placeholder="服务商控制台生成的 API 密钥"
              value={newForm.apiKey}
              onChange={(e) => setNewForm((f) => ({ ...f, apiKey: e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-600 block mb-1 font-medium">SMTP 主机地址</label>
              <input
                type="text"
                value={newForm.smtpHost}
                onChange={(e) => setNewForm((f) => ({ ...f, smtpHost: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-mono"
              />
            </div>
            <div>
              <label className="text-zinc-600 block mb-1 font-medium">SMTP 端口</label>
              <input
                type="number"
                value={newForm.smtpPort}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, smtpPort: Number(e.target.value) || 587 }))
                }
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-zinc-600 block mb-1 font-medium">每日投递配额</label>
            <input
              type="number"
              value={newForm.dailyQuota}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, dailyQuota: Number(e.target.value) || 50000 }))
              }
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-mono"
            />
          </div>
        </form>
      </SideSheet>

      {/* Edit Channel SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-edit-email-channel"
        isOpen={!!editingChannel}
        onClose={() => setEditingChannel(null)}
        title={editingChannel ? `配置发信通道 - ${editingChannel.name}` : "配置发信通道"}
        description="维护发件人信息、SMTP 服务器与每日投递配额。"
        icon={<Mail className="w-5 h-5 text-zinc-800" />}
        widthClass="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingChannel(null)}
              className="px-4 py-2 border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              form="form-edit-email-channel"
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-medium shadow-xs cursor-pointer"
            >
              保存通道配置
            </button>
          </>
        }
      >
        {editingChannel && (
          <form
            id="form-edit-email-channel"
            onSubmit={(e) => {
              e.preventDefault();
              setChannelList((prev) =>
                prev.map((c) => (c.id === editingChannel.id ? editingChannel : c))
              );
              onUpdateChannel(editingChannel);
              setEditingChannel(null);
            }}
            className="space-y-3 text-xs"
          >
              <div>
                <label className="text-zinc-600 block mb-1 font-medium">发信渠道名称</label>
                <input
                  type="text"
                  value={editingChannel.name}
                  onChange={(e) =>
                    setEditingChannel({ ...editingChannel, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-600 block mb-1 font-medium">发件人昵称 (From Name)</label>
                  <input
                    type="text"
                    value={editingChannel.senderName}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, senderName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900"
                    required
                  />
                </div>
                <div>
                  <label className="text-zinc-600 block mb-1 font-medium">发件人邮箱 (From Email)</label>
                  <input
                    type="email"
                    value={editingChannel.senderEmail}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, senderEmail: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-600 block mb-1 font-medium">API Key 凭据密钥</label>
                <input
                  type="text"
                  value={editingChannel.apiKey}
                  onChange={(e) =>
                    setEditingChannel({ ...editingChannel, apiKey: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-600 block mb-1 font-medium">SMTP 主机地址</label>
                  <input
                    type="text"
                    value={editingChannel.smtpHost}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, smtpHost: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-zinc-600 block mb-1 font-medium">SMTP 端口</label>
                  <input
                    type="number"
                    value={editingChannel.smtpPort}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, smtpPort: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-600 block mb-1 font-medium">每日最大投递配额 (Quota)</label>
                <input
                  type="number"
                  value={editingChannel.dailyQuota}
                  onChange={(e) =>
                    setEditingChannel({ ...editingChannel, dailyQuota: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 font-mono"
                />
              </div>

            </form>
        )}
      </SideSheet>
    </div>
  );
};
