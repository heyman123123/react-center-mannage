import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
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
  const { t } = useTranslation(["channels", "common"]);
  const [channelList, setChannelList] = useState<EmailChannelConfig[]>(channels);
  const { currentPage, setCurrentPage, reset: _ecr, pageSize } = usePagination(10);
  const [testModalChannel, setTestModalChannel] = useState<EmailChannelConfig | null>(null);
  const [testRecipient, setTestRecipient] = useState("admin@corp-finance.global");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  const [editingChannel, setEditingChannel] = useState<EmailChannelConfig | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // 新增发件渠道表单
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [newForm, setNewForm] = useState<{
    providerKey: EmailChannelConfig["providerKey"];
    name: string;
    description: string;
    senderName: string;
    senderEmail: string;
    apiKey: string;
    smtpHost: string;
    smtpPort: number;
    dailyQuota: number;
  }>({
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
      showToast(t("email.toast.fillRequired"));
      return;
    }
    const newChannel: EmailChannelConfig = {
      id: `ec_custom_${Date.now()}`,
      providerKey: newForm.providerKey,
      name: newForm.name.trim(),
      description: newForm.description.trim() || t("email.defaults.description"),
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
      lastTestedAt: t("email.defaults.notTested"),
    };
    setChannelList((prev) => [newChannel, ...prev]);
    if (onAddChannel) onAddChannel(newChannel);
    setIsCreateSheetOpen(false);
    showToast(t("email.toast.added", { name: newChannel.name }));
  };

  const handleSendTestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testModalChannel) return;
    setIsSendingTest(true);
    setTestFeedback(null);

    setTimeout(() => {
      setIsSendingTest(false);
      setTestFeedback(
        t("email.testSheet.success", { channel: testModalChannel.name, recipient: testRecipient })
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

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Mail className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">
              {t("email.title")}
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            {t("email.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openCreateSheet}
            className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("email.addChannel")}</span>
          </button>
        </div>
      </div>

      {/* Email Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {paginate<EmailChannelConfig>(channelList, currentPage, pageSize).map((channel) => {
          const quotaPercent = Math.min(
            100,
            Math.round((channel.sentToday / channel.dailyQuota) * 100)
          );

          return (
            <div
              key={channel.id}
              className={`bg-surface border rounded-2xl p-4 shadow-card flex flex-col justify-between transition-all ${
                channel.enabled
                  ? "border-line/80 hover:border-line"
                  : "border-line/50 opacity-60 bg-subtle/50"
              }`}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-sm tracking-tighter uppercase font-mono border border-purple-100">
                      {channel.providerKey.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-fg text-sm">
                          {channel.name}
                        </h3>
                        {channel.isPrimary && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            {t("email.primary")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-fg-secondary line-clamp-1 mt-0.5">
                        {channel.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!channel.isPrimary && channel.enabled && (
                      <button
                        onClick={() => handleTogglePrimary(channel.id)}
                        className="text-[11px] text-fg-secondary hover:text-fg underline px-1"
                      >
                        {t("email.setPrimary")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Configuration details */}
                <div className="bg-subtle rounded-xl p-3.5 border border-line-subtle space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-fg-tertiary">{t("email.senderAddress")}</span>
                    <span className="font-mono text-fg font-medium">
                      "{channel.senderName}" &lt;{channel.senderEmail}&gt;
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-fg-tertiary">{t("email.smtpServer")}</span>
                    <span className="font-mono text-fg-secondary">
                      {channel.smtpHost}:{channel.smtpPort}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-fg-tertiary">{t("email.spfDkim")}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      {channel.verifiedDomain} {t("email.verified")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-fg-tertiary">{t("email.apiKey")}</span>
                    <div className="flex items-center gap-1 font-mono text-fg-secondary">
                      <span>{channel.apiKey.substring(0, 8)}••••••••</span>
                      <span className="text-[9px] text-rose-400 font-sans ml-1" title={t("email.copyForbiddenTitle")}>
                        {t("email.copyForbidden")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quota Progress */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-fg-secondary">{t("email.quotaUsage")}</span>
                    <span className="font-mono font-medium text-fg-secondary">
                      {t("email.quotaCount", {
                        sent: channel.sentToday.toLocaleString(),
                        total: channel.dailyQuota.toLocaleString(),
                        percent: quotaPercent,
                      })}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-hover rounded-full overflow-hidden">
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
              <div className="mt-5 pt-3.5 border-t border-line-subtle flex items-center justify-between text-xs">
                <span className="text-fg-tertiary font-mono text-[11px]">
                  {t("email.lastTested", { time: channel.lastTestedAt })}
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
                    <span>{t("email.sendTest")}</span>
                  </button>
                  <button
                    onClick={() => setEditingChannel(channel)}
                    className="px-2.5 py-1.5 border border-line hover:bg-subtle text-fg-secondary rounded-lg font-medium flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{t("email.configure")}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Pagination currentPage={currentPage} totalItems={channelList.length} pageSize={pageSize} onPageChange={setCurrentPage} />

      {/* Send Test Email SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-test-email"
        isOpen={!!testModalChannel}
        onClose={() => setTestModalChannel(null)}
        title={testModalChannel ? t("email.testSheet.titleWithChannel", { name: testModalChannel.name }) : t("email.testSheet.title")}
        description={t("email.testSheet.description")}
        icon={<Send className="w-4 h-4 text-fg" />}
        widthClass="max-w-md"
        footer={
          testModalChannel && !testFeedback ? (
            <>
              <button
                type="button"
                onClick={() => setTestModalChannel(null)}
                className="px-3.5 py-1.5 border border-line text-fg-secondary rounded-lg font-medium hover:bg-subtle cursor-pointer"
              >
                {t("common:actions.cancel")}
              </button>
              <button
                type="submit"
                form="form-test-email"
                disabled={isSendingTest}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center gap-1.5 shadow-card cursor-pointer"
              >
                {isSendingTest ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("email.testSheet.sending")}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{t("email.testSheet.sendNow")}</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setTestModalChannel(null)}
              className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium cursor-pointer"
            >
              {t("email.testSheet.done")}
            </button>
          )
        }
      >
        {testModalChannel &&
          (testFeedback ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
              {testFeedback}
            </div>
          ) : (
            <form id="form-test-email" onSubmit={handleSendTestEmail} className="space-y-4 text-xs">
              <div>
                <label className="text-fg-secondary block mb-1 font-medium">
                  {t("email.testSheet.recipientLabel")}
                </label>
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                  required
                />
                <p className="text-[11px] text-fg-tertiary mt-1">
                  {t("email.testSheet.senderHint", { email: testModalChannel.senderEmail })}
                </p>
              </div>

              <div className="p-3 bg-subtle rounded-xl border border-line/80 space-y-1 text-fg-secondary">
                <div className="font-medium text-fg">{t("email.testSheet.routePreview")}</div>
                <div className="text-[11px] font-mono text-fg-secondary">
                  {t("email.testSheet.routeHost", {
                    host: testModalChannel.smtpHost,
                    port: testModalChannel.smtpPort,
                  })}
                </div>
                <div className="text-[11px] font-mono text-fg-secondary">
                  {t("email.testSheet.routeSender", {
                    name: testModalChannel.senderName,
                    email: testModalChannel.senderEmail,
                  })}
                </div>
              </div>
            </form>
          ))}
      </SideSheet>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[9999] bg-primary text-primary-foreground px-3 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Add Channel SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-add-email-channel"
        isOpen={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
        title={t("email.createSheet.title")}
        description={t("email.createSheet.description")}
        icon={<Mail className="w-5 h-5 text-fg" />}
        widthClass="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCreateSheetOpen(false)}
              className="px-3 py-2 border border-line text-fg-secondary rounded-lg font-medium hover:bg-subtle cursor-pointer"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="submit"
              form="form-add-email-channel"
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium shadow-card cursor-pointer"
            >
              {t("email.createSheet.confirm")}
            </button>
          </>
        }
      >
        <form
          id="form-add-email-channel"
          onSubmit={handleAddChannel}
          className="space-y-3 text-xs"
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-fg-secondary block mb-1 font-medium">
                {t("email.createSheet.provider")}
              </label>
              <ShadcnSelect
                value={newForm.providerKey}
                onValueChange={(val) =>
                  setNewForm((f) => ({
                    ...f,
                    providerKey: val as EmailChannelConfig["providerKey"],
                  }))
                }
                options={[
                  { value: "sendgrid", label: t("email.providers.sendgrid") },
                  { value: "ses", label: t("email.providers.ses") },
                  { value: "resend", label: t("email.providers.resend") },
                  { value: "postmark", label: t("email.providers.postmark") },
                  { value: "mailgun", label: t("email.providers.mailgun") },
                ]}
              />
            </div>
            <div>
              <label className="text-fg-secondary block mb-1 font-medium">
                {t("email.createSheet.name")} <span className="text-rose-500">{t("email.createSheet.nameRequired")}</span>
              </label>
              <input
                type="text"
                required
                placeholder={t("email.createSheet.namePlaceholder")}
                value={newForm.name}
                onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg"
              />
            </div>
          </div>

          <div>
            <label className="text-fg-secondary block mb-1 font-medium">{t("email.createSheet.descriptionLabel")}</label>
            <input
              type="text"
              placeholder={t("email.createSheet.descriptionPlaceholder")}
              value={newForm.description}
              onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-fg-secondary block mb-1 font-medium">
                {t("email.createSheet.fromName")}
              </label>
              <input
                type="text"
                placeholder={t("email.createSheet.fromNamePlaceholder")}
                value={newForm.senderName}
                onChange={(e) => setNewForm((f) => ({ ...f, senderName: e.target.value }))}
                className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg"
              />
            </div>
            <div>
              <label className="text-fg-secondary block mb-1 font-medium">
                {t("email.createSheet.fromEmail")} <span className="text-rose-500">{t("email.createSheet.nameRequired")}</span>
              </label>
              <input
                type="email"
                required
                placeholder={t("email.createSheet.fromEmailPlaceholder")}
                value={newForm.senderEmail}
                onChange={(e) => setNewForm((f) => ({ ...f, senderEmail: e.target.value }))}
                className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-fg-secondary block mb-1 font-medium">{t("email.createSheet.apiKey")}</label>
            <input
              type="text"
              placeholder={t("email.createSheet.apiKeyPlaceholder")}
              value={newForm.apiKey}
              onChange={(e) => setNewForm((f) => ({ ...f, apiKey: e.target.value }))}
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-fg-secondary block mb-1 font-medium">{t("email.createSheet.smtpHost")}</label>
              <input
                type="text"
                value={newForm.smtpHost}
                onChange={(e) => setNewForm((f) => ({ ...f, smtpHost: e.target.value }))}
                className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
              />
            </div>
            <div>
              <label className="text-fg-secondary block mb-1 font-medium">{t("email.createSheet.smtpPort")}</label>
              <input
                type="number"
                value={newForm.smtpPort}
                onChange={(e) =>
                  setNewForm((f) => ({ ...f, smtpPort: Number(e.target.value) || 587 }))
                }
                className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-fg-secondary block mb-1 font-medium">{t("email.createSheet.dailyQuota")}</label>
            <input
              type="number"
              value={newForm.dailyQuota}
              onChange={(e) =>
                setNewForm((f) => ({ ...f, dailyQuota: Number(e.target.value) || 50000 }))
              }
              className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
            />
          </div>
        </form>
      </SideSheet>

      {/* Edit Channel SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-edit-email-channel"
        isOpen={!!editingChannel}
        onClose={() => setEditingChannel(null)}
        title={editingChannel ? t("email.editSheet.titleWithChannel", { name: editingChannel.name }) : t("email.editSheet.title")}
        description={t("email.editSheet.description")}
        icon={<Mail className="w-5 h-5 text-fg" />}
        widthClass="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingChannel(null)}
              className="px-3 py-2 border border-line text-fg-secondary rounded-lg font-medium hover:bg-subtle cursor-pointer"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="submit"
              form="form-edit-email-channel"
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium shadow-card cursor-pointer"
            >
              {t("email.editSheet.save")}
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
                <label className="text-fg-secondary block mb-1 font-medium">{t("email.editSheet.channelName")}</label>
                <input
                  type="text"
                  value={editingChannel.name}
                  onChange={(e) =>
                    setEditingChannel({ ...editingChannel, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-fg-secondary block mb-1 font-medium">{t("email.createSheet.fromName")}</label>
                  <input
                    type="text"
                    value={editingChannel.senderName}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, senderName: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg"
                    required
                  />
                </div>
                <div>
                  <label className="text-fg-secondary block mb-1 font-medium">{t("email.createSheet.fromEmail")}</label>
                  <input
                    type="email"
                    value={editingChannel.senderEmail}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, senderEmail: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-fg-secondary block mb-1 font-medium">{t("email.createSheet.apiKey")}</label>
                <input
                  type="text"
                  value={editingChannel.apiKey}
                  onChange={(e) =>
                    setEditingChannel({ ...editingChannel, apiKey: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-fg-secondary block mb-1 font-medium">{t("email.createSheet.smtpHost")}</label>
                  <input
                    type="text"
                    value={editingChannel.smtpHost}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, smtpHost: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                  />
                </div>
                <div>
                  <label className="text-fg-secondary block mb-1 font-medium">{t("email.createSheet.smtpPort")}</label>
                  <input
                    type="number"
                    value={editingChannel.smtpPort}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, smtpPort: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-fg-secondary block mb-1 font-medium">{t("email.editSheet.dailyQuotaMax")}</label>
                <input
                  type="number"
                  value={editingChannel.dailyQuota}
                  onChange={(e) =>
                    setEditingChannel({ ...editingChannel, dailyQuota: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                />
              </div>

            </form>
        )}
      </SideSheet>
    </div>
  );
};
