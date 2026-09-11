import React, { useState } from "react";
import {
  Receipt,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Building,
  Mail,
  Send,
  Zap,
} from "lucide-react";
import { TransactionRecord, SystemUser } from "../types/payment";
import { formatCurrency } from "../lib/utils";
import { SideSheet } from "./ui/SideSheet";

interface TransactionDetailModalProps {
  transaction: TransactionRecord;
  currentUser: SystemUser;
  onClose: () => void;
  onOpenDiscrepancy?: (tx: TransactionRecord) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  currentUser,
  onClose,
  onOpenDiscrepancy,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "raw_payload" | "risk">("timeline");

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const statusBadge = () => {
    switch (transaction.status) {
      case "done":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            清算平账完成 (Done)
          </span>
        );
      case "in_process":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            网关划账中 (In Process)
          </span>
        );
      case "discrepancy":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            存在差错疑账 (Discrepancy)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
            待大额复核 (Pending)
          </span>
        );
    }
  };

  return (
    <SideSheet
      id="side-sheet-transaction-detail"
      isOpen={true}
      onClose={onClose}
      title={transaction.orderTitle}
      description={`交易流水号: ${transaction.id} • 通道流水: ${transaction.channelTradeNo}`}
      icon={<Receipt className="w-5 h-5 text-zinc-800" />}
      widthClass="max-w-2xl"
      footer={
        <div className="w-full flex items-center justify-between">
          <div className="text-[11px] text-zinc-400">
            审核经办: <strong className="text-zinc-700">{transaction.reviewer?.name}</strong>
          </div>

          <div className="flex items-center gap-2">
            {transaction.status === "discrepancy" && onOpenDiscrepancy && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDiscrepancy(transaction);
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                调账处理中心
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              关闭详情
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Status & Highlights */}
        <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-medium">当前清算状态:</span>
            {statusBadge()}
          </div>
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-zinc-900">
              {formatCurrency(transaction.orderAmount, transaction.currency)}
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">
              网关费率: {formatCurrency(transaction.channelFee, transaction.currency)}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "timeline"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>全链路时间轴</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("raw_payload")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "raw_payload"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>网关报文载荷</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("risk")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "risk"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>风控与反欺诈</span>
          </button>
        </div>

        {/* Content Tab 1: Timeline */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            {/* Meta Information Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div className="text-[10px] text-zinc-400">收单网关通道</div>
                <div className="font-bold text-zinc-800 uppercase mt-0.5">
                  {transaction.channel}
                </div>
              </div>
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div className="text-[10px] text-zinc-400">支付工具 / 卡号</div>
                <div className="font-bold text-zinc-800 truncate mt-0.5">
                  {transaction.paymentMethod || "Visa (*4242)"}
                </div>
              </div>
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div className="text-[10px] text-zinc-400">商户签约主体</div>
                <div className="font-bold text-zinc-800 truncate mt-0.5">
                  {transaction.merchantName}
                </div>
              </div>
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                <div className="text-[10px] text-zinc-400">实际净结算额</div>
                <div className="font-bold text-emerald-600 mt-0.5 font-mono">
                  {formatCurrency(transaction.settleAmount, transaction.currency)}
                </div>
              </div>
            </div>

            {/* Timeline Steps */}
            <div className="space-y-3 pt-2">
              <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-zinc-600" />
                <span>订单全生命周期事件流 (Event Stream):</span>
              </div>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200">
                {transaction.flowSteps?.map((step, idx) => (
                  <div key={idx} className="relative group">
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center ${
                        step.status === "FAILED"
                          ? "border-rose-500 text-rose-500"
                          : "border-emerald-500 text-emerald-500"
                      }`}
                    >
                      {step.status === "FAILED" ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                    </div>
                    <div className="p-3 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-900">
                          {step.stepName}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {step.timestamp}
                        </span>
                      </div>
                      <p className="text-zinc-600 text-[11px] mt-1">{step.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {transaction.discrepancyNote && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                <div className="font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>系统检测到差错疑账原因:</span>
                </div>
                <p className="text-rose-700 text-xs">
                  {transaction.discrepancyNote}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Content Tab 2: Raw Payload */}
        {activeTab === "raw_payload" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">海外收单网关原始 JSON 响应报文:</span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(transaction, null, 2),
                    "raw_json"
                  )
                }
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-mono text-[11px] cursor-pointer"
              >
                {copiedKey === "raw_json" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>已复制报文</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>复制 JSON</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-96">
              {JSON.stringify(
                {
                  id: transaction.id,
                  channel_trade_no: transaction.channelTradeNo,
                  object: "charge",
                  amount: transaction.orderAmount * 100,
                  amount_captured: transaction.orderAmount * 100,
                  currency: transaction.currency.toLowerCase(),
                  captured: true,
                  status: transaction.status === "done" ? "succeeded" : "pending",
                  payment_method_details: {
                    type: "card",
                    card: {
                      brand: "visa",
                      country: "US",
                      exp_month: 12,
                      exp_year: 2028,
                      last4: "4242",
                      funding: "credit",
                    },
                  },
                  fee_details: [
                    {
                      amount: Math.round(transaction.channelFee * 100),
                      currency: transaction.currency.toLowerCase(),
                      type: "stripe_fee",
                    },
                  ],
                },
                null,
                2
              )}
            </pre>
          </div>
        )}

        {/* Content Tab 3: Risk & Compliance */}
        {activeTab === "risk" && (
          <div className="space-y-3">
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-zinc-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Stripe Radar 评分与欺诈风险分析</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold font-mono text-xs">
                  Risk Score: 12 (Low)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="p-2.5 bg-white border border-zinc-200 rounded-lg">
                  <span className="text-zinc-400 block">3D Secure 2.0 验证:</span>
                  <strong className="text-zinc-800">免密通过 (Frictionless Authentication)</strong>
                </div>
                <div className="p-2.5 bg-white border border-zinc-200 rounded-lg">
                  <span className="text-zinc-400 block">CVC / AVS 账单地址验证:</span>
                  <strong className="text-zinc-800">全部通过 (Matched)</strong>
                </div>
                <div className="p-2.5 bg-white border border-zinc-200 rounded-lg">
                  <span className="text-zinc-400 block">客户端 IP 属地:</span>
                  <strong className="text-zinc-800">美国加利福尼亚州 (US - CA)</strong>
                </div>
                <div className="p-2.5 bg-white border border-zinc-200 rounded-lg">
                  <span className="text-zinc-400 block">发卡行国家:</span>
                  <strong className="text-zinc-800">美国 Chase 摩根大通 (US)</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SideSheet>
  );
};
