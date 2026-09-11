import React, { useState, useEffect } from "react";
import { useViewLoading } from "./ui/useViewLoading";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { TableSkeleton } from "./ui/Skeletons";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Edit2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Zap,
  Globe,
  Sliders,
  Power,
  Plus,
  Sparkles,
  ArrowRight,
  X,
  ExternalLink,
  ShieldAlert,
  Layers,
} from "lucide-react";
import { PaymentChannelConfig, PaymentChannel, TransactionRecord, PaymentApp, DictionaryEntry } from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";

interface PaymentChannelsViewProps {
  channels: PaymentChannelConfig[];
  apps?: PaymentApp[];
  dictionary?: DictionaryEntry[];
  onUpdateChannel?: (channel: PaymentChannelConfig) => void;
  onSaveChannel?: (channel: PaymentChannelConfig) => void;
  onCreateTestTransaction?: (tx: TransactionRecord) => void;
  onNavigateToTransactions?: () => void;
}

export const PaymentChannelsView: React.FC<PaymentChannelsViewProps> = ({
  channels,
  apps = [],
  dictionary = [],
  onUpdateChannel,
  onSaveChannel,
  onCreateTestTransaction,
  onNavigateToTransactions,
}) => {
  const [channelList, setChannelList] = useState<PaymentChannelConfig[]>(channels);
  const { currentPage, setCurrentPage, reset: _pcr, pageSize } = usePagination(10);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; msg: string; success: boolean } | null>(null);
  const [showSecretMap, setShowSecretMap] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingChannel, setEditingChannel] = useState<PaymentChannelConfig | null>(null);

  // 接入新渠道（需求9：从字典选渠道 + 填写账号信息）
  const [isAddChannelOpen, setIsAddChannelOpen] = useState(false);
  const [formChannelKey, setFormChannelKey] = useState("");
  const [formAccountName, setFormAccountName] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formApiSecret, setFormApiSecret] = useState("");
  const [formWebhookSecret, setFormWebhookSecret] = useState("");
  const [formMode, setFormMode] = useState<"live" | "test">("live");
  const [formCurrencies, setFormCurrencies] = useState("USD,EUR,GBP");
  const [formFeeRate, setFormFeeRate] = useState("");

  // 字典中"支付渠道"分类的候选渠道词条
  const dictChannelEntries = dictionary.filter((d) => d.category === "PAYMENT_CHANNEL");

  // 应用详情 SideSheet（需求4：点击应用名 chips 查看其绑定渠道）
  const [selectedApp, setSelectedApp] = useState<PaymentApp | null>(null);
  const [appSheetRelatedChannel, setAppSheetRelatedChannel] = useState<PaymentChannelConfig | null>(null);

  // Test Transaction Modal State
  const [isTestTxModalOpen, setIsTestTxModalOpen] = useState(false);
  const [selectedTestChannel, setSelectedTestChannel] = useState<PaymentChannelConfig | null>(null);
  const [testScenario, setTestScenario] = useState<"SUCCESS" | "3DS" | "FRAUD" | "INSUFFICIENT_FUNDS">("SUCCESS");
  const [testCurrency, setTestCurrency] = useState("USD");
  const [testAmount, setTestAmount] = useState("49.00");
  const [testAppName, setTestAppName] = useState("Novas AI Copilot (出海AI助手)");
  const [isExecutingTxTest, setIsExecutingTxTest] = useState(false);
  const [lastExecutedTxResult, setLastExecutedTxResult] = useState<{
    tx: TransactionRecord;
    rawJson: string;
    success: boolean;
    message: string;
  } | null>(null);

  const toggleShowSecret = (id: string) => {
    setShowSecretMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestConnection = (channel: PaymentChannelConfig) => {
    setTestingId(channel.id);
    setTestResult(null);
    setTimeout(() => {
      setTestingId(null);
      const simulatedLatency = Math.floor(Math.random() * 80) + 95;
      const updated = {
        ...channel,
        lastTestedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
        testStatus: "HEALTHY" as const,
        latencyMs: simulatedLatency,
      };
      setChannelList((prev) => prev.map((c) => (c.id === channel.id ? updated : c)));
      onUpdateChannel(updated);
      setTestResult({
        id: channel.id,
        msg: `API 握手成功！公私钥校验通过，海外网关握手耗时 ${simulatedLatency}ms (TLS 1.3)`,
        success: true,
      });
      setTimeout(() => setTestResult(null), 5000);
    }, 1000);
  };

  const handleToggleEnabled = (channel: PaymentChannelConfig) => {
    const updated = { ...channel, enabled: !channel.enabled };
    setChannelList((prev) => prev.map((c) => (c.id === channel.id ? updated : c)));
    if (onUpdateChannel) onUpdateChannel(updated);
    if (onSaveChannel) onSaveChannel(updated);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel) return;
    setChannelList((prev) => prev.map((c) => (c.id === editingChannel.id ? editingChannel : c)));
    if (onUpdateChannel) onUpdateChannel(editingChannel);
    if (onSaveChannel) onSaveChannel(editingChannel);
    setEditingChannel(null);
  };

  // 接入新渠道：从渠道池批量创建并同步父级 App 的 paymentChannels
  const handleConfirmNewChannel = () => {
    if (!formChannelKey) { alert("请先选择要接入的渠道"); return; }
    const entry = dictChannelEntries.find((e) => e.key === formChannelKey);
    // 从 channel.<slug>.name 提取 channelKey
    const slug = (formChannelKey.match(/^channel\.(.+)\.name$/)?.[1]) || formChannelKey;
    const channelName = (entry?.translations?.["zh-CN"] || entry?.translations?.["en-US"] || entry?.key || slug) as string;
    const newChannel: PaymentChannelConfig = {
      id: `ch_${slug}_${Date.now()}`,
      channelKey: slug as PaymentChannelConfig["channelKey"],
      name: channelName,
      description: formAccountName.trim() ? `${channelName} · ${formAccountName.trim()}` : entry?.description || channelName,
      enabled: true,
      mode: formMode,
      apiPublicKey: formApiKey.trim() || `pk_${formMode}_${Math.random().toString(36).slice(2, 10)}`,
      apiSecretKey: formApiSecret.trim() || `sk_${formMode}_${Math.random().toString(36).slice(2, 12)}`,
      webhookSecret: formWebhookSecret.trim() || `whsec_${Math.random().toString(36).slice(2, 12)}`,
      supportedCurrencies: formCurrencies.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
      feeRateText: formFeeRate.trim() || "—",
      routingPriority: channelList.length + 1,
      lastTestedAt: "未测试",
      testStatus: "DEGRADED",
      latencyMs: 0,
    };
    setChannelList((prev) => [...prev, newChannel]);
    if (onSaveChannel) onSaveChannel(newChannel);
    setIsAddChannelOpen(false);
    // 重置表单
    setFormChannelKey("");
    setFormAccountName("");
    setFormApiKey("");
    setFormApiSecret("");
    setFormWebhookSecret("");
    setFormCurrencies("USD,EUR,GBP");
    setFormFeeRate("");
  };

  // 打开应用详情 SideSheet
  const openAppSheet = (app: PaymentApp, channel?: PaymentChannelConfig) => {
    setSelectedApp(app);
    setAppSheetRelatedChannel(channel || null);
  };

  const handleExecuteTestTransaction = () => {
    const channel = selectedTestChannel || channelList[0];
    if (!channel) return;

    setIsExecutingTxTest(true);
    setLastExecutedTxResult(null);

    setTimeout(() => {
      setIsExecutingTxTest(false);
      const parsedAmount = parseFloat(testAmount) || 49.00;
      const isSuccessScenario = testScenario === "SUCCESS" || testScenario === "3DS";
      const simulatedLatency = Math.floor(Math.random() * 60) + 85;
      const now = new Date();
      const timeString = now.toISOString().replace("T", " ").substring(0, 19);

      const gatewayTradeNo = `${
        channel.channelKey === "stripe"
          ? "pi_test_"
          : channel.channelKey === "paypal"
          ? "PAYID-TEST-"
          : "adyen_ps_"
      }${Math.random().toString(36).substring(2, 14)}`;

      let reconStatus = "done";
      let discrepancyType = undefined;
      let discrepancyNote = undefined;
      let failureReason = "";

      if (testScenario === "FRAUD") {
        reconStatus = "discrepancy";
        discrepancyType = "status_mismatch" as any;
        discrepancyNote = "Stripe Radar 风控评分 88 (高风险欺诈)，已被网关强制拦截";
        failureReason = "RADAR_RISK_RULE_BLOCKED: Score 88 > Threshold 75";
      } else if (testScenario === "INSUFFICIENT_FUNDS") {
        reconStatus = "discrepancy";
        discrepancyType = "amount_mismatch" as any;
        discrepancyNote = "发卡行返回 51: Insufficient funds (持卡人账户可用余额不足)";
        failureReason = "DECLINED_CODE_51: Insufficient Funds";
      }

      const newTx: TransactionRecord = {
        id: `TX-TEST-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}-${Math.floor(
          100000 + Math.random() * 900000
        )}`,
        tenantId: "bu_na_ecom",
        channel: channel.channelKey as PaymentChannel,
        orderTitle: `[沙箱测试] ${testAppName} - ${
          testScenario === "3DS" ? "3DS强认证挑战" : "在线收单"
        }`,
        orderNumber: `ORD-TEST-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        orderAmount: parsedAmount,
        channelFee: Math.round(parsedAmount * 0.029 * 100) / 100,
        currency: testCurrency,
        createdAt: timeString,
        status: reconStatus as any,
        discrepancyType,
        discrepancyNote,
        customerName: "Alex Vance (海外测试专员)",
        customerEmail: "tester.alex@northam-corp.io",
        customerCountry: "🇺🇸 US",
        merchantName: channel.name,
        paymentMethod:
          channel.channelKey === "paypal"
            ? "PayPal Wallet Sandbox"
            : testScenario === "3DS"
            ? "Visa 3DS Verified (•••• 4000)"
            : "Visa Test Card (•••• 4242)",
        channelTradeNo: gatewayTradeNo,
        riskScore: testScenario === "FRAUD" ? 88 : 12,
        timeline: [
          {
            id: "step_1",
            title: "客户端拉起支付请求",
            description: `应用【${testAppName}】请求创建 PaymentIntent (${parsedAmount} ${testCurrency})`,
            timestamp: timeString,
            status: "completed",
            actor: testAppName,
          },
          {
            id: "step_2",
            title: `${channel.name} 国际网关握手`,
            description: `TLS 1.3 双向验签链路建立，网关握手耗时 ${simulatedLatency}ms`,
            timestamp: timeString,
            status: "completed",
            actor: channel.name,
            latencyMs: simulatedLatency,
          },
          {
            id: "step_3",
            title: testScenario === "3DS" ? "3D-Secure 2.2 协议核身" : "国际卡组织清算授权",
            description:
              testScenario === "3DS"
                ? "通过 3DS 2.2 协议完成 Frictionless 强身份认证挑战"
                : isSuccessScenario
                ? "授权成功，实时扣收完成"
                : failureReason,
            timestamp: timeString,
            status: isSuccessScenario ? "completed" : "failed",
            actor: "Global Card Network / Issuer",
          },
          {
            id: "step_4",
            title: "聚合支付中台账单记账",
            description: isSuccessScenario
              ? "本地流水创建完毕，对账状态已标记为已对齐，Webhook 通知已投递"
              : "生成异常交易工单并推送风控监控看板",
            timestamp: timeString,
            status: isSuccessScenario ? "completed" : "failed",
            actor: "聚合支付清算中心",
          },
        ],
      };

      if (onCreateTestTransaction) {
        onCreateTestTransaction(newTx);
      }

      const updatedChannel = {
        ...channel,
        lastTestedAt: timeString,
        latencyMs: simulatedLatency,
      };
      setChannelList((prev) => prev.map((c) => (c.id === channel.id ? updatedChannel : c)));
      if (onUpdateChannel) onUpdateChannel(updatedChannel);
      if (onSaveChannel) onSaveChannel(updatedChannel);

      const rawJson = JSON.stringify(
        {
          id: gatewayTradeNo,
          object: "payment_intent",
          amount: Math.round(parsedAmount * 100),
          currency: testCurrency.toLowerCase(),
          status: isSuccessScenario ? "succeeded" : "requires_payment_method",
          payment_method: newTx.paymentMethod,
          channel: channel.channelKey,
          radar_risk_score: newTx.riskScore,
          livemode: false,
          test_scenario: testScenario,
          latency_ms: simulatedLatency,
          created: Math.floor(now.getTime() / 1000),
          cancellation_reason: failureReason || null,
        },
        null,
        2
      );

      setLastExecutedTxResult({
        tx: newTx,
        rawJson,
        success: isSuccessScenario,
        message: isSuccessScenario
          ? `测试交易执行成功！网关单号 ${gatewayTradeNo}，耗时 ${simulatedLatency}ms，交易数据已入库！`
          : `测试交易已按预期拦截：${failureReason}，已标记为对账异常流水！`,
      });
    }, 600);
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">
              海外支付渠道配置
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            配置与调优海外收单网关密钥（Stripe、PayPal、Adyen、Klarna、SEPA 等），支持智能抗欺诈路由、动态汇率转换与毫秒级通道连通性探活。
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsAddChannelOpen(true)}
            className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>接入新渠道</span>
          </button>
        </div>
      </div>

      {/* Test feedback notification */}
      {testResult && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
            testResult.success
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{testResult.msg}</span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {paginate<PaymentChannelConfig>(channelList, currentPage, pageSize).map((channel) => {
          const isSecretVisible = showSecretMap[channel.id];
          const isTesting = testingId === channel.id;

          return (
            <div
              key={channel.id}
              className={`bg-surface border rounded-2xl p-4 shadow-card transition-all flex flex-col justify-between ${
                channel.enabled
                  ? "border-line/80 hover:border-line"
                  : "border-line/50 opacity-70 bg-subtle/50"
              }`}
            >
              <div className="space-y-4">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-hover flex items-center justify-center font-bold text-fg text-sm tracking-tighter uppercase font-mono border border-line/80">
                      {channel.channelKey.slice(0, 3)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-fg text-sm">
                          {channel.name}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            channel.mode === "live"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {channel.mode}
                        </span>
                      </div>
                      <p className="text-xs text-fg-secondary line-clamp-1 mt-0.5">
                        {channel.description}
                      </p>
                    </div>
                  </div>

                  {/* Enable Switch */}
                  <button
                    onClick={() => handleToggleEnabled(channel)}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      channel.enabled
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-hover text-fg-tertiary border-line hover:bg-hover"
                    }`}
                    title={channel.enabled ? "点击停用渠道" : "点击启用渠道"}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                </div>

                {/* Key Configuration Parameters */}
                <div className="bg-subtle rounded-xl p-3 border border-line-subtle space-y-2.5 text-xs font-mono">
                  {/* Public Key */}
                  <div>
                    <span className="text-[10px] text-fg-tertiary block font-sans">
                      Publishable Client Key (公钥)
                    </span>
                    <div className="flex items-center justify-between text-fg-secondary mt-0.5">
                      <span className="truncate max-w-[280px]">{channel.apiPublicKey}</span>
                      <button
                        onClick={() => copyText(channel.apiPublicKey, `${channel.id}_pub`)}
                        className="text-fg-tertiary hover:text-fg-secondary ml-2 shrink-0"
                      >
                        {copiedKey === `${channel.id}_pub` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Secret Key */}
                  <div className="pt-2 border-t border-line/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-fg-tertiary font-sans">
                        Secret API Key (私钥)
                      </span>
                      <button
                        onClick={() => toggleShowSecret(channel.id)}
                        className="text-fg-tertiary hover:text-fg-secondary text-[10px] flex items-center gap-1 font-sans"
                      >
                        {isSecretVisible ? (
                          <>
                            <EyeOff className="w-3 h-3" /> 隐藏
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" /> 显示
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-fg-secondary mt-0.5">
                      <span className="truncate max-w-[280px]">
                        {isSecretVisible
                          ? channel.apiSecretKey
                          : "sk_live_••••••••••••••••••••••••••••••••"}
                      </span>
                      <button
                        onClick={() => copyText(channel.apiSecretKey, `${channel.id}_sec`)}
                        className="text-fg-tertiary hover:text-fg-secondary ml-2 shrink-0"
                      >
                        {copiedKey === `${channel.id}_sec` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Webhook Secret */}
                  <div className="pt-2 border-t border-line/60">
                    <span className="text-[10px] text-fg-tertiary block font-sans">
                      Webhook Signing Secret (验签密钥)
                    </span>
                    <div className="flex items-center justify-between text-fg-secondary mt-0.5">
                      <span className="truncate max-w-[280px]">
                        {isSecretVisible
                          ? channel.webhookSecret
                          : "whsec_••••••••••••••••••••••••"}
                      </span>
                      <button
                        onClick={() => copyText(channel.webhookSecret, `${channel.id}_wh`)}
                        className="text-fg-tertiary hover:text-fg-secondary ml-2 shrink-0"
                      >
                        {copiedKey === `${channel.id}_wh` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Attributes badges */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-fg-tertiary">支持币种:</span>
                    {channel.supportedCurrencies.map((curr) => (
                      <span
                        key={curr}
                        className="px-1.5 py-0.5 bg-hover text-fg-secondary rounded text-[10px] font-mono font-bold"
                      >
                        {curr}
                      </span>
                    ))}
                  </div>

                  <div className="text-fg-secondary text-xs">
                    综合扣率: <strong className="text-fg font-mono">{channel.feeRateText}</strong>
                  </div>
                </div>

                {/* 关联应用（使用了该支付渠道的应用） */}
                {(() => {
                  const relatedApps = apps.filter((app) =>
                    (app.enabledChannels || []).includes(channel.channelKey)
                  );
                  if (relatedApps.length === 0) return null;
                  const shown = relatedApps.slice(0, 3);
                  const rest = relatedApps.slice(3);
                  return (
                    <div className="pt-2 border-t border-line-subtle/80">
                      <div className="text-[10px] text-fg-tertiary font-sans mb-1.5 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-fg-tertiary" />
                        已启用该渠道的应用 ({relatedApps.length})
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {shown.map((app) => (
                          <button
                            key={app.id}
                            type="button"
                            title={`查看 ${app.name} 绑定的全部支付渠道`}
                            onClick={() => openAppSheet(app, channel)}
                            className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-medium border border-blue-100 inline-flex items-center gap-1 hover:bg-blue-100 hover:border-blue-200 transition-colors cursor-pointer"
                          >
                            {app.name}
                          </button>
                        ))}
                        {rest.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openAppSheet(relatedApps[0], channel)}
                            title="查看该渠道关联应用与渠道绑定"
                            className="px-1.5 py-0.5 bg-hover text-fg-secondary hover:bg-hover rounded-md text-[10px] font-medium transition-colors cursor-pointer"
                          >
                            +{rest.length} 更多
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 pt-4 border-t border-line-subtle flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      channel.testStatus === "HEALTHY" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="text-fg-secondary font-mono text-[11px]">
                    {channel.latencyMs}ms • 优先级 #{channel.routingPriority}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedTestChannel(channel);
                      setIsTestTxModalOpen(true);
                      setLastExecutedTxResult(null);
                    }}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer text-xs"
                    title="使用该渠道发起模拟测试交易"
                  >
                    <Zap className="w-3.5 h-3.5 text-indigo-600" />
                    <span>测试交易</span>
                  </button>

                  <button
                    onClick={() => handleTestConnection(channel)}
                    disabled={isTesting}
                    className="px-2.5 py-1.5 bg-hover hover:bg-hover text-fg-secondary rounded-lg font-medium flex items-center gap-1 transition-colors text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
                    <span>{isTesting ? "测试中..." : "测试连通性"}</span>
                  </button>
                  <button
                    onClick={() => setEditingChannel(channel)}
                    className="px-2.5 py-1.5 border border-line hover:bg-subtle text-fg-secondary rounded-lg font-medium flex items-center gap-1 transition-colors text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>编辑</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Pagination currentPage={currentPage} totalItems={channelList.length} pageSize={pageSize} onPageChange={setCurrentPage} />

      {/* Edit Channel SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-edit-channel"
        isOpen={!!editingChannel}
        onClose={() => setEditingChannel(null)}
        title={editingChannel ? `编辑支付渠道配置 - ${editingChannel.name}` : "编辑支付渠道配置"}
        description="维护渠道密钥、费率与路由优先级；密钥仅保存在本机 Mock 环境。"
        icon={<CreditCard className="w-5 h-5 text-fg" />}
        widthClass="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingChannel(null)}
              className="px-3 py-2 border border-line text-fg-secondary rounded-lg font-medium hover:bg-subtle cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              form="form-edit-channel"
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium shadow-card cursor-pointer"
            >
              保存配置
            </button>
          </>
        }
      >
        {editingChannel && (
          <form id="form-edit-channel" onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="text-fg-secondary block mb-1 font-medium">渠道显示名称</label>
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

              <div>
                <label className="text-fg-secondary block mb-1 font-medium">运行模式</label>
                <ShadcnSelect
                  value={editingChannel.mode}
                  onValueChange={(val) =>
                    setEditingChannel({
                      ...editingChannel,
                      mode: val as "live" | "sandbox",
                    })
                  }
                  options={[
                    { value: "live", label: "Live 生产环境" },
                    { value: "sandbox", label: "Sandbox 沙箱环境" },
                  ]}
                  placeholder="选择运行模式"
                />
              </div>

              <div>
                <label className="text-fg-secondary block mb-1 font-medium">公钥 (Publishable Key)</label>
                <input
                  type="text"
                  value={editingChannel.apiPublicKey}
                  onChange={(e) =>
                    setEditingChannel({ ...editingChannel, apiPublicKey: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-fg-secondary block mb-1 font-medium">私钥 (Secret Key)</label>
                <input
                  type="text"
                  value={editingChannel.apiSecretKey}
                  onChange={(e) =>
                    setEditingChannel({ ...editingChannel, apiSecretKey: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-fg-secondary block mb-1 font-medium">Webhook 签名密钥 (Signing Secret)</label>
                <input
                  type="text"
                  value={editingChannel.webhookSecret}
                  onChange={(e) =>
                    setEditingChannel({ ...editingChannel, webhookSecret: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-fg-secondary block mb-1 font-medium">费率说明</label>
                  <input
                    type="text"
                    value={editingChannel.feeRateText}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, feeRateText: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg"
                  />
                </div>
                <div>
                  <label className="text-fg-secondary block mb-1 font-medium">路由优先级 (越小越优先)</label>
                  <input
                    type="number"
                    value={editingChannel.routingPriority}
                    onChange={(e) =>
                      setEditingChannel({
                        ...editingChannel,
                        routingPriority: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg"
                  />
                </div>
              </div>

            </form>
        )}
      </SideSheet>

      {/* Test Transaction Sandbox SideSheet (右侧滑入) */}
      <SideSheet
        id="side-sheet-test-tx"
        isOpen={isTestTxModalOpen}
        onClose={() => {
          setIsTestTxModalOpen(false);
          setLastExecutedTxResult(null);
        }}
        title="海外支付渠道沙箱测试 (Payment Gateway Live Test)"
        description="实时模拟全球网关握手、3D-Secure 协议核身与风控拦截，测试结果将直接入账至交易流水中"
        icon={<Sparkles className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {lastExecutedTxResult ? (
                <button
                  type="button"
                  onClick={() => setLastExecutedTxResult(null)}
                  className="px-3 py-1.5 border border-line text-fg-secondary rounded-xl font-medium hover:bg-subtle text-xs transition-colors cursor-pointer"
                >
                  ← 重新配置测试参数
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsTestTxModalOpen(false);
                    setLastExecutedTxResult(null);
                  }}
                  className="px-3 py-1.5 border border-line text-fg-secondary rounded-xl font-medium hover:bg-subtle text-xs transition-colors cursor-pointer"
                >
                  取消
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {lastExecutedTxResult ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTestTxModalOpen(false);
                      setLastExecutedTxResult(null);
                    }}
                    className="px-3 py-1.5 border border-line text-fg-secondary rounded-xl font-medium hover:bg-subtle text-xs transition-colors cursor-pointer"
                  >
                    完成并退出
                  </button>
                  {onNavigateToTransactions && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsTestTxModalOpen(false);
                        setLastExecutedTxResult(null);
                        onNavigateToTransactions();
                      }}
                      className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-semibold flex items-center gap-1.5 text-xs shadow-card transition-colors cursor-pointer"
                    >
                      <span>在交易流水中查看此记录</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  disabled={isExecutingTxTest}
                  onClick={handleExecuteTestTransaction}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center gap-1.5 text-xs shadow-card transition-colors cursor-pointer"
                >
                  {isExecutingTxTest ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>网关握手与扣款中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>立即执行模拟交易测试</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        }
      >
        {isTestTxModalOpen && (
          /* Test Configuration / Result Body */
          <div className="py-1 text-xs space-y-4 pr-1">
              {lastExecutedTxResult ? (
                /* Test Execution Result Card */
                <div className="space-y-4 animate-in fade-in">
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2 ${
                      lastExecutedTxResult.success
                        ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                        : "bg-amber-50/80 border-amber-200 text-amber-900"
                    }`}
                  >
                    {lastExecutedTxResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="font-bold text-sm">
                        {lastExecutedTxResult.success ? "网关握手与扣款成功！" : "网关风控/银行拦截触发成功！"}
                      </div>
                      <div className="text-xs mt-1 leading-relaxed">
                        {lastExecutedTxResult.message}
                      </div>
                    </div>
                  </div>

                  {/* Transaction Details Overview */}
                  <div className="bg-subtle border border-line rounded-xl p-3 space-y-3">
                    <div className="font-bold text-fg text-xs border-b border-line/80 pb-2 flex items-center justify-between">
                      <span>已生成的对账单详情</span>
                      <span className="font-mono text-fg-secondary font-normal">
                        单号: {lastExecutedTxResult.tx.id}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-fg-tertiary block text-[11px]">支付渠道</span>
                        <span className="font-semibold text-fg uppercase font-mono">
                          {lastExecutedTxResult.tx.channel}
                        </span>
                      </div>
                      <div>
                        <span className="text-fg-tertiary block text-[11px]">扣款金额</span>
                        <span className="font-bold text-fg font-mono">
                          {lastExecutedTxResult.tx.currency} {lastExecutedTxResult.tx.orderAmount}
                        </span>
                      </div>
                      <div>
                        <span className="text-fg-tertiary block text-[11px]">网关单号</span>
                        <span className="font-mono text-fg-secondary truncate block">
                          {lastExecutedTxResult.tx.channelTradeNo}
                        </span>
                      </div>
                      <div>
                        <span className="text-fg-tertiary block text-[11px]">对账状态</span>
                        <span
                          className={`font-semibold ${
                            lastExecutedTxResult.tx.status === "done"
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }`}
                        >
                          {lastExecutedTxResult.tx.status === "done" ? "已平账 (Done)" : "异常待核 (Discrepancy)"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-line/60 text-[11px] text-fg-secondary flex items-center justify-between">
                      <span>
                        支付方式: <strong>{lastExecutedTxResult.tx.paymentMethod}</strong>
                      </span>
                      <span>
                        风控评分:{" "}
                        <strong
                          className={
                            (lastExecutedTxResult.tx.riskScore || 0) > 50
                              ? "text-rose-600 font-mono"
                              : "text-emerald-600 font-mono"
                          }
                        >
                          {lastExecutedTxResult.tx.riskScore} / 100
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Raw API Response Payload */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-fg-secondary">
                      <span className="font-semibold text-xs">
                        海外收单网关实时 JSON 响应报文 (Gateway Response):
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(lastExecutedTxResult.rawJson);
                          setCopiedKey("test_tx_json");
                          setTimeout(() => setCopiedKey(null), 2000);
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                      >
                        {copiedKey === "test_tx_json" ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" /> 已复制报文
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> 复制报文
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-primary text-primary-foreground p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed border border-line">
                      {lastExecutedTxResult.rawJson}
                    </pre>
                  </div>
                </div>
              ) : (
                /* Test Configuration Inputs */
                <div className="space-y-4">
                  {/* Channel & App Selection */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold text-xs">
                        测试收单渠道 (Channel Gateway) <span className="text-rose-500">*</span>:
                      </label>
                      <ShadcnSelect
                        value={selectedTestChannel?.id || channelList[0]?.id || ""}
                        onValueChange={(val) => {
                          const found = channelList.find((c) => c.id === val);
                          if (found) setSelectedTestChannel(found);
                        }}
                        options={channelList.map((ch) => ({
                          value: ch.id,
                          label: `${ch.name} (${ch.channelKey.toUpperCase()} - ${ch.mode})`,
                        }))}
                        placeholder="选择测试渠道"
                      />
                    </div>

                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold text-xs">
                        关联出海业务应用 (Client App):
                      </label>
                      <ShadcnSelect
                        value={testAppName}
                        onValueChange={setTestAppName}
                        options={[
                          { value: "Novas AI Copilot (出海AI助手)", label: "Novas AI Copilot (出海AI助手)" },
                          { value: "Global VPN Shield Pro", label: "Global VPN Shield Pro (隐私工具)" },
                          { value: "PixelMagic Studio 创意设计套件", label: "PixelMagic Studio 创意设计套件" },
                          { value: "Nordic Living 出海独立站品牌店", label: "Nordic Living 出海独立站品牌店" },
                        ]}
                        placeholder="选择业务应用"
                      />
                    </div>
                  </div>

                  {/* Currency & Amount */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold text-xs">
                        交易结算货币:
                      </label>
                      <ShadcnSelect
                        value={testCurrency}
                        onValueChange={setTestCurrency}
                        options={[
                          { value: "USD", label: "USD ($ 美元)" },
                          { value: "EUR", label: "EUR (€ 欧元)" },
                          { value: "GBP", label: "GBP (£ 英镑)" },
                          { value: "JPY", label: "JPY (¥ 日元)" },
                          { value: "CAD", label: "CAD (C$ 加元)" },
                          { value: "AUD", label: "AUD (A$ 澳元)" },
                        ]}
                        placeholder="选择结算货币"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-fg-secondary block mb-1 font-semibold text-xs">
                        模拟扣款金额 (Amount):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={testAmount}
                          onChange={(e) => setTestAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg text-xs font-mono font-bold pl-8"
                          placeholder="49.00"
                        />
                        <span className="absolute left-2.5 top-2 text-fg-tertiary font-mono text-xs">
                          {testCurrency === "USD" || testCurrency === "CAD" || testCurrency === "AUD"
                            ? "$"
                            : testCurrency === "EUR"
                            ? "€"
                            : testCurrency === "GBP"
                            ? "£"
                            : "¥"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Test Scenarios */}
                  <div>
                    <label className="text-fg-secondary block mb-1.5 font-semibold text-xs">
                      选择沙箱测试场景 (Simulation Scenario):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        {
                          id: "SUCCESS",
                          title: "正常收单扣款成功",
                          desc: "模拟 Visa 4242 测试卡，无阻力扣款成功并完成入账结算",
                          badge: "200 OK",
                          badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
                        },
                        {
                          id: "3DS",
                          title: "3D-Secure 强身份核身挑战",
                          desc: "模拟 PSD2 / SCA 强认证，自动调用 3DS 2.2 协议完成核身",
                          badge: "3DS Verified",
                          badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
                        },
                        {
                          id: "FRAUD",
                          title: "Stripe Radar 欺诈风控拦截",
                          desc: "模拟异地可疑卡号，Radar 评分超过阈值强制 Reject",
                          badge: "Risk Score: 88",
                          badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
                        },
                        {
                          id: "INSUFFICIENT_FUNDS",
                          title: "发卡行余额不足拒付",
                          desc: "模拟发卡行响应 Decline Code 51，触发后续 Dunning 催付流程",
                          badge: "Decline 51",
                          badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
                        },
                      ].map((sc) => {
                        const isSelected = testScenario === sc.id;
                        return (
                          <div
                            key={sc.id}
                            onClick={() => setTestScenario(sc.id as any)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? "bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200"
                                : "bg-surface border-line hover:border-line"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-fg">{sc.title}</span>
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${sc.badgeColor}`}
                              >
                                {sc.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-fg-secondary leading-relaxed">{sc.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Latency & Encryption Notice */}
                  <div className="p-3 bg-subtle border border-line rounded-xl text-fg-secondary text-[11px] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      测试请求通过双向 TLS 1.3 链路与海外网关沙箱通信，包含卡组织授权、多币种动态折算及自动对账入库全流程。
                    </span>
                  </div>
                </div>
              )}
            </div>
        )}
      </SideSheet>

      {/* 接入新渠道 SideSheet（需求9：从字典选渠道 + 填写账号信息） */}
      <SideSheet
        isOpen={isAddChannelOpen}
        onClose={() => setIsAddChannelOpen(false)}
        title="接入新支付渠道"
        description="从字典「支付渠道」选择一个渠道，再填写该渠道的账号信息；每个账号生成一张渠道配置卡片"
        icon={<Plus className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl"
      >
        <div className="space-y-4 text-xs">
          {/* 上部：选择渠道（来自字典"支付渠道"分类） */}
          <div>
            <label className="font-semibold text-fg block mb-1.5">选择渠道 *</label>
            <ShadcnSelect
              value={formChannelKey}
              onValueChange={setFormChannelKey}
              placeholder="选择要接入的渠道…"
              options={dictChannelEntries.map((e) => {
                const name = (e.translations?.["zh-CN"] || e.translations?.["en-US"] || e.key) as string;
                const integrated = channelList.some((c) => c.channelKey === (e.key.match(/^channel\.(.+)\.name$/)?.[1]));
                return { value: e.key, label: integrated ? `${name}（已接入）` : name };
              })}
            />
            <div className="text-[10px] text-fg-tertiary mt-1.5">
              候选渠道来自字典「支付渠道」分类（共 {dictChannelEntries.length} 个）
            </div>
          </div>

          {/* 下部：账号信息表单 */}
          <div>
            <label className="font-semibold text-fg block mb-1.5">账号名称</label>
            <input
              value={formAccountName}
              onChange={(e) => setFormAccountName(e.target.value)}
              placeholder="如：Stripe 主账号"
              className="w-full p-2 bg-input border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-fg block mb-1.5">商户号 / API Key</label>
              <input
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="pk_live_..."
                className="w-full p-2 bg-input border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold text-fg block mb-1.5">运行模式</label>
              <ShadcnSelect
                value={formMode}
                onValueChange={(v) => setFormMode(v as "live" | "test")}
                options={[
                  { value: "live", label: "live（生产）" },
                  { value: "test", label: "test（沙箱）" },
                ]}
              />
            </div>
          </div>
          <div>
            <label className="font-semibold text-fg block mb-1.5">API Secret</label>
            <input
              value={formApiSecret}
              onChange={(e) => setFormApiSecret(e.target.value)}
              placeholder="sk_live_..."
              className="w-full p-2 bg-input border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="font-semibold text-fg block mb-1.5">Webhook Secret</label>
            <input
              value={formWebhookSecret}
              onChange={(e) => setFormWebhookSecret(e.target.value)}
              placeholder="whsec_..."
              className="w-full p-2 bg-input border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-fg block mb-1.5">支持币种（逗号分隔）</label>
              <input
                value={formCurrencies}
                onChange={(e) => setFormCurrencies(e.target.value)}
                placeholder="USD,EUR,GBP"
                className="w-full p-2 bg-input border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold text-fg block mb-1.5">费率说明</label>
              <input
                value={formFeeRate}
                onChange={(e) => setFormFeeRate(e.target.value)}
                placeholder="如 2.9% + $0.30"
                className="w-full p-2 bg-input border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-line">
            <button
              type="button"
              onClick={() => setIsAddChannelOpen(false)}
              className="px-3 py-2 border border-line hover:bg-hover rounded-xl font-semibold text-fg cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              disabled={!formChannelKey}
              onClick={handleConfirmNewChannel}
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-semibold shadow-card cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              确认接入
            </button>
          </div>
        </div>
      </SideSheet>

      {/* 应用详情 + 渠道绑定 SideSheet（需求4） */}
      <SideSheet
        isOpen={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title={selectedApp ? `应用：${selectedApp.name}` : ""}
        description={selectedApp ? `Code: ${selectedApp.code} · ${selectedApp.environment === "Production" ? "生产环境" : "测试环境"}` : ""}
        icon={<Layers className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl"
      >
        {selectedApp && (
          <div className="space-y-4 text-xs">
            {/* 应用详情 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-subtle rounded-xl border border-line-subtle">
                <div className="text-[10px] text-fg-tertiary">应用状态</div>
                <div className={`font-bold mt-0.5 ${selectedApp.status === "ACTIVE" ? "text-emerald-600" : "text-amber-600"}`}>
                  {selectedApp.status === "ACTIVE" ? "● 已启用 (Active)" : "● 已暂停 (Paused)"}
                </div>
              </div>
              <div className="p-3 bg-subtle rounded-xl border border-line-subtle">
                <div className="text-[10px] text-fg-tertiary">默认结算币种</div>
                <div className="font-bold mt-0.5 font-mono">{selectedApp.defaultCurrency}</div>
              </div>
            </div>

            {/* 绑定渠道列表 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-fg">该应用绑定的支付渠道</div>
                <div className="text-[10px] text-fg-tertiary">
                  已绑定 {(selectedApp.enabledChannels || []).length} / {channelList.length}
                </div>
              </div>
              <div className="space-y-1.5">
                {channelList.map((ch) => {
                  const bound = (selectedApp.enabledChannels || []).includes(ch.channelKey as any);
                  return (
                    <div
                      key={ch.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border ${
                        bound ? "bg-surface border-line" : "bg-subtle/50 border-line-subtle opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-hover flex items-center justify-center font-bold text-[10px] font-mono uppercase border border-line-subtle shrink-0">
                          {ch.channelKey.slice(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <div className={`font-semibold truncate ${bound ? "text-fg" : "text-fg-tertiary"}`}>{ch.name}</div>
                          <div className="text-[10px] text-fg-tertiary font-mono">{ch.channelKey}</div>
                        </div>
                      </div>
                      {bound ? (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium shrink-0">
                          已绑定
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-hover text-fg-tertiary border border-line-subtle rounded text-[10px] font-medium shrink-0">
                          未绑定
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {appSheetRelatedChannel && (
              <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-[11px]">
                您正从渠道「{appSheetRelatedChannel.name}」打开此应用详情。
              </div>
            )}
          </div>
        )}
      </SideSheet>
    </div>
  );
};
