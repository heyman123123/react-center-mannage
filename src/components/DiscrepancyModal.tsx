import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Shield,
  RefreshCw,
} from "lucide-react";
import { TransactionRecord, SystemUser } from "../types/payment";
import { RBAC_ROLES } from "../data/mockData";
import { formatCurrency } from "../lib/utils";
import { SideSheet } from "./ui/SideSheet";

interface DiscrepancyModalProps {
  transaction: TransactionRecord;
  currentUser: SystemUser;
  onClose: () => void;
  onResolve: (txId: string, actionType: "balance" | "refund" | "escrow", note: string) => void;
}

export const DiscrepancyModal: React.FC<DiscrepancyModalProps> = ({
  transaction,
  currentUser,
  onClose,
  onResolve,
}) => {
  const { t } = useTranslation(["transactions", "common"]);
  const [selectedAction, setSelectedAction] = useState<"balance" | "refund" | "escrow">("balance");
  const [resolveNote, setResolveNote] = useState<string>(t("discrepancy.defaultNote"));
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentRole = (currentUser?.roleKey && RBAC_ROLES[currentUser.roleKey]) || RBAC_ROLES["SUPER_ADMIN"];
  const canResolve = currentRole?.permissions?.canResolveDiscrepancy ?? true;
  const canManualAdjust = currentRole?.permissions?.canManualAdjustFund ?? true;

  const handleSubmit = () => {
    setErrorMessage(null);
    if (!canResolve) {
      setErrorMessage(t("discrepancy.errors.noResolve"));
      return;
    }

    if (selectedAction === "refund" && !canManualAdjust) {
      setErrorMessage(t("discrepancy.errors.noRefund"));
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onResolve(transaction.id, selectedAction, resolveNote);
      onClose();
    }, 600);
  };

  return (
    <SideSheet
      id="side-sheet-discrepancy"
      isOpen={true}
      onClose={onClose}
      title={t("discrepancy.title")}
      description={t("discrepancy.description", { id: transaction.id })}
      icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
      widthClass="max-w-xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 border border-line text-fg-secondary hover:bg-hover rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {t("common:actions.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-semibold shadow-card transition-colors cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t("discrepancy.processing")}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t("discrepancy.confirm")}</span>
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3.5 space-y-1">
          <div className="font-semibold text-rose-900 flex items-center justify-between">
            <span>{transaction.orderTitle}</span>
            <span className="font-mono text-xs">{transaction.id}</span>
          </div>
          <p className="text-rose-700 text-xs mt-1 leading-relaxed">
            {transaction.discrepancyNote || t("discrepancy.defaultReason")}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 bg-subtle border border-line rounded-xl">
            <span className="text-fg-secondary text-[11px]">{t("discrepancy.amounts.order")}</span>
            <div className="font-mono font-bold text-sm text-fg mt-1">
              {formatCurrency(transaction.orderAmount, transaction.currency)}
            </div>
          </div>
          <div className="p-3 bg-subtle border border-line rounded-xl">
            <span className="text-fg-secondary text-[11px]">{t("discrepancy.amounts.channel")}</span>
            <div className="font-mono font-bold text-sm text-amber-700 mt-1">
              {formatCurrency(transaction.orderAmount - 0.5, transaction.currency)}
            </div>
          </div>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
            <span className="text-rose-600 font-medium text-[11px]">{t("discrepancy.amounts.diff")}</span>
            <div className="font-mono font-bold text-sm text-rose-700 mt-1">
              {formatCurrency(0.5, transaction.currency)}
            </div>
          </div>
        </div>

        <div>
          <label className="font-semibold text-fg block mb-2">
            {t("discrepancy.actionLabel")}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedAction("balance")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedAction === "balance"
                  ? "border-primary bg-primary text-primary-foreground shadow-card"
                  : "border-line hover:border-line text-fg-secondary bg-surface"
              }`}
            >
              <div className="font-semibold text-xs">{t("discrepancy.actions.balance.title")}</div>
              <div
                className={`text-[10px] mt-1 ${
                  selectedAction === "balance" ? "text-zinc-300" : "text-fg-tertiary"
                }`}
              >
                {t("discrepancy.actions.balance.desc")}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedAction("refund")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedAction === "refund"
                  ? "border-primary bg-primary text-primary-foreground shadow-card"
                  : "border-line hover:border-line text-fg-secondary bg-surface"
              }`}
            >
              <div className="font-semibold text-xs">{t("discrepancy.actions.refund.title")}</div>
              <div
                className={`text-[10px] mt-1 ${
                  selectedAction === "refund" ? "text-zinc-300" : "text-fg-tertiary"
                }`}
              >
                {t("discrepancy.actions.refund.desc")}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedAction("escrow")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedAction === "escrow"
                  ? "border-primary bg-primary text-primary-foreground shadow-card"
                  : "border-line hover:border-line text-fg-secondary bg-surface"
              }`}
            >
              <div className="font-semibold text-xs">{t("discrepancy.actions.escrow.title")}</div>
              <div
                className={`text-[10px] mt-1 ${
                  selectedAction === "escrow" ? "text-zinc-300" : "text-fg-tertiary"
                }`}
              >
                {t("discrepancy.actions.escrow.desc")}
              </div>
            </button>
          </div>
        </div>

        <div>
          <label className="font-semibold text-fg block mb-1">
            {t("discrepancy.noteLabel")}
          </label>
          <textarea
            rows={2}
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            className="w-full p-2.5 bg-subtle border border-line rounded-lg text-xs focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-fg-secondary bg-subtle p-2.5 rounded-xl border border-line">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            {t("discrepancy.operator")}{" "}
            <strong className="text-fg">{currentUser?.name || t("discrepancy.operatorFallback")}</strong> ({currentRole?.name || t("discrepancy.roleFallback")})
          </span>
          <span>
            {t("discrepancy.approvalLabel")}{" "}
            <strong className={canResolve ? "text-emerald-700" : "text-rose-600"}>
              {canResolve ? t("discrepancy.canResolve") : t("discrepancy.cannotResolve")}
            </strong>
          </span>
        </div>
      </div>
    </SideSheet>
  );
};
