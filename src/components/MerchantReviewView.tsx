import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as merchantApi from "../api/modules/merchant";
import { useTranslation } from "react-i18next";
import {
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Hourglass,
  Loader2,
  Building2,
  Eye,
  Paperclip,
  Download,
  FileSpreadsheet,
  FileImage,
  File,
  Users,
  Landmark,
  TrendingUp,
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ContextMenu } from "./ui/ContextMenu";
import { Popconfirm } from "./ui/Popconfirm";
import { MerchantApplication, MerchantReviewStatus, MerchantDocument, MerchantStats } from "../types/payment";

const fileIcon = (type: string) => {
  if (/图片|jpg|png|jpeg/i.test(type)) return <FileImage className="w-4 h-4 text-blue-500" />;
  if (/pdf|sheet|表/i.test(type)) return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
  return <File className="w-4 h-4 text-fg-tertiary" />;
};

export const MerchantReviewView: React.FC = () => {
  const { t } = useTranslation(["merchant", "common"]);
  const [rows, setRows] = useState<MerchantApplication[]>([]);

  const loadRows = useCallback(async () => {
    try {
      const list = await merchantApi.listMerchantApplications();
      setRows(list);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const [statusFilter, setStatusFilter] = useState<"ALL" | MerchantReviewStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailApp, setDetailApp] = useState<MerchantApplication | null>(null);
  const [appStats, setAppStats] = useState<MerchantStats | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewDoc, setPreviewDoc] = useState<MerchantDocument | null>(null);
  const pg = usePagination(10);
  useEffect(() => { pg.reset(); }, [statusFilter, searchQuery, pg.reset]);

  const STATUS_META = useMemo(
    (): Record<MerchantReviewStatus, { label: string; badge: string; icon: React.ReactNode }> => ({
      PENDING: { label: t("status.PENDING"), badge: "bg-amber-50 text-amber-700 border-amber-200", icon: <Hourglass className="w-3 h-3" /> },
      IN_REVIEW: { label: t("status.IN_REVIEW"), badge: "bg-blue-50 text-blue-700 border-blue-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
      APPROVED: { label: t("status.APPROVED"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
      REJECTED: { label: t("status.REJECTED"), badge: "bg-rose-50 text-rose-700 border-rose-200", icon: <XCircle className="w-3 h-3" /> },
    }),
    [t]
  );

  const applyTypeLabel = (type: MerchantApplication["applyType"]) =>
    type === "NEW" ? t("applyType.NEW") : t("applyType.CHANGE");

  const filtered = useMemo(() => rows.filter((a) => {
    const matchStatus = statusFilter === "ALL" || a.status === statusFilter;
    const matchSearch =
      a.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.contactPerson.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  }), [rows, statusFilter, searchQuery]);

  const openDetail = async (a: MerchantApplication) => {
    setDetailApp(a);
    setRejectReason("");
    setAppStats(null);
    try {
      const [detail, stats] = await Promise.all([
        merchantApi.getMerchantDetail(a.id),
        merchantApi.getMerchantStats(a.id),
      ]);
      setDetailApp(detail);
      setAppStats(stats);
    } catch {
      // keep the row data as fallback
    }
  };

  const approve = async (id: string) => {
    try {
      const updated = await merchantApi.approveMerchant(id);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setDetailApp(null);
    } catch (err) {
      console.error("approve merchant failed", err);
    }
  };

  const reject = async (id: string) => {
    if (!rejectReason.trim()) return;
    try {
      const updated = await merchantApi.rejectMerchant(id, rejectReason.trim());
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setDetailApp(null);
    } catch (err) {
      console.error("reject merchant failed", err);
    }
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} cols={7} />;

  const pendingCount = rows.filter((r) => r.status === "PENDING").length;

  // Simple bar chart for trend
  const maxTrendVolume = appStats?.trend?.length
    ? Math.max(...appStats.trend.map((d) => d.volume), 1)
    : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("title")}</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-fg-secondary">
          <span className="px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-semibold border border-amber-200">{t("pendingCount", { count: pendingCount })}</span>
        </div>
      </div>

      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-fg-tertiary text-xs">{t("common:statusLabel")}</span>
          {(["ALL", "PENDING", "IN_REVIEW", "APPROVED", "REJECTED"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
              {s === "ALL" ? t("common:all") : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
          <input type="text" placeholder={t("searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3">{t("table.company")}</th>
                <th className="py-2 px-3">{t("table.country")}</th>
                <th className="py-2 px-3">{t("table.applyType")}</th>
                <th className="py-2 px-3">{t("table.contactPerson")}</th>
                <th className="py-2 px-3">{t("table.contactEmail")}</th>
                <th className="py-2 px-3">{t("table.kybStatus")}</th>
                <th className="py-2 px-3">{t("table.submittedAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<MerchantApplication>(filtered, pg.currentPage, pg.pageSize).map((a) => {
                const sm = STATUS_META[a.status];
                return (
                  <ContextMenu
                    key={a.id}
                    items={[
                      { key: "review", label: t("menu.review"), icon: <Eye className="w-3.5 h-3.5" />, onClick: () => void openDetail(a) },
                      { key: "detail", label: t("menu.viewDetail"), icon: <Building2 className="w-3.5 h-3.5" />, onClick: () => void openDetail(a) },
                      { key: "refresh", label: t("menu.refresh"), icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => void loadRows() },
                    ]}
                    trigger={
                      <tr onClick={() => void openDetail(a)} className="hover:bg-subtle/80 transition-colors cursor-pointer">
                        <td className="py-3 px-3 font-medium text-fg truncate max-w-[200px]" title={a.companyName}>{a.companyName}</td>
                        <td className="py-3 px-3 font-mono text-fg-secondary">{a.country}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{applyTypeLabel(a.applyType)}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{a.contactPerson}</td>
                        <td className="py-3 px-3 font-mono text-fg-secondary whitespace-nowrap">{a.contactEmail}</td>
                        <td className="py-3 px-3 whitespace-nowrap"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sm.badge}`}>{sm.icon}{sm.label}</span></td>
                        <td className="py-3 px-3 font-mono text-[11px] text-fg-secondary whitespace-nowrap">{a.submittedAt}</td>
                      </tr>
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={pg.currentPage} totalItems={filtered.length} pageSize={pg.pageSize} onPageChange={pg.setCurrentPage} onPageSizeChange={pg.setPageSize} />
      </div>

      {/* Detail SideSheet */}
      <SideSheet
        id="merchant-detail"
        isOpen={!!detailApp}
        onClose={() => setDetailApp(null)}
        title={detailApp ? t("detail.title", { company: detailApp.companyName }) : t("detail.titleFallback")}
        description={detailApp ? `${detailApp.country} · ${applyTypeLabel(detailApp.applyType)} · ${STATUS_META[detailApp.status].label}` : ""}
        icon={<Building2 className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={detailApp && (detailApp.status === "PENDING" || detailApp.status === "IN_REVIEW") ? (
          <div className="flex items-center gap-2 w-full">
            <Popconfirm
              title={t("review.approveTitle")}
              description={t("review.approveDesc", { company: detailApp.companyName })}
              confirmText={t("review.approve")}
              okClassName="bg-emerald-600 hover:bg-emerald-700"
              onConfirm={() => approve(detailApp.id)}
            >
              <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t("review.approveBtn")}
              </button>
            </Popconfirm>
            <Popconfirm
              title={t("review.rejectTitle")}
              description={t("review.rejectDesc", { reason: rejectReason || t("review.rejectEmpty") })}
              confirmText={t("review.rejectConfirm")}
              onConfirm={() => reject(detailApp.id)}
            >
              <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40" disabled={!rejectReason.trim()}>
                <XCircle className="w-3.5 h-3.5" /> {t("review.rejectBtn")}
              </button>
            </Popconfirm>
            <button onClick={() => setDetailApp(null)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover ml-auto">{t("common:close")}</button>
          </div>
        ) : (
          <button onClick={() => setDetailApp(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">{t("common:close")}</button>
        )}
      >
        {detailApp && (
          <div className="space-y-4 text-xs">
            {/* Stats cards */}
            {appStats && (
              <div>
                <div className="font-semibold text-fg mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-fg-tertiary" /> {t("stats.title")}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div className="bg-subtle p-3 rounded-xl border border-line">
                    <div className="text-[11px] text-fg-tertiary">{t("stats.totalVolume")}</div>
                    <div className="font-bold text-fg mt-1">${appStats.totalVolume.toLocaleString()}</div>
                  </div>
                  <div className="bg-subtle p-3 rounded-xl border border-line">
                    <div className="text-[11px] text-fg-tertiary">{t("stats.transactionCount")}</div>
                    <div className="font-bold text-fg mt-1">{appStats.transactionCount}</div>
                  </div>
                  <div className="bg-subtle p-3 rounded-xl border border-line">
                    <div className="text-[11px] text-fg-tertiary">{t("stats.successRate")}</div>
                    <div className="font-bold text-emerald-600 mt-1">{appStats.successRate}%</div>
                  </div>
                  <div className="bg-subtle p-3 rounded-xl border border-line">
                    <div className="text-[11px] text-fg-tertiary">{t("stats.refundRate")}</div>
                    <div className="font-bold text-amber-600 mt-1">{appStats.refundRate}%</div>
                  </div>
                  <div className="bg-subtle p-3 rounded-xl border border-line col-span-2">
                    <div className="text-[11px] text-fg-tertiary">{t("stats.avgAmount")}</div>
                    <div className="font-bold text-fg mt-1">${appStats.avgTransactionAmount.toFixed(2)}</div>
                  </div>
                </div>
                {/* Simple bar chart */}
                {appStats.trend && appStats.trend.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] text-fg-tertiary mb-1.5">{t("stats.trend")}</div>
                    <div className="flex items-end gap-1 h-20">
                      {appStats.trend.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-primary/70 rounded-t"
                            style={{ height: `${Math.max((d.volume / maxTrendVolume) * 100, 5)}%` }}
                            title={`${d.date}: $${d.volume}`}
                          />
                          <span className="text-[9px] text-fg-tertiary">{d.date.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Enterprise info */}
            <div>
              <div className="font-semibold text-fg mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-fg-tertiary" /> {t("detail.companyInfo")}
              </div>
              <div className="bg-subtle p-3 rounded-xl border border-line space-y-1.5">
                <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.companyName")}</span><span className="font-medium text-fg">{detailApp.companyName}</span></div>
                <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.country")}</span><span className="font-mono text-fg">{detailApp.country}</span></div>
                {detailApp.businessType && <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.businessType")}</span><span className="text-fg">{detailApp.businessType}</span></div>}
                {detailApp.registrationNumber && <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.registrationNumber")}</span><span className="font-mono text-fg">{detailApp.registrationNumber}</span></div>}
                {detailApp.address && <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.address")}</span><span className="text-fg text-right max-w-[220px]">{detailApp.address}</span></div>}
                <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.contactPerson")}</span><span className="text-fg">{detailApp.contactPerson}</span></div>
                <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.contactEmail")}</span><span className="font-mono text-fg">{detailApp.contactEmail}</span></div>
                {detailApp.phone && <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.phone")}</span><span className="font-mono text-fg">{detailApp.phone}</span></div>}
                <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.submittedAt")}</span><span className="font-mono text-fg">{detailApp.submittedAt}</span></div>
              </div>
            </div>

            {/* Legal info */}
            {(detailApp.legalName || detailApp.legalIdNumber) && (
              <div>
                <div className="font-semibold text-fg mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-fg-tertiary" /> {t("detail.legalInfo")}
                </div>
                <div className="bg-subtle p-3 rounded-xl border border-line space-y-1.5">
                  {detailApp.legalName && <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.legalName")}</span><span className="text-fg">{detailApp.legalName}</span></div>}
                  {detailApp.legalIdType && <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.legalIdType")}</span><span className="text-fg">{detailApp.legalIdType}</span></div>}
                  {detailApp.legalIdNumber && <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.legalIdNumber")}</span><span className="font-mono text-fg">{detailApp.legalIdNumber}</span></div>}
                </div>
              </div>
            )}

            {/* Settlement info */}
            {(detailApp.bankName || detailApp.bankAccount) && (
              <div>
                <div className="font-semibold text-fg mb-2 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-fg-tertiary" /> {t("detail.settlementInfo")}
                </div>
                <div className="bg-subtle p-3 rounded-xl border border-line space-y-1.5">
                  {detailApp.settlementCurrency && <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.settlementCurrency")}</span><span className="font-mono text-fg">{detailApp.settlementCurrency}</span></div>}
                  {detailApp.bankName && <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.bankName")}</span><span className="text-fg">{detailApp.bankName}</span></div>}
                  {detailApp.bankAccount && <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.bankAccount")}</span><span className="font-mono text-fg">{detailApp.bankAccount}</span></div>}
                  {detailApp.bankCode && <div className="flex justify-between"><span className="text-fg-tertiary">{t("detail.bankCode")}</span><span className="font-mono text-fg">{detailApp.bankCode}</span></div>}
                </div>
              </div>
            )}

            {/* Documents */}
            <div>
              <div className="font-semibold text-fg mb-2">{t("detail.documents", { count: detailApp.documents.length })}</div>
              <div className="space-y-1.5">
                {detailApp.documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-subtle px-3 py-2 rounded-lg border border-line">
                    {fileIcon(doc.type)}
                    <button onClick={() => setPreviewDoc(doc)} className="text-fg font-medium hover:text-primary truncate text-left flex-1" title={doc.name}>
                      {doc.name}
                    </button>
                    <span className="text-[11px] text-fg-tertiary shrink-0">{doc.type}</span>
                    <button onClick={() => setPreviewDoc(doc)} className="p-1 text-fg-tertiary hover:text-primary shrink-0">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Reject reason input */}
            {detailApp.status !== "APPROVED" && detailApp.status !== "REJECTED" && (
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("review.rejectReasonLabel")}</label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder={t("review.rejectReasonPlaceholder")} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none" />
              </div>
            )}
            {detailApp.status === "REJECTED" && detailApp.rejectReason && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-[11px]">{t("review.rejectReasonPrefix")}{detailApp.rejectReason}</div>
            )}
          </div>
        )}
      </SideSheet>

      {/* Document preview SideSheet */}
      <SideSheet
        id="merchant-doc-preview"
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={t("preview.title")}
        description={previewDoc ? previewDoc.type : ""}
        icon={<Paperclip className="w-5 h-5 text-fg" />}
        widthClass="max-w-md max-md:max-w-none"
        footer={<button onClick={() => setPreviewDoc(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">{t("common:close")}</button>}
      >
        {previewDoc && (
          <div className="space-y-3 text-xs">
            <div className="border-2 border-dashed border-line rounded-xl h-52 flex flex-col items-center justify-center gap-2 bg-subtle">
              {fileIcon(previewDoc.type)}
              <div className="text-fg-tertiary text-[11px]">{t("preview.mockPreview")}</div>
            </div>
            <div className="bg-subtle p-3 rounded-xl border border-line space-y-1.5">
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("preview.fileName")}</span><span className="font-mono text-fg truncate max-w-[220px]" title={previewDoc.name}>{previewDoc.name}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("preview.fileType")}</span><span className="text-fg">{previewDoc.type}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("preview.fileSize")}</span><span className="font-mono text-fg">{previewDoc.size}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("preview.uploadedAt")}</span><span className="font-mono text-fg">{previewDoc.uploadedAt}</span></div>
            </div>
            <button className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-line text-fg-secondary rounded-lg text-xs font-medium hover:bg-hover">
              <Download className="w-3.5 h-3.5" /> {t("preview.download")}
            </button>
          </div>
        )}
      </SideSheet>
    </div>
  );
};
