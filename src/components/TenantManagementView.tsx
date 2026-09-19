import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, PlusCircle, Pencil, Trash2, Search } from "lucide-react";
import { TableSkeleton } from "./ui/Skeletons";
import { Pagination, paginate, usePagination } from "./ui/Pagination";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { Popconfirm } from "./ui/Popconfirm";
import type { Tenant } from "../types/payment";
import * as tenantsApi from "../api/modules/tenants";
import { fetchTenantList } from "../lib/tenants";

const ISOLATION_OPTIONS = [
  "STRICT_ISOLATED",
  "LOGICAL_TENANT",
  "GROUP_CONSOLIDATED",
] as const;

const emptyForm = {
  id: "",
  name: "",
  code: "",
  currency: "USD",
  color: "#0284c7",
  dailyCap: "",
  description: "",
  isolationLevel: "LOGICAL_TENANT" as Tenant["isolationLevel"],
};

interface TenantManagementViewProps {
  onTenantsChange?: (tenants: Tenant[]) => void;
}

export const TenantManagementView: React.FC<TenantManagementViewProps> = ({
  onTenantsChange,
}) => {
  const { t } = useTranslation(["tenants", "common"]);
  const [rows, setRows] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { currentPage, setCurrentPage, reset, pageSize, setPageSize } = usePagination(10);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchTenantList();
      setRows(list);
      onTenantsChange?.(list);
    } catch {
      showToast(t("toast.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [onTenantsChange, t]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    reset();
  }, [search, reset]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const pageRows = paginate(filtered, currentPage, pageSize);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSheetOpen(true);
  };

  const openEdit = (row: Tenant) => {
    setEditing(row);
    setForm({
      id: row.id,
      name: row.name,
      code: row.code,
      currency: row.currency,
      color: row.color,
      dailyCap: String(row.dailyCap),
      description: row.description,
      isolationLevel: row.isolationLevel,
    });
    setSheetOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id.trim() || !form.name.trim() || !form.code.trim()) {
      showToast(t("toast.fillRequired"));
      return;
    }
    const body = {
      id: form.id.trim(),
      name: form.name.trim(),
      code: form.code.trim(),
      currency: form.currency.trim() || "USD",
      color: form.color,
      description: form.description.trim(),
      dailyCap: Number(form.dailyCap) || 0,
      isolationLevel: form.isolationLevel,
      activeMerchantsCount: 0,
    };
    try {
      if (editing) {
        await tenantsApi.updateTenant(editing.id, body);
      } else {
        await tenantsApi.createTenant({ ...body, id: body.id });
      }
      showToast(t("toast.saved"));
      setSheetOpen(false);
      await loadRows();
    } catch {
      showToast(t("toast.saveFailed", { defaultValue: t("toast.loadFailed") }));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await tenantsApi.deleteTenant(id);
      showToast(t("toast.deleted"));
      await loadRows();
    } catch {
      showToast(t("toast.deleteFailed"));
    }
  };

  if (loading && rows.length === 0) {
    return <TableSkeleton rows={8} cols={6} />;
  }

  return (
    <div className="space-y-4">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-fg text-bg rounded-lg shadow-lg text-sm">
          {toastMessage}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-fg flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {t("title")}
          </h1>
          <p className="text-xs text-fg-secondary mt-1 max-w-3xl">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary-hover cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          {t("addTenant")}
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full pl-9 pr-3 py-2 text-xs border border-line rounded-lg bg-subtle text-fg"
        />
      </div>

      <div className="bg-card border border-line rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-subtle text-fg-secondary">
            <tr>
              <th className="text-left py-3 px-3 font-medium">{t("columns.name")}</th>
              <th className="text-left py-3 px-3 font-medium">{t("columns.code")}</th>
              <th className="text-left py-3 px-3 font-medium">{t("columns.currency")}</th>
              <th className="text-left py-3 px-3 font-medium">{t("columns.isolation")}</th>
              <th className="text-left py-3 px-3 font-medium">{t("columns.dailyCap")}</th>
              <th className="text-right py-3 px-3 font-medium">{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id} className="border-t border-line hover:bg-subtle/60">
                <td className="py-3 px-3 whitespace-nowrap">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="font-medium text-fg">{row.name}</span>
                </td>
                <td className="py-3 px-3 font-mono text-fg-secondary whitespace-nowrap">{row.code}</td>
                <td className="py-3 px-3 whitespace-nowrap">{row.currency}</td>
                <td className="py-3 px-3 whitespace-nowrap">
                  {t(`isolation.${row.isolationLevel}`)}
                </td>
                <td className="py-3 px-3 font-mono whitespace-nowrap">
                  {row.dailyCap.toLocaleString()}
                </td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="p-1.5 rounded hover:bg-hover text-fg-secondary cursor-pointer"
                    title={t("common:actions.edit")}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {row.id !== "group_hq" && (
                    <Popconfirm
                      title={t("confirmDelete")}
                      onConfirm={() => void handleDelete(row.id)}
                    >
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer ml-1"
                        title={t("common:actions.delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </Popconfirm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          totalItems={filtered.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <SideSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? t("sheet.editTitle") : t("sheet.createTitle")}
        description={t("sheet.description")}
        icon={<Building2 className="w-5 h-5" />}
        footer={
          <>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="px-3 py-2 border border-line rounded-lg text-xs font-medium cursor-pointer"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="submit"
              form="form-tenant"
              className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium cursor-pointer"
            >
              {t("common:actions.save")}
            </button>
          </>
        }
      >
        <form id="form-tenant" onSubmit={(e) => void handleSave(e)} className="space-y-3 text-xs">
          <div>
            <label className="block mb-1 font-medium text-fg-secondary">{t("sheet.id")}</label>
            <input
              value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              disabled={!!editing}
              placeholder={t("sheet.idPlaceholder")}
              className="w-full px-3 py-2 border border-line rounded-lg bg-subtle font-mono disabled:opacity-60"
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-fg-secondary">{t("sheet.name")}</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-line rounded-lg bg-subtle"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block mb-1 font-medium text-fg-secondary">{t("sheet.code")}</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="w-full px-3 py-2 border border-line rounded-lg bg-subtle font-mono"
                required
              />
            </div>
            <div>
              <label className="block mb-1 font-medium text-fg-secondary">{t("sheet.currency")}</label>
              <input
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 border border-line rounded-lg bg-subtle font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block mb-1 font-medium text-fg-secondary">{t("sheet.isolationLevel")}</label>
            <ShadcnSelect
              value={form.isolationLevel}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, isolationLevel: v as Tenant["isolationLevel"] }))
              }
              options={ISOLATION_OPTIONS.map((k) => ({
                value: k,
                label: t(`isolation.${k}`),
              }))}
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-fg-secondary">{t("sheet.dailyCap")}</label>
            <input
              type="number"
              value={form.dailyCap}
              onChange={(e) => setForm((f) => ({ ...f, dailyCap: e.target.value }))}
              className="w-full px-3 py-2 border border-line rounded-lg bg-subtle font-mono"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium text-fg-secondary">{t("sheet.descriptionLabel")}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-line rounded-lg bg-subtle resize-none"
            />
          </div>
        </form>
      </SideSheet>
    </div>
  );
};
