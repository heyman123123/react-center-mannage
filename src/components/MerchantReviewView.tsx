import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as merchantApi from "../api/modules/merchant";
import { useTranslation } from "react-i18next";
import {
  FileText,
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
} from "lucide-react";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ContextMenu } from "./ui/ContextMenu";
import { Popconfirm } from "./ui/Popconfirm";
import { MerchantApplication, MerchantReviewStatus, MerchantDocument } from "../types/payment";


const fileIcon = (type: string) => {
  if (/图片|jpg|png|jpeg/i.test(type)) return <FileImage className="w-4 h-4 text-blue-500" />;
  if (/pdf|sheet|表/i.test(type)) return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
  return <File className="w-4 h-4 text-fg-tertiary" />;
};

export const MerchantReviewView: React.FC = () => {
  const { t } = useTranslation(["commerce", "common"]);
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
  const [reviewApp, setReviewApp] = useState<MerchantApplication | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewDoc, setPreviewDoc] = useState<MerchantDocument | null>(null);
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [statusFilter, searchQuery, reset]);

  const STATUS_META = useMemo(
    (): Record<MerchantReviewStatus, { label: string; badge: string; icon: React.ReactNode }> => ({
      PENDING: { label: t("merchantReview.status.PENDING"), badge: "bg-amber-50 text-amber-700 border-amber-200", icon: <Hourglass className="w-3 h-3" /> },
      IN_REVIEW: { label: t("merchantReview.status.IN_REVIEW"), badge: "bg-blue-50 text-blue-700 border-blue-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
      APPROVED: { label: t("merchantReview.status.APPROVED"), badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
      REJECTED: { label: t("merchantReview.status.REJECTED"), badge: "bg-rose-50 text-rose-700 border-rose-200", icon: <XCircle className="w-3 h-3" /> },
    }),
    [t]
  );

  const applyTypeLabel = (type: MerchantApplication["applyType"]) =>
    type === "NEW" ? t("merchantReview.applyType.NEW") : t("merchantReview.applyType.UPDATE");

  const filtered = useMemo(() => rows.filter((a) => {
    const matchStatus = statusFilter === "ALL" || a.status === statusFilter;
    const matchSearch = a.companyName.toLowerCase().includes(searchQuery.toLowerCase()) || a.country.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  }), [rows, statusFilter, searchQuery]);

  const openReview = (a: MerchantApplication) => { setReviewApp(a); setRejectReason(""); };

  const approve = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "APPROVED", rejectReason: undefined } : r)));
    setReviewApp(null);
  };
  const reject = (id: string) => {
    if (!rejectReason.trim()) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "REJECTED", rejectReason: rejectReason.trim() } : r)));
    setReviewApp(null);
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={9} cols={7} />;

  const pendingCount = rows.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">{t("merchantReview.title")}</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">{t("merchantReview.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-fg-secondary">
          <span className="px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-semibold border border-amber-200">{t("merchantReview.pendingCount", { count: pendingCount })}</span>
        </div>
      </div>

      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-fg-tertiary text-xs">{t("commerce:common.statusLabel")}</span>
          {(["ALL", "PENDING", "IN_REVIEW", "APPROVED", "REJECTED"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
              {s === "ALL" ? t("commerce:common.all") : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
          <input type="text" placeholder={t("merchantReview.searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3">{t("merchantReview.table.company")}</th>
                <th className="py-2 px-3">{t("merchantReview.table.country")}</th>
                <th className="py-2 px-3">{t("merchantReview.table.applyType")}</th>
                <th className="py-2 px-3 text-center">{t("merchantReview.table.documents")}</th>
                <th className="py-2 px-3">{t("merchantReview.table.status")}</th>
                <th className="py-2 px-3">{t("merchantReview.table.submittedAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<MerchantApplication>(filtered, currentPage, pageSize).map((a) => {
                const sm = STATUS_META[a.status];
                return (
                  <ContextMenu
                    key={a.id}
                    items={[
                      { key: "review", label: t("merchantReview.menu.review"), icon: <Eye className="w-3.5 h-3.5" />, onClick: () => openReview(a) },
                      { key: "detail", label: t("merchantReview.menu.viewDetail"), icon: <FileText className="w-3.5 h-3.5" />, onClick: () => openReview(a) },
                      { key: "refresh", label: t("merchantReview.menu.refresh"), icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setRows((prev) => [...prev]) },
                    ]}
                    trigger={
                      <tr onClick={() => openReview(a)} className="hover:bg-subtle/80 transition-colors cursor-pointer">
                        <td className="py-3 px-3 font-medium text-fg truncate max-w-[220px]" title={a.companyName}>{a.companyName}</td>
                        <td className="py-3 px-3 font-mono text-fg-secondary">{a.country}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{applyTypeLabel(a.applyType)}</td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-hover text-fg-secondary">
                            <Paperclip className="w-3 h-3" />{a.documents.length}
                          </span>
                        </td>
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
        <Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={pageSize} onPageChange={setCurrentPage} />
      </div>

      <SideSheet
        id="merchant-review"
        isOpen={!!reviewApp}
        onClose={() => setReviewApp(null)}
        title={reviewApp ? t("merchantReview.sheet.title", { company: reviewApp.companyName }) : t("merchantReview.sheet.titleFallback")}
        description={reviewApp ? `${reviewApp.country} · ${applyTypeLabel(reviewApp.applyType)} · ${STATUS_META[reviewApp.status].label}` : ""}
        icon={<Building2 className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={reviewApp && (reviewApp.status === "PENDING" || reviewApp.status === "IN_REVIEW") ? (
          <div className="flex items-center gap-2 w-full">
            <Popconfirm
              title={t("merchantReview.sheet.approveTitle")}
              description={t("merchantReview.sheet.approveDesc", { company: reviewApp.companyName })}
              confirmText={t("merchantReview.sheet.approve")}
              okClassName="bg-emerald-600 hover:bg-emerald-700"
              onConfirm={() => approve(reviewApp.id)}
            >
              <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t("merchantReview.sheet.approveBtn")}
              </button>
            </Popconfirm>
            <Popconfirm
              title={t("merchantReview.sheet.rejectTitle")}
              description={t("merchantReview.sheet.rejectDesc", { reason: rejectReason || t("merchantReview.sheet.rejectEmpty") })}
              confirmText={t("merchantReview.sheet.rejectConfirm")}
              onConfirm={() => reject(reviewApp.id)}
              align="center"
            >
              <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40" disabled={!rejectReason.trim()}>
                <XCircle className="w-3.5 h-3.5" /> {t("merchantReview.sheet.rejectBtn")}
              </button>
            </Popconfirm>
            <button onClick={() => setReviewApp(null)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover ml-auto">{t("common:actions.close")}</button>
          </div>
        ) : (
          <button onClick={() => setReviewApp(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">{t("common:actions.close")}</button>
        )}
      >
        {reviewApp && (
          <div className="space-y-4 text-xs">
            <div className="bg-subtle p-3 rounded-xl border border-line space-y-1.5">
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("merchantReview.sheet.company")}</span><span className="font-medium text-fg">{reviewApp.companyName}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("merchantReview.sheet.country")}</span><span className="font-mono text-fg">{reviewApp.country}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("merchantReview.sheet.contact")}</span><span className="text-fg">{reviewApp.contactPerson}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("merchantReview.sheet.email")}</span><span className="font-mono text-fg">{reviewApp.contactEmail}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("merchantReview.sheet.submittedAt")}</span><span className="font-mono text-fg">{reviewApp.submittedAt}</span></div>
            </div>

            <div>
              <div className="font-semibold text-fg mb-2">{t("merchantReview.sheet.documents", { count: reviewApp.documents.length })}</div>
              <div className="space-y-1.5">
                {reviewApp.documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-subtle px-3 py-2 rounded-lg border border-line">
                    {fileIcon(doc.type)}
                    <button onClick={() => setPreviewDoc(doc)} className="text-fg font-medium hover:text-primary truncate text-left flex-1" title={doc.name}>
                      {doc.name}
                    </button>
                    <span className="text-[11px] text-fg-tertiary shrink-0">{doc.type}</span>
                    <button onClick={() => setPreviewDoc(doc)} className="p-1 text-fg-tertiary hover:text-primary shrink-0" title={t("merchantReview.sheet.viewDoc")}>
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {reviewApp.status !== "APPROVED" && reviewApp.status !== "REJECTED" && (
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">{t("merchantReview.sheet.rejectReasonLabel")}</label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder={t("merchantReview.sheet.rejectReasonPlaceholder")} className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none" />
              </div>
            )}
            {reviewApp.status === "REJECTED" && reviewApp.rejectReason && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-[11px]">{t("merchantReview.sheet.rejectReasonPrefix")}{reviewApp.rejectReason}</div>
            )}
          </div>
        )}
      </SideSheet>

      <SideSheet
        id="merchant-doc-preview"
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={t("merchantReview.preview.title")}
        description={previewDoc ? previewDoc.type : ""}
        icon={<Paperclip className="w-5 h-5 text-fg" />}
        widthClass="max-w-md max-md:max-w-none"
        footer={<button onClick={() => setPreviewDoc(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">{t("common:actions.close")}</button>}
      >
        {previewDoc && (
          <div className="space-y-3 text-xs">
            <div className="border-2 border-dashed border-line rounded-xl h-52 flex flex-col items-center justify-center gap-2 bg-subtle">
              {fileIcon(previewDoc.type)}
              <div className="text-fg-tertiary text-[11px]">{t("merchantReview.preview.mockPreview")}</div>
            </div>
            <div className="bg-subtle p-3 rounded-xl border border-line space-y-1.5">
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("merchantReview.preview.fileName")}</span><span className="font-mono text-fg truncate max-w-[220px]" title={previewDoc.name}>{previewDoc.name}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("merchantReview.preview.fileType")}</span><span className="text-fg">{previewDoc.type}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("merchantReview.preview.fileSize")}</span><span className="font-mono text-fg">{previewDoc.size}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">{t("merchantReview.preview.uploadedAt")}</span><span className="font-mono text-fg">{previewDoc.uploadedAt}</span></div>
            </div>
            <button className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-line text-fg-secondary rounded-lg text-xs font-medium hover:bg-hover">
              <Download className="w-3.5 h-3.5" /> {t("merchantReview.preview.download")}
            </button>
          </div>
        )}
      </SideSheet>
    </div>
  );
};
