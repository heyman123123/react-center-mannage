import React, { useEffect, useMemo, useState } from "react";
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

interface MerchantReviewViewProps {
  applications: MerchantApplication[];
}

const STATUS_META: Record<MerchantReviewStatus, { label: string; badge: string; icon: React.ReactNode }> = {
  PENDING: { label: "待审核", badge: "bg-amber-50 text-amber-700 border-amber-200", icon: <Hourglass className="w-3 h-3" /> },
  IN_REVIEW: { label: "审核中", badge: "bg-blue-50 text-blue-700 border-blue-200", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  APPROVED: { label: "已通过", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  REJECTED: { label: "已驳回", badge: "bg-rose-50 text-rose-700 border-rose-200", icon: <XCircle className="w-3 h-3" /> },
};

const fileIcon = (type: string) => {
  if (/图片|jpg|png|jpeg/i.test(type)) return <FileImage className="w-4 h-4 text-blue-500" />;
  if (/pdf|sheet|表/i.test(type)) return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
  return <File className="w-4 h-4 text-fg-tertiary" />;
};

export const MerchantReviewView: React.FC<MerchantReviewViewProps> = ({ applications }) => {
  const [rows, setRows] = useState<MerchantApplication[]>(applications);
  const [statusFilter, setStatusFilter] = useState<"ALL" | MerchantReviewStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewApp, setReviewApp] = useState<MerchantApplication | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewDoc, setPreviewDoc] = useState<MerchantDocument | null>(null);
  const { currentPage, setCurrentPage, reset, pageSize } = usePagination(10);
  useEffect(() => { reset(); }, [statusFilter, searchQuery, reset]);

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-line/80 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-fg tracking-tight">商户 / KYB 审核</h1>
          </div>
          <p className="text-xs text-fg-secondary mt-1 max-w-2xl">
            海外商户入驻与资料变更加 KYB 资质审核，核验营业执照、法人证件与银行证明文件。
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-fg-secondary">
          <span className="px-2.5 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-semibold border border-amber-200">待审核 {rows.filter((r) => r.status === "PENDING").length}</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-surface p-3 rounded-xl border border-line/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-fg-tertiary text-xs">状态:</span>
          {(["ALL", "PENDING", "IN_REVIEW", "APPROVED", "REJECTED"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-hover text-fg-secondary hover:bg-hover"}`}>
              {s === "ALL" ? "全部" : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-fg-tertiary" />
          <input type="text" placeholder="搜索公司名 / 国家..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-subtle border border-line rounded-lg text-xs" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-line/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-subtle/90 border-b border-line text-fg-secondary font-semibold text-[11px]">
                <th className="py-2 px-3">公司名称</th>
                <th className="py-2 px-3">国家</th>
                <th className="py-2 px-3">申请类型</th>
                <th className="py-2 px-3 text-center">资质文件</th>
                <th className="py-2 px-3">状态</th>
                <th className="py-2 px-3">申请时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {paginate<MerchantApplication>(filtered, currentPage, pageSize).map((a) => {
                const sm = STATUS_META[a.status];
                return (
                  <ContextMenu
                    key={a.id}
                    items={[
                      { key: "review", label: "审核", icon: <Eye className="w-3.5 h-3.5" />, onClick: () => openReview(a) },
                      { key: "detail", label: "查看详情", icon: <FileText className="w-3.5 h-3.5" />, onClick: () => openReview(a) },
                      { key: "refresh", label: "刷新", icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => setRows((prev) => [...prev]) },
                    ]}
                    trigger={
                      <tr onClick={() => openReview(a)} className="hover:bg-subtle/80 transition-colors cursor-pointer">
                        <td className="py-3 px-3 font-medium text-fg truncate max-w-[220px]" title={a.companyName}>{a.companyName}</td>
                        <td className="py-3 px-3 font-mono text-fg-secondary">{a.country}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-fg-secondary">{a.applyType === "NEW" ? "新入驻" : "资料变更"}</td>
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

      {/* 审核 SideSheet */}
      <SideSheet
        id="merchant-review"
        isOpen={!!reviewApp}
        onClose={() => setReviewApp(null)}
        title={reviewApp ? `KYB 审核 - ${reviewApp.companyName}` : "KYB 审核"}
        description={reviewApp ? `${reviewApp.country} · ${reviewApp.applyType === "NEW" ? "新入驻" : "资料变更"} · ${STATUS_META[reviewApp.status].label}` : ""}
        icon={<Building2 className="w-5 h-5 text-fg" />}
        widthClass="max-w-2xl max-md:max-w-none"
        footer={reviewApp && (reviewApp.status === "PENDING" || reviewApp.status === "IN_REVIEW") ? (
          <div className="flex items-center gap-2 w-full">
            <Popconfirm
              title="确认通过该商户入驻申请？"
              description={`通过后「${reviewApp.companyName}」将正式开通收款账户。`}
              confirmText="确认通过"
              okClassName="bg-emerald-600 hover:bg-emerald-700"
              onConfirm={() => approve(reviewApp.id)}
            >
              <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="w-3.5 h-3.5" /> 通过
              </button>
            </Popconfirm>
            <Popconfirm
              title="确认驳回该商户申请？"
              description={`驳回原因：${rejectReason || "（未填写）"}`}
              confirmText="确认驳回"
              onConfirm={() => reject(reviewApp.id)}
              align="center"
            >
              <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40" disabled={!rejectReason.trim()}>
                <XCircle className="w-3.5 h-3.5" /> 驳回
              </button>
            </Popconfirm>
            <button onClick={() => setReviewApp(null)} className="px-3 py-2 rounded-lg text-xs font-medium text-fg-secondary hover:bg-hover ml-auto">关闭</button>
          </div>
        ) : (
          <button onClick={() => setReviewApp(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">关闭</button>
        )}
      >
        {reviewApp && (
          <div className="space-y-4 text-xs">
            {/* 基本信息 */}
            <div className="bg-subtle p-3 rounded-xl border border-line space-y-1.5">
              <div className="flex justify-between"><span className="text-fg-tertiary">公司名称</span><span className="font-medium text-fg">{reviewApp.companyName}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">国家/地区</span><span className="font-mono text-fg">{reviewApp.country}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">联系人</span><span className="text-fg">{reviewApp.contactPerson}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">联系邮箱</span><span className="font-mono text-fg">{reviewApp.contactEmail}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">申请时间</span><span className="font-mono text-fg">{reviewApp.submittedAt}</span></div>
            </div>

            {/* 资质文件 */}
            <div>
              <div className="font-semibold text-fg mb-2">资质文件（{reviewApp.documents.length}）</div>
              <div className="space-y-1.5">
                {reviewApp.documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-subtle px-3 py-2 rounded-lg border border-line">
                    {fileIcon(doc.type)}
                    <button onClick={() => setPreviewDoc(doc)} className="text-fg font-medium hover:text-primary truncate text-left flex-1" title={doc.name}>
                      {doc.name}
                    </button>
                    <span className="text-[11px] text-fg-tertiary shrink-0">{doc.type}</span>
                    <button onClick={() => setPreviewDoc(doc)} className="p-1 text-fg-tertiary hover:text-primary shrink-0" title="查看">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 驳回原因 */}
            {reviewApp.status !== "APPROVED" && reviewApp.status !== "REJECTED" && (
              <div>
                <label className="block text-fg-secondary mb-1.5 font-medium">驳回原因（驳回时必填）</label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="请填写驳回原因，将通知商户..." className="w-full px-3 py-2 bg-subtle border border-line rounded-lg text-xs resize-none" />
              </div>
            )}
            {reviewApp.status === "REJECTED" && reviewApp.rejectReason && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-[11px]">驳回原因：{reviewApp.rejectReason}</div>
            )}
          </div>
        )}
      </SideSheet>

      {/* 资质文件预览（mock） */}
      <SideSheet
        id="merchant-doc-preview"
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title="资质文件预览"
        description={previewDoc ? previewDoc.type : ""}
        icon={<Paperclip className="w-5 h-5 text-fg" />}
        widthClass="max-w-md max-md:max-w-none"
        footer={<button onClick={() => setPreviewDoc(null)} className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold cursor-pointer">关闭</button>}
      >
        {previewDoc && (
          <div className="space-y-3 text-xs">
            {/* mock 预览占位 */}
            <div className="border-2 border-dashed border-line rounded-xl h-52 flex flex-col items-center justify-center gap-2 bg-subtle">
              {fileIcon(previewDoc.type)}
              <div className="text-fg-tertiary text-[11px]">文件预览（Mock）</div>
            </div>
            <div className="bg-subtle p-3 rounded-xl border border-line space-y-1.5">
              <div className="flex justify-between"><span className="text-fg-tertiary">文件名</span><span className="font-mono text-fg truncate max-w-[220px]" title={previewDoc.name}>{previewDoc.name}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">文件类型</span><span className="text-fg">{previewDoc.type}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">文件大小</span><span className="font-mono text-fg">{previewDoc.size}</span></div>
              <div className="flex justify-between"><span className="text-fg-tertiary">上传时间</span><span className="font-mono text-fg">{previewDoc.uploadedAt}</span></div>
            </div>
            <button className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-line text-fg-secondary rounded-lg text-xs font-medium hover:bg-hover">
              <Download className="w-3.5 h-3.5" /> 下载原件（Mock）
            </button>
          </div>
        )}
      </SideSheet>
    </div>
  );
};
