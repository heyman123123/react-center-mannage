import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Shield,
  FileCheck,
  RefreshCw,
  Scale,
  ArrowRight,
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
  const [selectedAction, setSelectedAction] = useState<"balance" | "refund" | "escrow">("balance");
  const [resolveNote, setResolveNote] = useState<string>("根据商户代金券核验单据，准予系统平账补差入账。");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentRole = (currentUser?.roleKey && RBAC_ROLES[currentUser.roleKey]) || RBAC_ROLES["SUPER_ADMIN"];
  const canResolve = currentRole?.permissions?.canResolveDiscrepancy ?? true;
  const canManualAdjust = currentRole?.permissions?.canManualAdjustFund ?? true;

  const handleSubmit = () => {
    setErrorMessage(null);
    if (!canResolve) {
      setErrorMessage("RBAC权限拒绝：当前角色无权执行差错调账或平账决策！");
      return;
    }

    if (selectedAction === "refund" && !canManualAdjust) {
      setErrorMessage("RBAC权限拒绝：渠道资金退款冲正属于高危资金操作，需财务总监或超级管理员权限！");
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
      title="差错疑账调账处置中心"
      description={`对流水号 ${transaction.id} 存在的账实差异执行人工复核、补差抹平或冲正退款。`}
      icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
      widthClass="max-w-xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 border border-line text-fg-secondary hover:bg-hover rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            取消
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
                <span>正在提交财务调账...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>确认执行调账</span>
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

        {/* Discrepancy Detail banner */}
        <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3.5 space-y-1">
          <div className="font-semibold text-rose-900 flex items-center justify-between">
            <span>{transaction.orderTitle}</span>
            <span className="font-mono text-xs">{transaction.id}</span>
          </div>
          <p className="text-rose-700 text-xs mt-1 leading-relaxed">
            {transaction.discrepancyNote || "业务订单金额与银行清算账单存在不一致，请核验差额原因并选择处置方式。"}
          </p>
        </div>

        {/* Amount Comparison */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 bg-subtle border border-line rounded-xl">
            <span className="text-fg-secondary text-[11px]">业务系统应收</span>
            <div className="font-mono font-bold text-sm text-fg mt-1">
              {formatCurrency(transaction.orderAmount, transaction.currency)}
            </div>
          </div>
          <div className="p-3 bg-subtle border border-line rounded-xl">
            <span className="text-fg-secondary text-[11px]">支付渠道实收</span>
            <div className="font-mono font-bold text-sm text-amber-700 mt-1">
              {formatCurrency(transaction.orderAmount - 0.5, transaction.currency)}
            </div>
          </div>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
            <span className="text-rose-600 font-medium text-[11px]">平账差额</span>
            <div className="font-mono font-bold text-sm text-rose-700 mt-1">
              {formatCurrency(0.5, transaction.currency)}
            </div>
          </div>
        </div>

        {/* Action Choice */}
        <div>
          <label className="font-semibold text-fg block mb-2">
            选择调账解决方案 (Action Type):
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
              <div className="font-semibold text-xs">自动抹平入账</div>
              <div
                className={`text-[10px] mt-1 ${
                  selectedAction === "balance" ? "text-zinc-300" : "text-fg-tertiary"
                }`}
              >
                补入平台营销补差池，完成Done平账
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
              <div className="font-semibold text-xs">渠道冲正退款</div>
              <div
                className={`text-[10px] mt-1 ${
                  selectedAction === "refund" ? "text-zinc-300" : "text-fg-tertiary"
                }`}
              >
                向支付网关下发退款冲正指令 (需总监权限)
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
              <div className="font-semibold text-xs">单边挂账待核</div>
              <div
                className={`text-[10px] mt-1 ${
                  selectedAction === "escrow" ? "text-zinc-300" : "text-fg-tertiary"
                }`}
              >
                暂挂至集团待清算暂收款科目
              </div>
            </button>
          </div>
        </div>

        {/* Review Note */}
        <div>
          <label className="font-semibold text-fg block mb-1">
            调账审批凭证备注 (Audit Approval Note):
          </label>
          <textarea
            rows={2}
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            className="w-full p-2.5 bg-subtle border border-line rounded-lg text-xs focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* RBAC notice */}
        <div className="flex items-center justify-between text-[11px] text-fg-secondary bg-subtle p-2.5 rounded-xl border border-line">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            当前操作人: <strong className="text-fg">{currentUser?.name || "操作人"}</strong> ({currentRole?.name || "系统审核员"})
          </span>
          <span>
            审批效力:{" "}
            <strong className={canResolve ? "text-emerald-700" : "text-rose-600"}>
              {canResolve ? "具备调账审批权限" : "受限角色 (无调账权)"}
            </strong>
          </span>
        </div>
      </div>
    </SideSheet>
  );
};
