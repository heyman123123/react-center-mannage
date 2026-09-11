import React, { useState } from "react";
import {
  Tag,
  Plus,
  Search,
  Filter,
  Copy,
  Check,
  Calendar,
  Percent,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { DiscountConfig, DiscountType, Tenant } from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";

interface DiscountsViewProps {
  discounts: DiscountConfig[];
  currentTenant: Tenant;
  onSaveDiscount: (discount: DiscountConfig) => void;
}

export const DiscountsView: React.FC<DiscountsViewProps> = ({
  discounts,
  currentTenant,
  onSaveDiscount,
}) => {
  const [discountList, setDiscountList] = useState<DiscountConfig[]>(discounts);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<DiscountType>("PERCENTAGE");
  const [formValue, setFormValue] = useState<number>(20);
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formMinOrder, setFormMinOrder] = useState<number>(0);
  const [formMaxUsage, setFormMaxUsage] = useState<number>(1000);
  const [formStartDate, setFormStartDate] = useState("2026-01-01");
  const [formEndDate, setFormEndDate] = useState("2026-12-31");
  const [formScope, setFormScope] = useState<"ALL" | "SUBSCRIPTION_ONLY" | "BU_SPECIFIC">("ALL");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenAdd = () => {
    setEditingDiscount(null);
    setFormCode(`SAVE${Math.floor(10 + Math.random() * 80)}`);
    setFormName("");
    setFormType("PERCENTAGE");
    setFormValue(20);
    setFormCurrency("USD");
    setFormMinOrder(0);
    setFormMaxUsage(500);
    setFormStartDate(new Date().toISOString().slice(0, 10));
    setFormEndDate("2026-12-31");
    setFormScope("ALL");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (d: DiscountConfig) => {
    setEditingDiscount(d);
    setFormCode(d.code);
    setFormName(d.name);
    setFormType(d.type);
    setFormValue(d.value);
    setFormCurrency(d.currency || "USD");
    setFormMinOrder(d.minOrderAmount);
    setFormMaxUsage(d.maxUsageLimit);
    setFormStartDate(d.startDate);
    setFormEndDate(d.endDate);
    setFormScope(d.applicableScope);
    setIsModalOpen(true);
  };

  const handleToggleStatus = (d: DiscountConfig) => {
    const nextStatus = d.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const updated: DiscountConfig = { ...d, status: nextStatus };
    setDiscountList((prev) => prev.map((item) => (item.id === d.id ? updated : item)));
    onSaveDiscount(updated);
    showToast(`折扣码【${d.code}】已${nextStatus === "ACTIVE" ? "重新启用" : "停用"}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingDiscount) {
      const updated: DiscountConfig = {
        ...editingDiscount,
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        type: formType,
        value: Number(formValue) || 0,
        currency: formCurrency,
        minOrderAmount: Number(formMinOrder) || 0,
        maxUsageLimit: Number(formMaxUsage) || 0,
        startDate: formStartDate,
        endDate: formEndDate,
        applicableScope: formScope,
      };
      setDiscountList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      onSaveDiscount(updated);
      showToast(`优惠折扣【${updated.code}】修改成功！`);
    } else {
      const newDiscount: DiscountConfig = {
        id: `disc_${Date.now().toString().slice(-6)}`,
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        type: formType,
        value: Number(formValue) || 0,
        currency: formCurrency,
        minOrderAmount: Number(formMinOrder) || 0,
        maxUsageLimit: Number(formMaxUsage) || 0,
        usedCount: 0,
        startDate: formStartDate,
        endDate: formEndDate,
        applicableScope: formScope,
        status: "ACTIVE",
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setDiscountList((prev) => [newDiscount, ...prev]);
      onSaveDiscount(newDiscount);
      showToast(`新折扣码【${newDiscount.code}】创建成功！`);
    }
    setIsModalOpen(false);
  };

  const filteredDiscounts = discountList.filter((d) => {
    const matchesSearch =
      d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "ALL" || d.type === typeFilter;
    const matchesStatus = statusFilter === "ALL" || d.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const activeCount = discountList.filter((d) => d.status === "ACTIVE").length;
  const totalRedeemed = discountList.reduce((acc, curr) => acc + curr.usedCount, 0);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <Tag className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              海外折扣与优惠码配置 (Discounts & Coupons)
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            配置全场百分比折扣（如 20% OFF）或固定立减优惠券（如 -$50），支持限制使用次数、最低订单门槛与生效期限，全渠道收银台实时校验。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建优惠券 / 折扣码</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>生效中折扣方案</span>
            <Tag className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-1">
            {activeCount} <span className="text-xs font-normal text-zinc-400">/ {discountList.length} 条</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">支持独立站结账页实时输入校验</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>海外用户累计核销次数</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-1">
            {totalRedeemed.toLocaleString()} <span className="text-xs font-normal text-zinc-400">次使用</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">有效提升海外结账转化率与客单价</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>促销活动结合联动</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 mt-1">
            100% <span className="text-xs font-normal text-zinc-400">支持邮件一键绑定</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">可直接挂载至多语言促销邮件营销推送</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-zinc-400 text-xs">类型筛选:</span>
          {[
            { key: "ALL", label: "全部折扣" },
            { key: "PERCENTAGE", label: "百分比折扣 (%)" },
            { key: "FIXED_AMOUNT", label: "固定立减 ($/€)" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                typeFilter === tab.key
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <span className="text-zinc-300 mx-1">|</span>

          <span className="text-zinc-400 text-xs">状态:</span>
          {[
            { key: "ALL", label: "全部" },
            { key: "ACTIVE", label: "进行中" },
            { key: "EXPIRED", label: "已过期" },
            { key: "DISABLED", label: "已停用" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-zinc-800 text-white font-bold"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            placeholder="搜索优惠码 / 方案名称..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Discounts Table */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/90 border-b border-zinc-200 text-zinc-500 font-semibold text-[11px]">
                <th className="py-3 px-4 w-[220px]">优惠码 (Promo Code)</th>
                <th className="py-3 px-4 min-w-[200px]">折扣名称 & 适用范围</th>
                <th className="py-3 px-4 w-[130px]">优惠力度</th>
                <th className="py-3 px-4 w-[120px]">门槛条件</th>
                <th className="py-3 px-4 w-[160px]">使用进度 (已用 / 限额)</th>
                <th className="py-3 px-4 w-[170px]">有效期限</th>
                <th className="py-3 px-4 w-[100px]">状态</th>
                <th className="py-3 px-4 w-[140px] sticky right-0 z-20 bg-zinc-50/95 backdrop-blur-xs text-right shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredDiscounts.map((d) => {
                const percentUsed = Math.min(100, Math.round((d.usedCount / d.maxUsageLimit) * 100));
                const isCopied = copiedCode === d.code;
                return (
                  <tr key={d.id} className="hover:bg-zinc-50/80 transition-colors group">
                    <td className="py-3.5 px-4 w-[220px] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                          {d.code}
                        </span>
                        <button
                          onClick={() => handleCopyCode(d.code)}
                          className="p-1 text-zinc-400 hover:text-zinc-700 rounded transition-colors"
                          title="复制优惠码"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 min-w-[200px]">
                      <div className="font-semibold text-zinc-900 line-clamp-1">{d.name}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                        {d.applicableScope === "ALL"
                          ? "全场所有商品与订阅"
                          : d.applicableScope === "SUBSCRIPTION_ONLY"
                          ? "仅限周期性订阅方案 (Subscription Only)"
                          : "仅限指定业务单元"}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 w-[130px] whitespace-nowrap">
                      <div className="font-bold font-mono text-zinc-900">
                        {d.type === "PERCENTAGE" ? (
                          <span className="text-rose-600">{d.value}% 折扣</span>
                        ) : (
                          <span className="text-emerald-600">
                            立减 {d.currency === "USD" ? "$" : d.currency}
                            {d.value}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 w-[120px] whitespace-nowrap text-zinc-600">
                      {d.minOrderAmount > 0 ? (
                        <span>
                          满 ${d.minOrderAmount} 可用
                        </span>
                      ) : (
                        <span className="text-zinc-400">无门槛</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 w-[160px]">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span className="font-bold text-zinc-800">{d.usedCount}</span>
                        <span className="text-zinc-400">/ {d.maxUsageLimit}</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            percentUsed >= 90
                              ? "bg-rose-500"
                              : percentUsed >= 50
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${percentUsed}%` }}
                        />
                      </div>
                    </td>

                    <td className="py-3.5 px-4 w-[170px] whitespace-nowrap text-[11px] font-mono text-zinc-500">
                      <div>{d.startDate} 至</div>
                      <div>{d.endDate}</div>
                    </td>

                    <td className="py-3.5 px-4 w-[100px] whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          d.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : d.status === "EXPIRED"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-zinc-100 text-zinc-500 border-zinc-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            d.status === "ACTIVE"
                              ? "bg-emerald-500"
                              : d.status === "EXPIRED"
                              ? "bg-amber-500"
                              : "bg-zinc-400"
                          }`}
                        />
                        {d.status === "ACTIVE"
                          ? "生效中"
                          : d.status === "EXPIRED"
                          ? "已过期"
                          : "已停用"}
                      </span>
                    </td>

                    {/* Actions: Sticky Right */}
                    <td className="py-3.5 px-4 w-[140px] sticky right-0 z-10 bg-white group-hover:bg-zinc-50/95 backdrop-blur-xs text-right whitespace-nowrap shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(d)}
                          className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                          title="编辑折扣配置"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(d)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            d.status === "ACTIVE"
                              ? "text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                              : "text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={d.status === "ACTIVE" ? "停用该券" : "启用该券"}
                        >
                          {d.status === "ACTIVE" ? "停用" : "启用"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Discount SideSheet */}
      {isModalOpen && (
        <SideSheet
          id="side-sheet-discount-edit"
          isOpen={true}
          onClose={() => setIsModalOpen(false)}
          title={editingDiscount ? `编辑优惠码: ${editingDiscount.code}` : "创建新折扣方案"}
          description="设定出海收银台优惠兑换码、折扣额度与适用规则"
          icon={<Tag className="w-5 h-5 text-rose-600" />}
          widthClass="max-w-lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 font-medium cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
              >
                {editingDiscount ? "保存更新" : "确认创建"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  优惠兑换码 (Promo Code):
                </label>
                <input
                  type="text"
                  required
                  placeholder="如：BLACKFRIDAY30"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg font-mono font-bold text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  折扣类型:
                </label>
                <ShadcnSelect
                  value={formType}
                  onValueChange={(val) => setFormType(val as DiscountType)}
                  options={[
                    { value: "PERCENTAGE", label: "百分比折扣 (Percentage %)" },
                    { value: "FIXED_AMOUNT", label: "固定金额立减 (Fixed Amount)" },
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-zinc-700 block mb-1">
                折扣名称 / 活动标题:
              </label>
              <input
                type="text"
                required
                placeholder="如：2026 黑五大促 7 折狂欢"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  {formType === "PERCENTAGE" ? "折扣比例 (%)" : "立减金额 ($)"}:
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={formValue}
                  onChange={(e) => setFormValue(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  最低消费门槛 ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMinOrder}
                  onChange={(e) => setFormMinOrder(parseFloat(e.target.value) || 0)}
                  placeholder="0 表示无门槛"
                  className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  总限量使用次数:
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formMaxUsage}
                  onChange={(e) => setFormMaxUsage(parseInt(e.target.value) || 100)}
                  className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  适用业务范围:
                </label>
                <ShadcnSelect
                  value={formScope}
                  onValueChange={(val) => setFormScope(val as any)}
                  options={[
                    { value: "ALL", label: "全场所有商品与订阅" },
                    { value: "SUBSCRIPTION_ONLY", label: "仅限周期订阅 (Subscription)" },
                    { value: "BU_SPECIFIC", label: "所属业务单元专属" },
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  生效开始时间:
                </label>
                <input
                  type="date"
                  required
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
              <div>
                <label className="font-semibold text-zinc-700 block mb-1">
                  失效截止时间:
                </label>
                <input
                  type="date"
                  required
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
            </div>
          </form>
        </SideSheet>
      )}
    </div>
  );
};
