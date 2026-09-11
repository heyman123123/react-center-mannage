import React, { useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  Scale,
  CreditCard,
  Webhook,
  Layers,
  Mail,
  MailCheck,
  Languages,
  Users,
  Building2,
  ShieldCheck,
  ChevronDown,
  Check,
  Shield,
  Sparkles,
  Search,
  Globe,
  ShoppingBag,
  Tag,
  Megaphone,
  BookOpen,
  FolderTree,
  Settings,
} from "lucide-react";
import { Tenant, SystemUser } from "../types/payment";
import { RBAC_ROLES } from "../data/mockData";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  tenants?: Tenant[];
  currentTenant?: Tenant;
  setCurrentTenant?: (tenant: Tenant) => void;
  currentUser: SystemUser;
  onOpenUserSettings: () => void;
  onOpenQuickCreate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  onOpenUserSettings,
}) => {
  const currentRole = RBAC_ROLES[currentUser.roleKey] || {
    name: currentUser.role,
  };

  const navSections = [
    {
      title: "核心业务",
      items: [
        { id: "dashboard", path: "/dashboard", label: "概览看板", icon: LayoutDashboard },
        { id: "transactions", path: "/transactions", label: "交易流水与时间轴", icon: Receipt },
        { id: "reconciliation", path: "/reconciliation", label: "跨境对账中心", icon: Scale, badge: "1" },
        { id: "users", path: "/users", label: "终端客户与行为大盘", icon: Users },
      ],
    },
    {
      title: "商品与促销",
      items: [
        { id: "products", path: "/products", label: "商品方案配置", icon: ShoppingBag },
        { id: "discounts", path: "/discounts", label: "折扣与优惠券配置", icon: Tag },
        { id: "promo_campaigns", path: "/promo-campaigns", label: "促销邮件配置", icon: Megaphone },
      ],
    },
    {
      title: "支付与网关",
      items: [
        { id: "payment_channels", path: "/payment-channels", label: "支付渠道配置", icon: CreditCard },
        { id: "payment_webhooks", path: "/payment-webhooks", label: "支付 Webhook 调度", icon: Webhook },
        { id: "apps", path: "/apps", label: "接入应用管理", icon: Layers },
      ],
    },
    {
      title: "国际化与邮件",
      items: [
        { id: "dictionary", path: "/dictionary", label: "系统字典管理", icon: BookOpen },
        { id: "email_templates", path: "/email-templates", label: "多语言邮件管理", icon: Languages },
        { id: "email_channels", path: "/email-channels", label: "邮件渠道配置", icon: Mail },
        { id: "email_webhooks", path: "/email-webhooks", label: "邮件投递与回执", icon: MailCheck },
      ],
    },
    {
      title: "系统与权限",
      items: [
        { id: "roles", path: "/roles", label: "RBAC 角色管理", icon: ShieldCheck },
        { id: "menus", path: "/menus", label: "系统菜单管理", icon: FolderTree },
        { id: "system_users", path: "/system-users", label: "用户管理与权限", icon: Users },
      ],
    },
  ];

  return (
    <aside
      id="main-sidebar"
      className="w-64 h-screen bg-white border-r border-zinc-200/80 flex flex-col justify-between shrink-0 select-none text-zinc-900 font-sans"
    >
      {/* Top Section */}
      <div className="p-3.5 flex flex-col gap-3 overflow-y-auto flex-1">
        {/* Overseas Platform Identity */}
        <div className="flex items-center gap-2.5 p-2 rounded-xl border border-zinc-100 bg-zinc-50/60">
          <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <div className="truncate">
            <div className="font-bold text-xs text-zinc-900 truncate">
              全球聚合支付中台
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">
              Global PayHub • Overseas
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-4 pt-1">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-2.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                {section.title}
              </div>
              <nav className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentTab(item.id)}
                      data-path={item.path}
                      title={`${item.label} (${item.path})`}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all text-left group ${
                        isActive
                          ? "bg-zinc-100 text-zinc-950 font-bold shadow-2xs"
                          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 font-medium"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? "text-zinc-950" : "text-zinc-400 group-hover:text-zinc-700"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.badge && (
                          <span className="text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.2 rounded-full">
                            {item.badge}
                          </span>
                        )}
                        <span className="text-[9px] font-mono text-zinc-400 opacity-0 group-hover:opacity-75 transition-opacity">
                          {item.path}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom User Card - Opens User Profile Settings (Avatar, Password, etc.) */}
      <div className="p-3 border-t border-zinc-200/80 bg-zinc-50/50">
        <button
          id="user-profile-settings-btn"
          onClick={onOpenUserSettings}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-100 transition-colors text-left group bg-white border border-zinc-200/60 shadow-2xs cursor-pointer"
          title="点击打开个人账户设置（修改头像、修改密码等）"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-zinc-300"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-zinc-300">
                {currentUser.avatarText || currentUser.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <div className="font-bold text-xs text-zinc-900 truncate group-hover:text-blue-600 transition-colors">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                <Shield className="w-2.5 h-2.5 text-blue-600" />
                <span>{currentRole.name ? currentRole.name.split(" ")[0] : currentUser.role}</span>
              </div>
            </div>
          </div>
          <div className="p-1 rounded-lg text-zinc-400 group-hover:text-zinc-900 group-hover:bg-zinc-100 transition-colors shrink-0">
            <Settings className="w-4 h-4" />
          </div>
        </button>
      </div>
    </aside>
  );
};
