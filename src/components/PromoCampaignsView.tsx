import React, { useState } from "react";
import {
  Megaphone,
  Plus,
  Send,
  Calendar,
  Users,
  Tag,
  CheckCircle2,
  Clock,
  TrendingUp,
  Percent,
  Search,
  Filter,
  Eye,
  Mail,
  Zap,
  RotateCcw,
  Copy,
  DollarSign,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { PromoCampaign, DiscountConfig, EmailTemplate, Tenant } from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";

interface PromoCampaignsViewProps {
  campaigns: PromoCampaign[];
  discounts: DiscountConfig[];
  templates: EmailTemplate[];
  currentTenant: Tenant;
  onSaveCampaign: (campaign: PromoCampaign) => void;
}

export const PromoCampaignsView: React.FC<PromoCampaignsViewProps> = ({
  campaigns,
  discounts,
  templates,
  currentTenant,
  onSaveCampaign,
}) => {
  const [campaignList, setCampaignList] = useState<PromoCampaign[]>(campaigns);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState<PromoCampaign | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formAudience, setFormAudience] = useState<
    "ALL_USERS" | "TRIAL_USERS" | "CHURNED_90D" | "VIP_ENTERPRISE"
  >("ALL_USERS");
  const [formDiscountCode, setFormDiscountCode] = useState(discounts[0]?.code || "WELCOME20");
  const [formTemplateId, setFormTemplateId] = useState(templates[0]?.id || "promo_discount_offer");
  const [formSubject, setFormSubject] = useState("");
  const [formScheduleType, setFormScheduleType] = useState<"NOW" | "SCHEDULED">("NOW");
  const [formScheduleTime, setFormScheduleTime] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenAdd = () => {
    setFormName("");
    setFormAudience("ALL_USERS");
    setFormDiscountCode(discounts[0]?.code || "WELCOME20");
    setFormTemplateId("promo_discount_offer");
    setFormSubject("🔥 Special Discount Inside: Upgrade Your Account Today!");
    setFormScheduleType("NOW");
    setFormScheduleTime(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    setIsModalOpen(true);
  };

  const handleDuplicateCampaign = (c: PromoCampaign) => {
    const duplicated: PromoCampaign = {
      ...c,
      id: `camp_${Date.now().toString().slice(-6)}`,
      name: `${c.name} (复制副本)`,
      status: "DRAFT",
      sentTime: undefined,
      scheduledTime: undefined,
      deliveredCount: 0,
      openRate: 0,
      clickRate: 0,
      conversionRate: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setCampaignList([duplicated, ...campaignList]);
    onSaveCampaign(duplicated);
    showToast(`活动【${duplicated.name}】已成功复制为新草稿！`);
  };

  const handleTriggerSend = (c: PromoCampaign) => {
    setSendingId(c.id);
    setTimeout(() => {
      setSendingId(null);
      const updated: PromoCampaign = {
        ...c,
        status: "SENT",
        sentTime: new Date().toISOString().replace("T", " ").substring(0, 19),
        deliveredCount: c.totalRecipients - 8,
        openRate: 41.5,
        clickRate: 17.8,
        conversionRate: 8.6,
      };
      setCampaignList((prev) => prev.map((item) => (item.id === c.id ? updated : item)));
      onSaveCampaign(updated);
      showToast(
        `促销邮件【${c.name}】已成功向 ${c.totalRecipients} 位海外目标客户分发，各渠道投递率 99.8%！`
      );
    }, 1200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isNow = formScheduleType === "NOW";
    const recipientCount =
      formAudience === "ALL_USERS"
        ? 4920
        : formAudience === "TRIAL_USERS"
        ? 1350
        : formAudience === "CHURNED_90D"
        ? 940
        : 380;

    const newCamp: PromoCampaign = {
      id: `camp_${Date.now().toString().slice(-6)}`,
      name: formName.trim(),
      targetAudience: formAudience,
      discountCode: formDiscountCode,
      emailTemplateId: formTemplateId,
      emailSubject: formSubject.trim(),
      status: isNow ? "SENT" : "SCHEDULED",
      scheduledTime: isNow ? undefined : formScheduleTime.replace("T", " ") + ":00",
      sentTime: isNow ? new Date().toISOString().replace("T", " ").substring(0, 19) : undefined,
      totalRecipients: recipientCount,
      deliveredCount: isNow ? recipientCount - 6 : 0,
      openRate: isNow ? 38.6 : 0,
      clickRate: isNow ? 15.2 : 0,
      conversionRate: isNow ? 7.4 : 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setCampaignList((prev) => [newCamp, ...prev]);
    onSaveCampaign(newCamp);
    showToast(
      isNow
        ? `促销活动【${newCamp.name}】已即时触发投递！`
        : `促销活动【${newCamp.name}】已成功排期至 ${newCamp.scheduledTime}`
    );
    setIsModalOpen(false);
  };

  const filteredCampaigns = campaignList.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.emailSubject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.discountCode && c.discountCode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSentCampaigns = campaignList.filter((c) => c.status === "SENT").length;
  const totalSentRecipients = campaignList
    .filter((c) => c.status === "SENT")
    .reduce((acc, curr) => acc + curr.totalRecipients, 0);

  const matchedTemplate = previewCampaign
    ? templates.find((t) => t.id === previewCampaign.emailTemplateId) || templates[0]
    : null;

  return (
    <div className="space-y-6 font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Megaphone className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              海外营销促销邮件管理 (Marketing & Promo Campaigns)
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            精准圈选海外目标客群（试用未转化、流失召回、高净值企业），自动化嵌入多语言优惠券与营销模版，追踪邮件投递转化与产生的 GMV 流水。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建促销营销活动</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>已成功投递批次</span>
            <Send className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-1">
            {totalSentCampaigns} <span className="text-xs font-normal text-zinc-400">/ {campaignList.length} 场活动</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">高可靠海外直连投递保障</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>触达海外买家总人次</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-1">
            {totalSentRecipients.toLocaleString()} <span className="text-xs font-normal text-zinc-400">人次</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">平均海外邮箱开信率: 45.8%</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>促销带来直接成交 GMV</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-1">
            $94,320
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">优惠券核销关联直接转化收益</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>多语言动态渲染</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-1">
            6 国语言 <span className="text-xs font-normal text-zinc-400">全自动</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">根据接收人地区自适应语言模版</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-400 text-xs">状态筛选:</span>
          {[
            { key: "ALL", label: "全部活动" },
            { key: "SENT", label: "已投递 (Sent)" },
            { key: "SCHEDULED", label: "已排期 (Scheduled)" },
            { key: "DRAFT", label: "草稿 (Draft)" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            placeholder="搜索活动名称 / 邮件主题 / 优惠码..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/90 border-b border-zinc-200 text-zinc-500 font-semibold text-[11px]">
                <th className="py-3 px-4 min-w-[240px]">活动名称 & 邮件主题</th>
                <th className="py-3 px-4 w-[150px]">目标受众</th>
                <th className="py-3 px-4 w-[130px]">绑定折扣券</th>
                <th className="py-3 px-4 w-[110px]">受众规模</th>
                <th className="py-3 px-4 w-[180px]">打开 / 点击 / 转化</th>
                <th className="py-3 px-4 w-[120px]">带来估算 GMV</th>
                <th className="py-3 px-4 w-[160px]">排期 / 发送时间</th>
                <th className="py-3 px-4 w-[110px]">状态</th>
                <th className="py-3 px-4 w-[180px] sticky right-0 z-20 bg-zinc-50/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredCampaigns.map((c) => {
                const isSending = sendingId === c.id;
                const estimatedGmv =
                  c.status === "SENT"
                    ? Math.round(c.totalRecipients * (c.conversionRate / 100) * 89)
                    : 0;

                return (
                  <tr key={c.id} className="hover:bg-zinc-50/80 transition-colors group">
                    <td className="py-3.5 px-4 min-w-[240px]">
                      <div className="font-semibold text-zinc-900 line-clamp-1">{c.name}</div>
                      <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5 line-clamp-1">
                        <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
                        <span className="truncate">{c.emailSubject}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 w-[150px] whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 text-zinc-700">
                        <Users className="w-3 h-3 text-zinc-500" />
                        {c.targetAudience === "ALL_USERS"
                          ? "全量出海用户"
                          : c.targetAudience === "TRIAL_USERS"
                          ? "试用期未转化用户"
                          : c.targetAudience === "CHURNED_90D"
                          ? "90天未活跃召回"
                          : "高净值企业 VIP"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 w-[130px] whitespace-nowrap">
                      {c.discountCode ? (
                        <span className="font-mono font-bold text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded">
                          {c.discountCode}
                        </span>
                      ) : (
                        <span className="text-zinc-400">无优惠码</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 w-[110px] whitespace-nowrap font-mono">
                      <span className="font-bold text-zinc-900">
                        {c.totalRecipients.toLocaleString()}
                      </span>{" "}
                      <span className="text-zinc-400 text-[10px]">人</span>
                    </td>

                    <td className="py-3.5 px-4 w-[180px] whitespace-nowrap">
                      {c.status === "SENT" ? (
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <div>
                            <span className="text-zinc-400 text-[9px] block">打开</span>
                            <span className="font-bold text-blue-600">{c.openRate}%</span>
                          </div>
                          <div>
                            <span className="text-zinc-400 text-[9px] block">点击</span>
                            <span className="font-bold text-amber-600">{c.clickRate}%</span>
                          </div>
                          <div>
                            <span className="text-zinc-400 text-[9px] block">转化</span>
                            <span className="font-bold text-emerald-600">{c.conversionRate}%</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-400 text-[10px]">未开始统计</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 w-[120px] whitespace-nowrap font-mono font-bold text-zinc-900">
                      {c.status === "SENT" ? (
                        <span className="text-emerald-700">${estimatedGmv.toLocaleString()}</span>
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 w-[160px] whitespace-nowrap text-[11px] font-mono text-zinc-500">
                      {c.sentTime ? (
                        <div>
                          <span className="text-emerald-600 font-bold">发:</span> {c.sentTime.slice(5, 16)}
                        </div>
                      ) : c.scheduledTime ? (
                        <div>
                          <span className="text-amber-600 font-bold">排:</span> {c.scheduledTime.slice(5, 16)}
                        </div>
                      ) : (
                        <span className="text-zinc-400">草稿暂未预约</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 w-[110px] whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          c.status === "SENT"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : c.status === "SCHEDULED"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-zinc-100 text-zinc-500 border-zinc-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.status === "SENT"
                              ? "bg-emerald-500"
                              : c.status === "SCHEDULED"
                              ? "bg-amber-500"
                              : "bg-zinc-400"
                          }`}
                        />
                        {c.status === "SENT"
                          ? "已投递"
                          : c.status === "SCHEDULED"
                          ? "预约排期中"
                          : "草稿暂存"}
                      </span>
                    </td>

                    {/* Actions: Sticky Right */}
                    <td className="py-3.5 px-4 w-[180px] sticky right-0 z-10 bg-white group-hover:bg-zinc-50/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreviewCampaign(c)}
                          className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                          title="预览邮件外观"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>预览</span>
                        </button>

                        <button
                          onClick={() => handleDuplicateCampaign(c)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                          title="复制创建新活动"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {c.status !== "SENT" ? (
                          <button
                            onClick={() => handleTriggerSend(c)}
                            disabled={isSending}
                            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <Send className="w-3 h-3 text-amber-400" />
                            <span>{isSending ? "投递中" : "派发"}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleTriggerSend(c)}
                            disabled={isSending}
                            className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                            title="重新补发该营销批次"
                          >
                            <RotateCcw className="w-3 h-3 text-zinc-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Email Preview SideSheet */}
      {previewCampaign && (
        <SideSheet
          id="side-sheet-campaign-preview"
          isOpen={true}
          onClose={() => setPreviewCampaign(null)}
          title="海外营销邮件真实渲染预览"
          description={`活动: ${previewCampaign.name}`}
          icon={<Mail className="w-5 h-5 text-amber-600" />}
          widthClass="max-w-xl"
          footer={
            <button
              type="button"
              onClick={() => setPreviewCampaign(null)}
              className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              关闭预览
            </button>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Email Shell Mock */}
            <div className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50 shadow-inner">
              <div className="bg-zinc-100 p-3 border-b border-zinc-200 text-zinc-600 space-y-1">
                <div>
                  <span className="text-zinc-400">发件人:</span> Novas Global Payments &lt;marketing@novaspay.com&gt;
                </div>
                <div>
                  <span className="text-zinc-400">主 题:</span>{" "}
                  <strong className="text-zinc-900">{previewCampaign.emailSubject}</strong>
                </div>
                <div>
                  <span className="text-zinc-400">目标群体:</span> {previewCampaign.targetAudience} ({previewCampaign.totalRecipients.toLocaleString()} 位客户)
                </div>
              </div>

              {/* Email Body Card */}
              <div className="p-6 bg-white max-w-md mx-auto my-4 rounded-xl border border-zinc-200 shadow-sm text-center space-y-4">
                <div className="w-10 h-10 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-base">
                  N
                </div>
                <h4 className="text-base font-bold text-zinc-900">
                  Novas Global Pay • Special Offer
                </h4>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Hi valued customer, we have an exclusive reward waiting for your team. Use this limited-time voucher before the offer expires!
                </p>

                {previewCampaign.discountCode && (
                  <div className="p-3 bg-amber-50 border border-dashed border-amber-300 rounded-xl text-amber-900">
                    <span className="text-[11px] block text-amber-700 uppercase tracking-wider font-semibold">
                      Your Exclusive Discount Voucher
                    </span>
                    <span className="text-lg font-mono font-bold tracking-widest text-amber-950 mt-1 block">
                      {previewCampaign.discountCode}
                    </span>
                  </div>
                )}

                <div>
                  <a
                    href="#claim"
                    onClick={(e) => e.preventDefault()}
                    className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs"
                  >
                    Claim Your Discount Now →
                  </a>
                </div>

                <div className="text-[10px] text-zinc-400 pt-3 border-t border-zinc-100">
                  Manage email preferences or unsubscribe from promotional updates at any time.
                </div>
              </div>
            </div>
          </div>
        </SideSheet>
      )}

      {/* Add Campaign SideSheet */}
      {isModalOpen && (
        <SideSheet
          id="side-sheet-campaign-create"
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title="新建海外营销促销邮件活动"
          description="面向全球目标客群精准定向派发营销促销与优惠券模版"
          icon={<Megaphone className="w-5 h-5 text-amber-600" />}
          widthClass="max-w-lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 font-medium cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
              >
                {formScheduleType === "NOW" ? "立即派发活动" : "保存活动排期"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-zinc-700 block mb-1">
                活动名称 (内部识别):
              </label>
              <input
                type="text"
                required
                placeholder="如：2026 黑色星期五早鸟 7 折专属优惠"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  目标受众客群:
                </label>
                <ShadcnSelect
                  value={formAudience}
                  onValueChange={(val) => setFormAudience(val as any)}
                  options={[
                    { value: "ALL_USERS", label: "全量出海客户 (~4,920 人)" },
                    { value: "TRIAL_USERS", label: "试用期未转化客户 (~1,350 人)" },
                    { value: "CHURNED_90D", label: "90天未登录流失召回 (~940 人)" },
                    { value: "VIP_ENTERPRISE", label: "高净值企业 VIP (~380 人)" },
                  ]}
                />
              </div>

              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  绑定优惠折扣码:
                </label>
                <ShadcnSelect
                  value={formDiscountCode}
                  onValueChange={(val) => setFormDiscountCode(val)}
                  options={discounts.map((d) => ({
                    value: d.code,
                    label: `${d.code} - ${d.name} (${d.type === "PERCENTAGE" ? `${d.value}% OFF` : `-$${d.value}`})`,
                  }))}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">
                选择基础邮件模版:
              </label>
              <ShadcnSelect
                value={formTemplateId}
                onValueChange={(val) => setFormTemplateId(val)}
                options={templates.map((t) => ({
                  value: t.id,
                  label: `${t.name} (${t.id})`,
                }))}
              />
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">
                邮件标题 / 主题 (Subject):
              </label>
              <input
                type="text"
                required
                placeholder="如：🔥 Black Friday Early Access: Save 30% Today!"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:bg-white font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">
                发送时间设定:
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={formScheduleType === "NOW"}
                    onChange={() => setFormScheduleType("NOW")}
                  />
                  <span>审核后立即发送</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={formScheduleType === "SCHEDULED"}
                    onChange={() => setFormScheduleType("SCHEDULED")}
                  />
                  <span>定时预约发送</span>
                </label>
              </div>

              {formScheduleType === "SCHEDULED" && (
                <div className="mt-2">
                  <input
                    type="datetime-local"
                    value={formScheduleTime}
                    onChange={(e) => setFormScheduleTime(e.target.value)}
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  />
                </div>
              )}
            </div>
          </form>
        </SideSheet>
      )}
    </div>
  );
};
