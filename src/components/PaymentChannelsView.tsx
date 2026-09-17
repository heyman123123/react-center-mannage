import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as channelsApi from "../api/modules/channels";
import * as iamApi from "../api/modules/iam";
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
import { PaymentChannelConfig, PaymentChannel, TransactionRecord, PaymentApp, DictionaryEntry, Tenant, SystemUser } from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { formatUnix } from "../lib/time";

interface PaymentChannelsViewProps {
  currentTenant?: Tenant;
  currentUser?: SystemUser;
  /** 可选：壳层已加载的字典；页面仍会按 namespace=channel 主动拉取兜底 */
  dictionary?: DictionaryEntry[];
}

export const PaymentChannelsView: React.FC<PaymentChannelsViewProps> = ({
  dictionary: dictionaryProp,
}) => {
  const { t } = useTranslation(["channels", "payments", "common"]);
  const testScenarios = useMemo(
    () =>
      (["SUCCESS", "3DS", "FRAUD", "INSUFFICIENT_FUNDS"] as const).map((id) => ({
        id,
        title: t(`payment.testTx.scenarios.${id}.title`),
        desc: t(`payment.testTx.scenarios.${id}.desc`),
        badge: id === "SUCCESS" ? "200 OK" : id === "3DS" ? "3DS Verified" : id === "FRAUD" ? "Risk Score: 88" : "Decline 51",
        badgeColor:
          id === "SUCCESS"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : id === "3DS"
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : id === "FRAUD"
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : "bg-amber-50 text-amber-700 border-amber-200",
      })),
    [t]
  );
  const [channelList, setChannelList] = useState<PaymentChannelConfig[]>([]);
  const [apps] = useState<PaymentApp[]>([]);
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>(dictionaryProp || []);
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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
  const [formMode, setFormMode] = useState("live");
  const [formCurrencies, setFormCurrencies] = useState("USD,EUR,GBP");
  const [formFeeRate, setFormFeeRate] = useState("");

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
  const [testProductId, setTestProductId] = useState("");
  const [testCustomerEmail, setTestCustomerEmail] = useState("");
  const [isExecutingTxTest, setIsExecutingTxTest] = useState(false);
  const [lastExecutedTxResult, setLastExecutedTxResult] = useState<{
    tx: TransactionRecord;
    rawJson: string;
    success: boolean;
    message: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadChannels = useCallback(async () => {
    try {
      const list = await channelsApi.listPaymentChannels(
        modeFilter === "all" ? undefined : { mode: modeFilter }
      );
      setChannelList(list);
    } catch {
      showToast(t("payment.toast.loadFailed"));
    }
  }, [modeFilter, t]);

  const loadChannelDictionary = useCallback(async () => {
    try {
      const page = await iamApi.listDictionaryEntries({
        namespace: "channel",
        page: 1,
        pageSize: 100,
      });
      const mapped: DictionaryEntry[] = (page.list || []).map((d) => ({
        id: d.id,
        key: d.key || d.entryKey,
        category: (d.category?.toUpperCase() as DictionaryEntry["category"]) || "PAYMENT_CHANNEL",
        categoryId: d.categoryId || undefined,
        description: d.description || d.label || "",
        referencedTemplatesCount: 0,
        translations: {
          "zh-CN": d.translations?.["zh-CN"] || d.label || "",
          "en-US": d.translations?.["en-US"] || "",
        } as DictionaryEntry["translations"],
        updatedAt: formatUnix(d.createdAt),
      }));
      if (mapped.length > 0) {
        setDictionary(mapped);
        return;
      }
      // 兜底：壳层字典里筛 PAYMENT_CHANNEL
      if (dictionaryProp?.length) {
        setDictionary(dictionaryProp.filter((d) => d.category === "PAYMENT_CHANNEL"));
      }
    } catch {
      if (dictionaryProp?.length) {
        setDictionary(dictionaryProp.filter((d) => d.category === "PAYMENT_CHANNEL"));
      }
    }
  }, [dictionaryProp]);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    void loadChannelDictionary();
  }, [loadChannelDictionary]);

  // 字典中"支付渠道"分类的候选渠道词条
  const dictChannelEntries = dictionary.filter((d) => d.category === "PAYMENT_CHANNEL");

  const toggleShowSecret = (id: string) => {
    setShowSecretMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestConnection = async (channel: PaymentChannelConfig) => {
    setTestingId(channel.id);
    setTestResult(null);
    try {
      const updated = await channelsApi.testPaymentChannel(channel.id);
      setChannelList((prev) => prev.map((c) => (c.id === channel.id ? updated : c)));
      setTestResult({
        id: channel.id,
        msg: t("payment.toast.testSuccess", { latency: updated.latencyMs }),
        success: updated.testStatus === "HEALTHY",
      });
      setTimeout(() => setTestResult(null), 5000);
    } catch {
      showToast(t("payment.toast.testFailed"));
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleEnabled = (channel: PaymentChannelConfig) => {
    const updated = { ...channel, enabled: !channel.enabled };
    setChannelList((prev) => prev.map((c) => (c.id === channel.id ? updated : c)));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel) return;
    try {
      const saved = await channelsApi.updatePaymentChannel(editingChannel.id, {
            name: editingChannel.name,
            accountName: editingChannel.accountName,
            description: editingChannel.description,
            mode: editingChannel.mode,
            enabled: editingChannel.enabled,
            apiSecretKey: editingChannel.apiSecretKey,
            webhookSecret: editingChannel.webhookSecret,
            supportedCurrencies: editingChannel.supportedCurrencies,
            feeRateText: editingChannel.feeRateText,
            routingPriority: editingChannel.routingPriority,
          });
      setChannelList((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      setEditingChannel(null);
    } catch {
      showToast(t("payment.toast.saveFailed"));
    }
  };

  // 接入新渠道：从渠道池批量创建并同步父级 App 的 paymentChannels
  const handleConfirmNewChannel = async () => {
    if (!formChannelKey) {
      showToast(t("payment.selectChannelFirst"));
      return;
    }
    const entry = dictChannelEntries.find((e) => e.key === formChannelKey);
    const slug = (formChannelKey.match(/^channel\.(.+)\.name$/)?.[1]) || formChannelKey;
    const channelName = (entry?.translations?.["zh-CN"] || entry?.translations?.["en-US"] || entry?.key || slug) as string;
    const displayName = formAccountName.trim()
      ? `${channelName} · ${formAccountName.trim()}`
      : channelName;

    if (slug === "creem" && !formApiSecret.trim()) {
      showToast(t("payment.toast.fillRequired"));
      return;
    }

    try {
      const newChannel: PaymentChannelConfig = await channelsApi.createPaymentChannel({
            channelKey: slug as PaymentChannelConfig["channelKey"],
            name: displayName,
            accountName: formAccountName.trim() || undefined,
            description: entry?.description || channelName,
            mode: formMode,
            apiSecretKey: formApiSecret.trim(),
            webhookSecret: formWebhookSecret.trim(),
            supportedCurrencies: formCurrencies.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
            feeRateText: formFeeRate.trim() || "—",
            routingPriority: channelList.length + 1,
          });

      setChannelList((prev) => [...prev, newChannel]);
      setIsAddChannelOpen(false);
      showToast(t("payment.toast.added", { name: newChannel.name }));
      setFormChannelKey("");
      setFormAccountName("");
      setFormApiKey("");
      setFormApiSecret("");
      setFormWebhookSecret("");
      setFormCurrencies("USD,EUR,GBP");
      setFormFeeRate("");
    } catch {
      showToast(t("payment.toast.saveFailed"));
    }
  };

  // 打开应用详情 SideSheet
  const openAppSheet = (app: PaymentApp, channel?: PaymentChannelConfig) => {
    setSelectedApp(app);
    setAppSheetRelatedChannel(channel || null);
  };

  const handleExecuteTestTransaction = async () => {
    const channel = selectedTestChannel || channelList[0];
    if (!channel) return;

    if (channel.channelKey === "creem") {
      if (!testProductId.trim()) {
        showToast(t("payments:checkoutTest.productRequired"));
        return;
      }
      setIsExecutingTxTest(true);
      setLastExecutedTxResult(null);
      try {
        const result = await channelsApi.createCheckoutTest(channel.id, {
          productId: testProductId.trim(),
          customerEmail: testCustomerEmail.trim() || undefined,
        });
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        showToast(t("payments:checkoutTest.success"));
        const now = new Date();
        const timeString = now.toISOString().replace("T", " ").substring(0, 19);
        setLastExecutedTxResult({
          tx: {
            id: result.sessionId,
            tenantId: channel.tenantId || "group_hq",
            channel: "creem",
            orderTitle: t("payment.testTx.sandboxPrefix") + " Creem Checkout",
            orderNumber: result.sessionId,
            orderAmount: parseFloat(testAmount) || 0,
            channelFee: 0,
            currency: testCurrency,
            createdAt: timeString,
            status: "pending_check",
            customerEmail: testCustomerEmail || undefined,
            merchantName: channel.name,
            paymentMethod: "Creem Checkout",
            channelTradeNo: result.sessionId,
            timeline: [],
          },
          rawJson: JSON.stringify(result, null, 2),
          success: true,
          message: t("payments:checkoutTest.success"),
        });
      } catch {
        showToast(t("payments:checkoutTest.failed"));
      } finally {
        setIsExecutingTxTest(false);
      }
      return;
    }

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
        discrepancyNote = t("payment.testTx.discrepancy.fraud");
        failureReason = "RADAR_RISK_RULE_BLOCKED: Score 88 > Threshold 75";
      } else if (testScenario === "INSUFFICIENT_FUNDS") {
        reconStatus = "discrepancy";
        discrepancyType = "amount_mismatch" as any;
        discrepancyNote = t("payment.testTx.discrepancy.insufficientFunds");
        failureReason = "DECLINED_CODE_51: Insufficient Funds";
      }

      const newTx: TransactionRecord = {
        id: `TX-TEST-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}-${Math.floor(
          100000 + Math.random() * 900000
        )}`,
        tenantId: "bu_na_ecom",
        channel: channel.channelKey as PaymentChannel,
        orderTitle: `${t("payment.testTx.sandboxPrefix")} ${testAppName} - ${
          testScenario === "3DS" ? t("payment.testTx.orderTitle3ds") : t("payment.testTx.orderTitleOnline")
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
            title: t("payment.testTx.timeline.step1Title"),
            description: t("payment.testTx.timeline.step1Desc", { app: testAppName, amount: parsedAmount, currency: testCurrency }),
            timestamp: timeString,
            status: "completed",
            actor: testAppName,
          },
          {
            id: "step_2",
            title: t("payment.testTx.timeline.step2Title", { channel: channel.name }),
            description: t("payment.testTx.timeline.step2Desc", { latency: simulatedLatency }),
            timestamp: timeString,
            status: "completed",
            actor: channel.name,
            latencyMs: simulatedLatency,
          },
          {
            id: "step_3",
            title: testScenario === "3DS" ? t("payment.testTx.timeline.step3Title3ds") : t("payment.testTx.timeline.step3TitleAuth"),
            description:
              testScenario === "3DS"
                ? t("payment.testTx.timeline.step3Desc3ds")
                : isSuccessScenario
                ? t("payment.testTx.timeline.step3DescSuccess")
                : failureReason,
            timestamp: timeString,
            status: isSuccessScenario ? "completed" : "failed",
            actor: "Global Card Network / Issuer",
          },
          {
            id: "step_4",
            title: t("payment.testTx.timeline.step4Title"),
            description: isSuccessScenario
              ? t("payment.testTx.timeline.step4DescSuccess")
              : t("payment.testTx.timeline.step4DescFailed"),
            timestamp: timeString,
            status: isSuccessScenario ? "completed" : "failed",
            actor: t("payment.testTx.timeline.actor"),
          },
        ],
      };

      const updatedChannel = {
        ...channel,
        lastTestedAt: timeString,
        latencyMs: simulatedLatency,
      };
      setChannelList((prev) => prev.map((c) => (c.id === channel.id ? updatedChannel : c)));

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
          ? t("payment.testTx.execSuccess", { gatewayNo: gatewayTradeNo, latency: simulatedLatency })
          : t("payment.testTx.execBlocked", { reason: failureReason }),
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
              {t("payment.title")}
            </h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            {t("payment.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <ShadcnSelect
            value={modeFilter}
            onValueChange={setModeFilter}
            options={[
              { value: "all", label: t("payment.modeAll") },
              { value: "live", label: t("payment.modeLive") },
              { value: "sandbox", label: t("payment.modeSandbox") },
            ]}
            placeholder={t("payment.modeFilter")}
            className="w-[140px]"
          />
          <button
            onClick={() => setIsAddChannelOpen(true)}
            className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-card transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("payment.addChannel")}</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between animate-in fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="font-bold">✕</button>
        </div>
      )}

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
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-hover text-fg-secondary">
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
                    title={channel.enabled ? t("payment.card.disableTitle") : t("payment.card.enableTitle")}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                </div>

                {/* Key Configuration Parameters */}
                <div className="bg-subtle rounded-xl p-3 border border-line-subtle space-y-2.5 text-xs font-mono">
                  {/* Public Key */}
                  <div>
                    <span className="text-[10px] text-fg-tertiary block font-sans">
                      {t("payment.card.publicKey")}
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
                        {t("payment.card.secretKey")}
                      </span>
                      <button
                        onClick={() => toggleShowSecret(channel.id)}
                        className="text-fg-tertiary hover:text-fg-secondary text-[10px] flex items-center gap-1 font-sans"
                      >
                        {isSecretVisible ? (
                          <>
                            <EyeOff className="w-3 h-3" /> {t("payment.card.hide")}
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" /> {t("payment.card.show")}
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
                      <span className="text-[9px] text-rose-400 font-sans ml-2 shrink-0" title={t("payment.copyForbiddenTitle")}>
                        {t("payment.copyForbidden")}
                      </span>
                    </div>
                  </div>

                  {/* Webhook Secret */}
                  <div className="pt-2 border-t border-line/60">
                    <span className="text-[10px] text-fg-tertiary block font-sans">
                      {t("payment.card.webhookSecret")}
                    </span>
                    <div className="flex items-center justify-between text-fg-secondary mt-0.5">
                      <span className="truncate max-w-[280px]">
                        {isSecretVisible
                          ? channel.webhookSecret
                          : "whsec_••••••••••••••••••••••••"}
                      </span>
                      <span className="text-[9px] text-rose-400 font-sans ml-2 shrink-0" title={t("payment.copyForbiddenTitle")}>
                        {t("payment.copyForbidden")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attributes badges */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-fg-tertiary">{t("payment.card.supportedCurrencies")}</span>
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
{t("payment.card.feeRate")} <strong className="text-fg font-mono">{channel.feeRateText}</strong>
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
{t("payment.card.relatedApps", { count: relatedApps.length })}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {shown.map((app) => (
                          <button
                            key={app.id}
                            type="button"
                            title={t("payment.card.viewAppChannels", { name: app.name })}
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
                            title={t("payment.card.viewRelatedApps")}
                            className="px-1.5 py-0.5 bg-hover text-fg-secondary hover:bg-hover rounded-md text-[10px] font-medium transition-colors cursor-pointer"
                          >
+{rest.length} {t("payment.card.more")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 pt-4 border-t border-line-subtle flex items-center justify-between text-xs">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        (channel.healthStatus || channel.testStatus) === "HEALTHY"
                          ? "bg-emerald-500"
                          : (channel.healthStatus || channel.testStatus) === "DOWN"
                          ? "bg-rose-500"
                          : "bg-amber-500"
                      }`}
                    />
                    <span className="text-fg-secondary font-mono text-[11px]">
                      {channel.latencyMs}ms • {t("payment.card.priority", { priority: channel.routingPriority })}
                    </span>
                  </div>
                  <div className="text-[10px] text-fg-tertiary">
                    {t("payment.card.healthStatus")}:{" "}
                    <span className="font-medium text-fg-secondary">
                      {(channel.healthStatus || channel.testStatus) === "HEALTHY"
                        ? t("payment.card.healthHealthy")
                        : (channel.healthStatus || channel.testStatus) === "DOWN"
                        ? t("payment.card.healthDown")
                        : t("payment.card.healthUnknown")}
                    </span>
                    {channel.lastHealthAt
                      ? ` • ${t("payment.card.lastHealthAt", { time: channel.lastHealthAt })}`
                      : null}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedTestChannel(channel);
                      setIsTestTxModalOpen(true);
                      setLastExecutedTxResult(null);
                    }}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer text-xs"
                    title={t("payment.card.testTxTitle")}
                  >
                    <Zap className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{t("payment.card.testTx")}</span>
                  </button>

                  <button
                    onClick={() => handleTestConnection(channel)}
                    disabled={isTesting}
                    className="px-2.5 py-1.5 bg-hover hover:bg-hover text-fg-secondary rounded-lg font-medium flex items-center gap-1 transition-colors text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
                    <span>{isTesting ? t("payment.card.testing") : t("payment.card.testConnection")}</span>
                  </button>
                  <button
                    onClick={() => setEditingChannel(channel)}
                    className="px-2.5 py-1.5 border border-line hover:bg-subtle text-fg-secondary rounded-lg font-medium flex items-center gap-1 transition-colors text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{t("payment.card.edit")}</span>
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
        title={editingChannel ? t("payment.editSheet.titleWithName", { name: editingChannel.name }) : t("payment.editSheet.title")}
        description={t("payment.editSheet.description")}
        icon={<CreditCard className="w-5 h-5 text-fg" />}
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
              form="form-edit-channel"
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium shadow-card cursor-pointer"
            >
              {t("common:actions.save")}
            </button>
          </>
        }
      >
        {editingChannel && (
          <form id="form-edit-channel" onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="text-fg-secondary block mb-1 font-medium">{t("payment.editSheet.displayName")}</label>
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
                <label className="text-fg-secondary block mb-1 font-medium">{t("payment.editSheet.mode")}</label>
                <input
                  type="text"
                  value={editingChannel.mode}
                  onChange={(e) =>
                    setEditingChannel({
                      ...editingChannel,
                      mode: e.target.value as PaymentChannelConfig["mode"],
                    })
                  }
                  className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg font-mono"
                />
              </div>

              <div>
                <label className="text-fg-secondary block mb-1 font-medium">{t("payment.editSheet.publishableKey")}</label>
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
                <label className="text-fg-secondary block mb-1 font-medium">{t("payment.editSheet.secretKey")}</label>
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
                <label className="text-fg-secondary block mb-1 font-medium">{t("payment.editSheet.webhookSigningSecret")}</label>
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
                  <label className="text-fg-secondary block mb-1 font-medium">{t("payment.editSheet.feeRate")}</label>
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
                  <label className="text-fg-secondary block mb-1 font-medium">{t("payment.editSheet.routingPriority")}</label>
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
        title={t("payment.testTx.title")}
        description={t("payment.testTx.description")}
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
                  {t("payment.testTx.reconfigure")}
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
                  {t("common:actions.cancel")}
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
{t("payment.testTx.finish")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTestTxModalOpen(false);
                      setLastExecutedTxResult(null);
                      window.location.hash = "#/transactions";
                    }}
                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-semibold flex items-center gap-1.5 text-xs shadow-card transition-colors cursor-pointer"
                  >
                    <span>{t("payment.testTx.viewInTransactions")}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
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
                      <span>{t("payment.testTx.processing")}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>
                        {(selectedTestChannel?.channelKey || channelList[0]?.channelKey) === "creem"
                          ? t("payments:checkoutTest.execute")
                          : t("payment.testTx.execute")}
                      </span>
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
                        {lastExecutedTxResult.success ? t("payment.testTx.successResult") : t("payment.testTx.blockedResult")}
                      </div>
                      <div className="text-xs mt-1 leading-relaxed">
                        {lastExecutedTxResult.message}
                      </div>
                    </div>
                  </div>

                  {/* Transaction Details Overview */}
                  <div className="bg-subtle border border-line rounded-xl p-3 space-y-3">
                    <div className="font-bold text-fg text-xs border-b border-line/80 pb-2 flex items-center justify-between">
                      <span>{t("payment.testTx.receiptDetail")}</span>
                      <span className="font-mono text-fg-secondary font-normal">
{t("payment.testTx.tradeNo")} {lastExecutedTxResult.tx.id}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-fg-tertiary block text-[11px]">{t("payment.testTx.channel")}</span>
                        <span className="font-semibold text-fg uppercase font-mono">
                          {lastExecutedTxResult.tx.channel}
                        </span>
                      </div>
                      <div>
                        <span className="text-fg-tertiary block text-[11px]">{t("payment.testTx.amount")}</span>
                        <span className="font-bold text-fg font-mono">
                          {lastExecutedTxResult.tx.currency} {lastExecutedTxResult.tx.orderAmount}
                        </span>
                      </div>
                      <div>
                        <span className="text-fg-tertiary block text-[11px]">{t("payment.testTx.gatewayNo")}</span>
                        <span className="font-mono text-fg-secondary truncate block">
                          {lastExecutedTxResult.tx.channelTradeNo}
                        </span>
                      </div>
                      <div>
                        <span className="text-fg-tertiary block text-[11px]">{t("payment.testTx.reconcileStatus")}</span>
                        <span
                          className={`font-semibold ${
                            lastExecutedTxResult.tx.status === "done"
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }`}
                        >
                          {lastExecutedTxResult.tx.status === "done" ? t("payment.testTx.reconcileDone") : t("payment.testTx.reconcileDiscrepancy")}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-line/60 text-[11px] text-fg-secondary flex items-center justify-between">
                      <span>
{t("payment.testTx.paymentMethod")} <strong>{lastExecutedTxResult.tx.paymentMethod}</strong>
                      </span>
                      <span>
{t("payment.testTx.riskScore")}{" "}
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
{t("payment.testTx.gatewayResponse")}
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
                            <Check className="w-3 h-3 text-emerald-600" /> {t("payment.testTx.copiedJson")}
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> {t("payment.testTx.copyJson")}
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
{t("payment.testTx.channelLabel")} <span className="text-rose-500">*</span>:
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
                        placeholder={t("payment.testTx.channelPlaceholder")}
                      />
                    </div>

                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold text-xs">
{t("payment.testTx.appLabel")}
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
                        placeholder={t("payment.testTx.appPlaceholder")}
                      />
                    </div>
                  </div>

                  {(selectedTestChannel?.channelKey || channelList[0]?.channelKey) === "creem" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-fg-secondary block mb-1 font-semibold text-xs">
                          {t("payments:checkoutTest.productIdLabel")} <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={testProductId}
                          onChange={(e) => setTestProductId(e.target.value)}
                          className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg text-xs font-mono"
                          placeholder={t("payments:checkoutTest.productIdPlaceholder")}
                        />
                      </div>
                      <div>
                        <label className="text-fg-secondary block mb-1 font-semibold text-xs">
                          {t("payments:checkoutTest.customerEmailLabel")}
                        </label>
                        <input
                          type="email"
                          value={testCustomerEmail}
                          onChange={(e) => setTestCustomerEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-fg text-xs font-mono"
                          placeholder={t("payments:checkoutTest.customerEmailPlaceholder")}
                        />
                      </div>
                    </div>
                  )}

                  {/* Currency & Amount */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-fg-secondary block mb-1 font-semibold text-xs">
{t("payment.testTx.currencyLabel")}
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
                        placeholder={t("payment.testTx.currencyPlaceholder")}
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-fg-secondary block mb-1 font-semibold text-xs">
{t("payment.testTx.amountLabel")}
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

                  {/* Test Scenarios (non-Creem legacy simulation) */}
                  {(selectedTestChannel?.channelKey || channelList[0]?.channelKey) !== "creem" && (
                  <div>
                    <label className="text-fg-secondary block mb-1.5 font-semibold text-xs">
{t("payment.testTx.scenarioLabel")}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {testScenarios.map((sc) => {
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
                  )}

                  {/* Latency & Encryption Notice */}
                  <div className="p-3 bg-subtle border border-line rounded-xl text-fg-secondary text-[11px] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
{t("payment.testTx.tlsNotice")}
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
        title={t("payment.addSheet.title")}
        description={t("payment.addSheet.description")}
        icon={<Plus className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl"
      >
        <div className="space-y-4 text-xs">
          {/* 上部：选择渠道（来自字典"支付渠道"分类） */}
          <div>
            <label className="font-semibold text-fg block mb-1.5">{t("payment.addSheet.selectChannel")}</label>
            <ShadcnSelect
              value={formChannelKey}
              onValueChange={setFormChannelKey}
              placeholder={t("payment.addSheet.selectPlaceholder")}
              options={dictChannelEntries.map((e) => {
                const name = (e.translations?.["zh-CN"] || e.translations?.["en-US"] || e.key) as string;
                const integrated = channelList.some((c) => c.channelKey === (e.key.match(/^channel\.(.+)\.name$/)?.[1]));
                return { value: e.key, label: integrated ? `${name}${t("payment.addSheet.integrated")}` : name };
              })}
            />
            <div className="text-[10px] text-fg-tertiary mt-1.5">
{t("payment.addSheet.dictHint", { count: dictChannelEntries.length })}
            </div>
          </div>

          {/* 下部：账号信息表单 */}
          <div>
            <label className="font-semibold text-fg block mb-1.5">{t("payment.addSheet.accountName")}</label>
            <input
              value={formAccountName}
              onChange={(e) => setFormAccountName(e.target.value)}
              placeholder={t("payment.addSheet.accountPlaceholder")}
              className="w-full p-2 bg-subtle border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-fg block mb-1.5">{t("payment.addSheet.apiKey")}</label>
              <input
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="pk_live_..."
                className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold text-fg block mb-1.5">{t("payment.addSheet.mode")}</label>
              <input
                value={formMode}
                onChange={(e) => setFormMode(e.target.value)}
                className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="font-semibold text-fg block mb-1.5">{t("payment.addSheet.apiSecret")}</label>
            <input
              value={formApiSecret}
              onChange={(e) => setFormApiSecret(e.target.value)}
              placeholder="sk_live_..."
              className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="font-semibold text-fg block mb-1.5">{t("payment.addSheet.webhookSecret")}</label>
            <input
              value={formWebhookSecret}
              onChange={(e) => setFormWebhookSecret(e.target.value)}
              placeholder="whsec_..."
              className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-fg block mb-1.5">{t("payment.addSheet.currencies")}</label>
              <input
                value={formCurrencies}
                onChange={(e) => setFormCurrencies(e.target.value)}
                placeholder="USD,EUR,GBP"
                className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="font-semibold text-fg block mb-1.5">{t("payment.addSheet.feeRate")}</label>
              <input
                value={formFeeRate}
                onChange={(e) => setFormFeeRate(e.target.value)}
                placeholder="如 2.9% + $0.30"
                className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-line">
            <button
              type="button"
              onClick={() => setIsAddChannelOpen(false)}
              className="px-3 py-2 border border-line hover:bg-hover rounded-xl font-semibold text-fg cursor-pointer"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="button"
              disabled={!formChannelKey}
              onClick={handleConfirmNewChannel}
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-semibold shadow-card cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
{t("payment.addSheet.confirm")}
            </button>
          </div>
        </div>
      </SideSheet>

      {/* 应用详情 + 渠道绑定 SideSheet（需求4） */}
      <SideSheet
        isOpen={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title={selectedApp ? t("payment.appSheet.title", { name: selectedApp.name }) : ""}
        description={selectedApp ? `Code: ${selectedApp.code} · ${selectedApp.environment}` : ""}
        icon={<Layers className="w-5 h-5 text-fg" />}
        widthClass="max-w-xl"
      >
        {selectedApp && (
          <div className="space-y-4 text-xs">
            {/* 应用详情 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-subtle rounded-xl border border-line-subtle">
                <div className="text-[10px] text-fg-tertiary">{t("payment.appSheet.appStatus")}</div>
                <div className={`font-bold mt-0.5 ${selectedApp.status === "ACTIVE" ? "text-emerald-600" : "text-amber-600"}`}>
                  {selectedApp.status === "ACTIVE" ? t("payment.appSheet.active") : t("payment.appSheet.paused")}
                </div>
              </div>
              <div className="p-3 bg-subtle rounded-xl border border-line-subtle">
                <div className="text-[10px] text-fg-tertiary">{t("payment.appSheet.defaultCurrency")}</div>
                <div className="font-bold mt-0.5 font-mono">{selectedApp.defaultCurrency}</div>
              </div>
            </div>

            {/* 绑定渠道列表 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-fg">{t("payment.appSheet.boundChannels")}</div>
                <div className="text-[10px] text-fg-tertiary">
{t("payment.appSheet.boundCount", { bound: (selectedApp.enabledChannels || []).length, total: channelList.length })}
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
{t("payment.appSheet.bound")}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-hover text-fg-tertiary border border-line-subtle rounded text-[10px] font-medium shrink-0">
{t("payment.appSheet.unbound")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {appSheetRelatedChannel && (
              <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-[11px]">
{t("payment.appSheet.openedFrom", { name: appSheetRelatedChannel.name })}
              </div>
            )}
          </div>
        )}
      </SideSheet>
    </div>
  );
};
