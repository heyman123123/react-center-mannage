import React, { useState } from "react";
import {
  Sparkles,
  Receipt,
  Building,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import {
  Tenant,
  SystemUser,
  TransactionRecord,
  PaymentChannel,
  TenantId,
  ReconciliationStatus,
} from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";

interface QuickCreateModalProps {
  tenants: Tenant[];
  currentTenant: Tenant;
  currentUser: SystemUser;
  onClose: () => void;
  onCreateTransaction: (newTx: TransactionRecord) => void;
}

export const QuickCreateModal: React.FC<QuickCreateModalProps> = ({
  tenants,
  currentTenant,
  currentUser,
  onClose,
  onCreateTransaction,
}) => {
  const [selectedTenantId, setSelectedTenantId] = useState<TenantId>(
    currentTenant.id === "group_hq" ? "bu_na_ecom" : currentTenant.id
  );
  const [orderTitle, setOrderTitle] = useState<string>(
    "Novas AI Pro 海外年度订阅 - " + new Date().toLocaleTimeString()
  );
  const [merchantName, setMerchantName] = useState<string>("Novas SaaS Global Inc.");
  const [channel, setChannel] = useState<PaymentChannel>("stripe");
  const [amount, setAmount] = useState<number>(199.0);
  const [status, setStatus] = useState<ReconciliationStatus>("in_process");
  const [paymentMethod, setPaymentMethod] = useState<string>("Visa Credit (*4242)");

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) || currentTenant;
  const currency = selectedTenant.currency || "USD";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
    const fee = Number((amount * 0.029 + 0.3).toFixed(2));

    const newTx: TransactionRecord = {
      id: `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomSuffix}`,
      tenantId: selectedTenantId,
      orderTitle: orderTitle.trim() || "海外收单流水",
      merchantName: merchantName.trim() || "Novas Overseas Merchant",
      channel,
      channelTradeNo: `ch_live_${Math.random().toString(36).substring(2, 14)}`,
      orderAmount: Number(amount) || 100,
      channelFee: fee,
      settleAmount: Number((amount - fee).toFixed(2)),
      currency,
      createdAt: nowStr,
      status,
      reviewer: {
        name: currentUser.name,
        role: "出海运营员",
      },
      targetQuotaRatio: Math.min(50, Math.max(5, Math.round(amount / 50))),
      limitRatio: Math.min(30, Math.max(2, Math.round(amount / 150))),
      paymentMethod,
      flowSteps: [
        {
          stepId: "step_checkout",
          stepName: "下游 Client 调起收银台 Checkout",
          timestamp: nowStr,
          status: "SUCCESS",
          details: `客户端会话创建，结算币种 ${currency}，实付 ${amount}`,
        },
        {
          stepId: "step_fraud",
          stepName: "Stripe Radar / 海外风控引擎扫描",
          timestamp: nowStr,
          status: "SUCCESS",
          details: "IP 属地与银行卡发卡行一致，无欺诈风险",
        },
        {
          stepId: "step_gateway_auth",
          stepName: `向海外网关 (${channel.toUpperCase()}) 提交授权与扣款`,
          timestamp: nowStr,
          status: status === "discrepancy" ? "FAILED" : "SUCCESS",
          details:
            status === "discrepancy"
              ? "收单网关返回扣款成功，但下游订单系统未及时确认回调"
              : "网关扣款成功，凭证签名校验通过",
        },
      ],
    };

    if (status === "discrepancy") {
      newTx.discrepancyType = "amount_mismatch";
      newTx.discrepancyNote = "模拟注入差错：海外网关扣款成功，但下游 SaaS 回调应收金额与网关存在尾差";
    }

    onCreateTransaction(newTx);
    onClose();
  };

  const channelOptions = [
    { value: "stripe", label: "Stripe (国际信用卡 / Apple Pay)" },
    { value: "paypal", label: "PayPal (全球数字钱包)" },
    { value: "adyen", label: "Adyen (欧洲本地清算 / 全渠道)" },
    { value: "apple_pay", label: "Apple Pay / Google Pay" },
    { value: "klarna", label: "Klarna (欧洲先买后付 BNPL)" },
    { value: "sepa", label: "SEPA (泛欧银行直接借记)" },
  ];

  return (
    <SideSheet
      id="side-sheet-quick-create"
      isOpen={true}
      onClose={onClose}
      title="模拟录入海外交易流水"
      description="快速生成一笔出海多币种流水并注入对账与清算管道中。"
      icon={<Sparkles className="w-5 h-5 text-amber-500" />}
      widthClass="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-line text-fg-secondary rounded-xl hover:bg-hover font-semibold cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-semibold shadow-card cursor-pointer"
          >
            确认生成海外流水
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Title */}
        <div>
          <label className="font-semibold text-fg-secondary block mb-1">
            海外订单标题 / 订阅服务描述:
          </label>
          <input
            type="text"
            required
            value={orderTitle}
            onChange={(e) => setOrderTitle(e.target.value)}
            className="w-full p-2 bg-subtle border border-line rounded-lg text-xs focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Merchant */}
        <div>
          <label className="font-semibold text-fg-secondary block mb-1">
            签约主体商户名:
          </label>
          <input
            type="text"
            required
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            className="w-full p-2 bg-subtle border border-line rounded-lg text-xs focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Channel & Amount Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-semibold text-fg-secondary block mb-1">
              海外支付通道 (Gateway):
            </label>
            <ShadcnSelect
              value={channel}
              onValueChange={(val) => setChannel(val as PaymentChannel)}
              options={channelOptions}
            />
          </div>

          <div>
            <label className="font-semibold text-fg-secondary block mb-1">
              交易金额 ({currency}):
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono font-bold focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Initial Status */}
        <div>
          <label className="font-semibold text-fg-secondary block mb-1.5">
            初始平账状态:
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setStatus("in_process")}
              className={`p-2 border rounded-xl text-center transition-colors cursor-pointer ${
                status === "in_process"
                  ? "bg-primary text-primary-foreground font-semibold border-primary shadow-2xs"
                  : "bg-subtle text-fg-secondary border-line hover:bg-hover"
              }`}
            >
              清算中
            </button>
            <button
              type="button"
              onClick={() => setStatus("done")}
              className={`p-2 border rounded-xl text-center transition-colors cursor-pointer ${
                status === "done"
                  ? "bg-primary text-primary-foreground font-semibold border-primary shadow-2xs"
                  : "bg-subtle text-fg-secondary border-line hover:bg-hover"
              }`}
            >
              已平账
            </button>
            <button
              type="button"
              onClick={() => setStatus("discrepancy")}
              className={`p-2 border rounded-xl text-center transition-colors cursor-pointer ${
                status === "discrepancy"
                  ? "bg-rose-600 text-white font-semibold border-rose-600 shadow-2xs"
                  : "bg-subtle text-rose-600 border-line hover:bg-rose-50"
              }`}
            >
              注入差错
            </button>
          </div>
        </div>
      </form>
    </SideSheet>
  );
};
