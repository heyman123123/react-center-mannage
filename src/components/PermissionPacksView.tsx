import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useViewLoading } from "./ui/useViewLoading";
import { TableSkeleton } from "./ui/Skeletons";
import {
  KeyRound,
  Package,
  CheckCircle2,
  Save,
  AlertTriangle,
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
} from "lucide-react";
import type { PermissionPack, SystemMenuItem } from "../types/payment";
import { MenuPermissionTree } from "./MenuPermissionTree";
import { SideSheet } from "./ui/SideSheet";
import { Popconfirm } from "./ui/Popconfirm";

interface PermissionPacksViewProps {
  packs: PermissionPack[];
  menus: SystemMenuItem[];
  onSavePack: (pack: PermissionPack, isNew: boolean) => Promise<PermissionPack | void> | PermissionPack | void;
  onDeletePack?: (packId: string) => Promise<void> | void;
  onSavePackMenus?: (packId: string, menuIds: string[]) => Promise<PermissionPack | void> | PermissionPack | void;
}

const packIdOf = (pack: PermissionPack) => pack.id || pack.key || "";

export const PermissionPacksView: React.FC<PermissionPacksViewProps> = ({
  packs,
  menus,
  onSavePack,
  onDeletePack,
  onSavePackMenus,
}) => {
  const { t } = useTranslation(["rbac", "common"]);
  const [packList, setPackList] = useState<PermissionPack[]>(packs);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<PermissionPack | null>(null);
  const [formKey, setFormKey] = useState("");
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");

  const [isMenuSheetOpen, setIsMenuSheetOpen] = useState(false);
  const [menuPack, setMenuPack] = useState<PermissionPack | null>(null);
  const [menuCheckedIds, setMenuCheckedIds] = useState<string[]>([]);

  useEffect(() => {
    setPackList(packs);
  }, [packs]);

  const filteredPacks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return packList;
    return packList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q),
    );
  }, [packList, searchQuery]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const openMenuSheet = (pack: PermissionPack) => {
    setMenuPack(pack);
    setMenuCheckedIds([...(pack.menuIds || [])]);
    setIsMenuSheetOpen(true);
  };

  const openCreate = () => {
    setEditingPack(null);
    setFormKey("");
    setFormName("");
    setFormDesc("");
    setIsFormOpen(true);
  };

  const openEdit = (pack: PermissionPack) => {
    setEditingPack(pack);
    setFormKey(pack.key);
    setFormName(pack.name);
    setFormDesc(pack.description || "");
    setIsFormOpen(true);
  };

  const handleSubmitForm = async () => {
    const name = formName.trim();
    const key = formKey.trim().toUpperCase().replace(/\s+/g, "_");
    if (!name) {
      showToast(t("packs.toast.nameRequired"));
      return;
    }
    if (!editingPack && !key) {
      showToast(t("packs.toast.keyRequired"));
      return;
    }

    setSaving(true);
    try {
      if (editingPack) {
        const updated: PermissionPack = {
          ...editingPack,
          name,
          description: formDesc.trim(),
        };
        const saved = (await onSavePack(updated, false)) || updated;
        setPackList((prev) =>
          prev.map((p) => (packIdOf(p) === packIdOf(editingPack) ? saved : p)),
        );
        showToast(t("packs.toast.updated", { name: saved.name }));
      } else {
        const draft: PermissionPack = {
          id: `pack_${Date.now().toString().slice(-6)}`,
          key,
          name,
          description: formDesc.trim(),
          menuIds: [],
        };
        const saved = (await onSavePack(draft, true)) || draft;
        setPackList((prev) => [...prev, saved]);
        showToast(t("packs.toast.created", { name: saved.name }));
        openMenuSheet(saved);
      }
      setIsFormOpen(false);
    } catch {
      showToast(t("packs.toast.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMenus = async () => {
    if (!menuPack) return;
    setSaving(true);
    try {
      const updated: PermissionPack = { ...menuPack, menuIds: menuCheckedIds };
      const saved =
        (onSavePackMenus
          ? await onSavePackMenus(packIdOf(menuPack), menuCheckedIds)
          : await onSavePack(updated, false)) || updated;
      setPackList((prev) =>
        prev.map((p) => (packIdOf(p) === packIdOf(menuPack) ? { ...p, ...saved, menuIds: saved.menuIds ?? menuCheckedIds } : p)),
      );
      setMenuPack({ ...menuPack, ...saved, menuIds: saved.menuIds ?? menuCheckedIds });
      showToast(t("packs.toast.menusSaved", { name: menuPack.name }));
    } catch {
      showToast(t("packs.toast.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pack: PermissionPack) => {
    const id = packIdOf(pack);
    try {
      if (onDeletePack) await onDeletePack(id);
      setPackList((prev) => prev.filter((p) => packIdOf(p) !== id));
      if (menuPack && packIdOf(menuPack) === id) {
        setIsMenuSheetOpen(false);
        setMenuPack(null);
      }
      showToast(t("packs.toast.deleted", { name: pack.name }));
    } catch {
      showToast(t("packs.toast.deleteFailed"));
    }
  };

  const handleRefresh = () => {
    setPackList(packs);
    showToast(t("packs.toast.refreshed"));
  };

  const loading = useViewLoading();
  if (loading) return <TableSkeleton rows={8} />;

  if (packList.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-fg-tertiary space-y-3">
        <div>{t("packs.empty.noPacks")}</div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          {t("packs.addPack")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-primary text-primary-foreground px-3 py-2.5 rounded shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="bg-surface border border-line rounded-md shadow-card px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            className="px-3 py-1.5 border border-line hover:bg-hover text-fg-secondary rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title={t("common:actions.refresh")}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t("common:actions.refresh")}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("packs.addPack")}
          </button>
        </div>
        <div className="relative w-56">
          <Search className="w-3 h-3 text-fg-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t("packs.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 text-xs bg-subtle border border-line rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="bg-surface border border-line rounded-md shadow-card px-3 py-2 flex items-start gap-2 text-xs text-fg-secondary">
        <KeyRound className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <span>{t("packs.infoBanner")}</span>
      </div>

      <div className="bg-surface border border-line rounded-md shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-subtle border-b border-line text-left text-fg-secondary">
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">{t("packs.table.name")}</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">{t("packs.table.key")}</th>
                <th className="px-3 py-2.5 font-semibold min-w-[160px]">{t("packs.table.description")}</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap text-center">{t("packs.table.menuCount")}</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap text-right">{t("packs.table.operations")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPacks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-fg-tertiary">
                    {t("packs.empty.noMatch")}
                  </td>
                </tr>
              ) : (
                filteredPacks.map((pack) => {
                  const id = packIdOf(pack);
                  const menuCount = (pack.menuIds || []).length;
                  return (
                    <tr
                      key={id}
                      onClick={() => openMenuSheet(pack)}
                      className="border-b border-line-subtle last:border-b-0 hover:bg-hover/60 transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-3 font-semibold text-fg whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded bg-subtle border border-line-subtle flex items-center justify-center shrink-0">
                            <Package className="w-3.5 h-3.5 text-fg-secondary" />
                          </span>
                          {pack.name}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-fg-secondary whitespace-nowrap">{pack.key}</td>
                      <td className="px-3 py-3 text-fg-secondary max-w-xs">
                        <span className="line-clamp-2">{pack.description || "—"}</span>
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-fg-secondary">
                        {t("packs.menuCountUnit", { count: menuCount })}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openMenuSheet(pack)}
                            className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          >
                            {t("packs.configureMenus")}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(pack)}
                            className="p-1 text-fg-secondary hover:text-fg hover:bg-hover rounded transition-colors cursor-pointer"
                            title={t("common:actions.edit")}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <Popconfirm
                            title={t("packs.confirm.deleteTitle", { name: pack.name })}
                            description={t("packs.confirm.deleteDesc")}
                            onConfirm={() => void handleDelete(pack)}
                          >
                            <button
                              type="button"
                              className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title={t("common:actions.delete")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </Popconfirm>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SideSheet
        id="side-sheet-pack-menus"
        isOpen={isMenuSheetOpen}
        onClose={() => setIsMenuSheetOpen(false)}
        title={
          menuPack
            ? t("packs.menuSheet.title", { name: menuPack.name })
            : t("packs.configureMenus")
        }
        description={t("packs.menuSheet.description")}
        icon={<KeyRound className="w-5 h-5 text-blue-600" />}
        widthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsMenuSheetOpen(false)}
              className="px-3 py-2 border border-line text-fg-secondary rounded hover:bg-hover font-semibold cursor-pointer text-xs"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveMenus()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" />
              {t("packs.menuSheet.save")}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <FolderTree className="w-3.5 h-3.5 text-blue-600" />
                  </span>
                  {t("packs.menuSheet.hint")}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuCheckedIds(menus.map((m) => m.id))}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                >
                  {t("common:actions.selectAll")}
                </button>
                <span className="text-zinc-300">|</span>
                <button
                  type="button"
                  onClick={() => setMenuCheckedIds([])}
                  className="text-[11px] text-fg-secondary hover:text-fg font-semibold cursor-pointer"
                >
                  {t("common:actions.clear")}
                </button>
              </div>
            </div>
            <MenuPermissionTree
              menus={menus}
              checkedIds={menuCheckedIds}
              onChange={setMenuCheckedIds}
            />
          </div>
          <div className="flex items-start gap-2 p-3 rounded border border-line-subtle bg-subtle/50 text-fg-secondary">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>{t("packs.menuSheet.summary", { menuCount: menuCheckedIds.length })}</span>
          </div>
        </div>
      </SideSheet>

      <SideSheet
        id="side-sheet-pack-crud"
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={
          editingPack
            ? t("packs.form.editTitle", { name: editingPack.name })
            : t("packs.form.createTitle")
        }
        description={
          editingPack ? t("packs.form.editDescription") : t("packs.form.createHint")
        }
        icon={<Package className="w-5 h-5 text-amber-500" />}
        widthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-3 py-2 border border-line text-fg-secondary rounded hover:bg-hover font-semibold cursor-pointer text-xs"
            >
              {t("common:actions.cancel")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSubmitForm()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold cursor-pointer text-xs disabled:opacity-60"
            >
              {editingPack ? t("packs.form.save") : t("packs.form.create")}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {!editingPack && (
            <div>
              <label className="font-semibold text-fg-secondary block mb-1">
                {t("packs.form.key")} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder={t("packs.form.keyPlaceholder")}
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                className="w-full p-2 bg-surface border border-line rounded text-xs focus:outline-none focus:ring-1 focus:ring-line font-mono"
              />
              <p className="text-[11px] text-fg-tertiary mt-1">{t("packs.form.keyHint")}</p>
            </div>
          )}
          <div>
            <label className="font-semibold text-fg-secondary block mb-1">
              {t("packs.form.name")} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={t("packs.form.namePlaceholder")}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full p-2 bg-surface border border-line rounded text-xs focus:outline-none focus:ring-1 focus:ring-line"
            />
          </div>
          <div>
            <label className="font-semibold text-fg-secondary block mb-1">
              {t("packs.form.description")}
            </label>
            <textarea
              rows={3}
              placeholder={t("packs.form.descPlaceholder")}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="w-full p-2 bg-surface border border-line rounded text-xs focus:outline-none focus:ring-1 focus:ring-line"
            />
          </div>
        </div>
      </SideSheet>
    </div>
  );
};
