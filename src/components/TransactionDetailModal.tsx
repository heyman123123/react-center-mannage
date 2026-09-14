import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Receipt,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  CreditCard,
  Copy,
  Check,
} from "lucide-react";
import { TransactionRecord } from "../types/payment";
import { formatCurrency } from "../lib/utils";
import { SideSheet } from "./ui/SideSheet";

interface TransactionDetailModalProps {
  transaction: TransactionRecord;
  onClose: () => void;
  onOpenDiscrepancy?: (tx: TransactionRecord) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
  onOpenDiscrepancy,
}) => {
  const { t } = useTranslation(["transactions", "common"]);
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
            {t("detail.status.done")}
          </span>
        );
      case "in_process":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            {t("detail.status.inProcess")}
          </span>
        );
      case "discrepancy":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t("detail.status.discrepancy")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-hover text-fg-secondary border border-line">
            {t("detail.status.pending")}
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
      description={t("detail.description", { id: transaction.id, channelTradeNo: transaction.channelTradeNo })}
      icon={<Receipt className="w-5 h-5 text-fg" />}
      widthClass="max-w-2xl"
      footer={
        <div className="w-full flex items-center justify-between">
          <div className="text-[11px] text-fg-tertiary">
            {t("detail.reviewer")} <strong className="text-fg-secondary">{transaction.reviewer?.name}</strong>
          </div>

          <div className="flex items-center gap-2">
            {transaction.status === "discrepancy" && onOpenDiscrepancy && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDiscrepancy(transaction);
                }}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-card transition-colors cursor-pointer"
              >
                {t("detail.resolveCenter")}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold shadow-card transition-colors cursor-pointer"
            >
              {t("detail.closeDetail")}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between p-3 bg-subtle border border-line rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-fg-secondary font-medium">{t("detail.currentStatus")}</span>
            {statusBadge()}
          </div>
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-fg">
              {formatCurrency(transaction.orderAmount, transaction.currency)}
            </div>
            <div className="text-[10px] text-fg-tertiary font-mono">
              {t("detail.gatewayFee", { fee: formatCurrency(transaction.channelFee, transaction.currency) })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-line pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "timeline"
                ? "bg-primary text-primary-foreground"
                : "bg-hover text-fg-secondary hover:bg-hover"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{t("detail.tabs.timeline")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("raw_payload")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "raw_payload"
                ? "bg-primary text-primary-foreground"
                : "bg-hover text-fg-secondary hover:bg-hover"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{t("detail.tabs.payload")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("risk")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "risk"
                ? "bg-primary text-primary-foreground"
                : "bg-hover text-fg-secondary hover:bg-hover"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t("detail.tabs.risk")}</span>
          </button>
        </div>

        {activeTab === "timeline" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-subtle border border-line rounded-xl">
                <div className="text-[10px] text-fg-tertiary">{t("detail.fields.gateway")}</div>
                <div className="font-bold text-fg uppercase mt-0.5">
                  {transaction.channel}
                </div>
              </div>
              <div className="p-3 bg-subtle border border-line rounded-xl">
                <div className="text-[10px] text-fg-tertiary">{t("detail.fields.paymentMethod")}</div>
                <div className="font-bold text-fg truncate mt-0.5">
                  {transaction.paymentMethod || "Visa (*4242)"}
                </div>
              </div>
              <div className="p-3 bg-subtle border border-line rounded-xl">
                <div className="text-[10px] text-fg-tertiary">{t("detail.fields.merchant")}</div>
                <div className="font-bold text-fg truncate mt-0.5">
                  {transaction.merchantName}
                </div>
              </div>
              <div className="p-3 bg-subtle border border-line rounded-xl">
                <div className="text-[10px] text-fg-tertiary">{t("detail.fields.netSettle")}</div>
                <div className="font-bold text-emerald-600 mt-0.5 font-mono">
                  {formatCurrency(transaction.settleAmount, transaction.currency)}
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="font-bold text-fg flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-fg-secondary" />
                <span>{t("detail.timeline.title")}</span>
              </div>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-hover">
                {transaction.flowSteps?.map((step, idx) => (
                  <div key={idx} className="relative group">
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 bg-surface flex items-center justify-center ${
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
                    <div className="p-3 bg-surface border border-line rounded-xl shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-fg">
                          {step.stepName}
                        </span>
                        <span className="text-[10px] font-mono text-fg-tertiary">
                          {step.timestamp}
                        </span>
                      </div>
                      <p className="text-fg-secondary text-[11px] mt-1">{step.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {transaction.discrepancyNote && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                <div className="font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>{t("detail.timeline.discrepancyReason")}</span>
                </div>
                <p className="text-rose-700 text-xs">
                  {transaction.discrepancyNote}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "raw_payload" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-fg-secondary font-medium">{t("detail.payload.title")}</span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(transaction, null, 2),
                    "raw_json"
                  )
                }
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-hover hover:bg-hover text-fg-secondary font-mono text-[11px] cursor-pointer"
              >
                {copiedKey === "raw_json" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t("detail.copiedJson")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t("detail.copyJson")}</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-primary text-primary-foreground rounded-xl font-mono text-[11px] overflow-x-auto max-h-96">
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

        {activeTab === "risk" && (
          <div className="space-y-3">
            <div className="p-3 bg-subtle border border-line rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-fg flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{t("detail.risk.title")}</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold font-mono text-xs">
                  {t("detail.riskScore")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-surface border border-line rounded-lg">
                  <span className="text-fg-tertiary block">{t("detail.risk.threeDS")}</span>
                  <strong className="text-fg">{t("detail.risk.threeDSValue")}</strong>
                </div>
                <div className="p-2.5 bg-surface border border-line rounded-lg">
                  <span className="text-fg-tertiary block">{t("detail.risk.cvcAvs")}</span>
                  <strong className="text-fg">{t("detail.risk.cvcAvsValue")}</strong>
                </div>
                <div className="p-2.5 bg-surface border border-line rounded-lg">
                  <span className="text-fg-tertiary block">{t("detail.risk.ipRegion")}</span>
                  <strong className="text-fg">{t("detail.risk.ipRegionValue")}</strong>
                </div>
                <div className="p-2.5 bg-surface border border-line rounded-lg">
                  <span className="text-fg-tertiary block">{t("detail.risk.issuerCountry")}</span>
                  <strong className="text-fg">{t("detail.issuerCountryValue")}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SideSheet>
  );
};
