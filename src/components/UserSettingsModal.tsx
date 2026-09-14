import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  User,
  Lock,
  Camera,
  Check,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Mail,
  Building,
  Globe,
  Clock,
  Laptop,
  Key,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { UserProfileSettings, SystemUser } from "../types/payment";
import { SideSheet } from "./ui/SideSheet";
import { ShadcnSelect } from "./ui/select";
import { getStoredTheme, applyTheme, ThemeMode } from "../lib/theme";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SystemUser;
  onSaveProfile: (profile: UserProfileSettings) => void;
  onLogout?: () => void;
}

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
];

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "America/New_York (EST, UTC-5)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST, UTC-8)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST, UTC+0/+1)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET, UTC+1)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+9)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST, UTC+8)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+8)" },
];

function useLocaleOptions() {
  const { t } = useTranslation("settings");
  return [
    { value: "zh-CN", label: t("profile.localeOptions.zhCN") },
    { value: "en-US", label: t("profile.localeOptions.enUS") },
    { value: "ja-JP", label: t("profile.localeOptions.jaJP") },
  ];
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaveProfile,
  onLogout,
}) => {
  const { t } = useTranslation(["settings", "common"]);
  const localeOptions = useLocaleOptions();
  const [activeTab, setActiveTab] = useState<"PROFILE" | "SECURITY" | "NOTIFICATIONS">("PROFILE");
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [jobTitle, setJobTitle] = useState(
    currentUser.role === "SUPER_ADMIN"
      ? t("profile.jobTitleDefaults.admin")
      : t("profile.jobTitleDefaults.operator")
  );
  const [timezone, setTimezone] = useState("America/New_York");
  const [locale, setLocale] = useState("zh-CN");

  // Security Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [is2FAEnabled, setIs2FAEnabled] = useState(true);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Notification Preferences
  const [notifyPaymentFailure, setNotifyPaymentFailure] = useState(true);
  const [notifyDiscrepancy, setNotifyDiscrepancy] = useState(true);
  const [notifyRiskDispute, setNotifyRiskDispute] = useState(true);

  // 外观 / 主题
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const changeTheme = (mode: ThemeMode) => {
    setTheme(mode);
    applyTheme(mode);
  };

  // Password strength calculation
  const getPasswordStrength = () => {
    if (!newPassword) return { score: 0, text: "", color: "bg-hover" };
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score <= 1) return { score: 1, text: t("profile.passwordStrength.weak"), color: "bg-rose-500" };
    if (score === 2 || score === 3) return { score: 2, text: t("profile.passwordStrength.medium"), color: "bg-amber-500" };
    return { score: 3, text: t("profile.passwordStrength.strong"), color: "bg-emerald-500" };
  };

  const strength = getPasswordStrength();

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      name: name.trim(),
      email: email.trim(),
      avatar: avatar,
      jobTitle: jobTitle,
      timezone: timezone,
      locale: locale,
    });
    setSuccessToast(t("profile.toast.profileSaved"));
    setTimeout(() => {
      setSuccessToast(null);
      onClose();
    }, 1200);
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError(t("profile.toast.passwordCurrentRequired"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("profile.toast.passwordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.toast.passwordMismatch"));
      return;
    }

    setSuccessToast(t("profile.toast.passwordReset"));
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => {
      setSuccessToast(null);
      onClose();
    }, 1500);
  };

  return (
    <SideSheet
      id="side-sheet-user-settings"
      isOpen={isOpen}
      onClose={onClose}
      title={t("profile.title")}
      description={t("profile.description")}
      icon={<User className="w-5 h-5 text-fg" />}
      widthClass="max-w-xl"
    >
      <div className="space-y-4 text-xs">
        {/* Success Toast */}
        {successToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-line-subtle pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("PROFILE")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "PROFILE"
                ? "bg-primary text-primary-foreground"
                : "bg-hover text-fg-secondary hover:bg-hover"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t("profile.tabs.profile")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("SECURITY")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "SECURITY"
                ? "bg-primary text-primary-foreground"
                : "bg-hover text-fg-secondary hover:bg-hover"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{t("profile.tabs.security")}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("NOTIFICATIONS")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "NOTIFICATIONS"
                ? "bg-primary text-primary-foreground"
                : "bg-hover text-fg-secondary hover:bg-hover"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{t("profile.tabs.notifications")}</span>
          </button>
        </div>

        {/* 外观 / 主题切换 */}
        <div className="p-3 bg-subtle rounded-xl border border-line">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-semibold text-fg flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-fg-secondary" />
                <span>{t("profile.theme.label")}</span>
              </div>
              <div className="text-[11px] text-fg-tertiary">{t("profile.theme.hint")}</div>
            </div>
            <div className="flex items-center gap-1.5 bg-surface border border-line rounded-lg p-1">
              <button
                type="button"
                onClick={() => changeTheme("light")}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  theme === "light" ? "bg-primary text-primary-foreground" : "text-fg-secondary hover:bg-hover"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                {t("profile.theme.light")}
              </button>
              <button
                type="button"
                onClick={() => changeTheme("dark")}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                  theme === "dark" ? "bg-primary text-primary-foreground" : "text-fg-secondary hover:bg-hover"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                {t("profile.theme.dark")}
              </button>
            </div>
          </div>
        </div>

        {/* Tab 1: Profile & Avatar */}
        {activeTab === "PROFILE" && (
          <form onSubmit={handleSaveProfile} className="space-y-4 pt-1">
            <div>
              <label className="font-semibold text-fg-secondary block mb-2">{t("profile.avatar.label")}</label>
              <div className="flex items-center gap-3">
                <img
                  src={avatar}
                  alt={name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-line shadow-card"
                />
                <div className="space-y-2 flex-1">
                  <div className="text-[11px] text-fg-secondary font-medium">{t("profile.avatar.presets")}</div>
                  <div className="flex items-center gap-2">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatar(preset)}
                        className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          avatar === preset
                            ? "border-primary scale-105 shadow-card"
                            : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img src={preset} alt="preset" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">{t("profile.fields.name")}</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 bg-subtle border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">{t("profile.fields.jobTitle")}</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full p-2 bg-subtle border border-line rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-fg-secondary block mb-1">{t("profile.fields.timezone")}</label>
                <ShadcnSelect
                  value={timezone}
                  onValueChange={setTimezone}
                  options={TIMEZONE_OPTIONS}
                />
              </div>

              <div>
                <label className="font-semibold text-fg-secondary block mb-1">{t("profile.fields.locale")}</label>
                <ShadcnSelect
                  value={locale}
                  onValueChange={setLocale}
                  options={localeOptions}
                />
              </div>
            </div>

            <div className="p-3 bg-subtle rounded-xl border border-line text-[11px] text-fg-secondary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-fg-tertiary" />
                <span>{t("profile.fields.org")}</span>
              </div>
              <span className="font-mono font-bold text-fg bg-hover/60 px-2 py-0.5 rounded">
                {currentUser.role}
              </span>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-line-subtle">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 border border-line hover:bg-hover rounded-xl font-semibold text-fg-secondary cursor-pointer"
              >
                {t("common:actions.cancel")}
              </button>
              <button
                type="submit"
                className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-semibold shadow-card cursor-pointer"
              >
                {t("profile.actions.saveProfile")}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Security & Password */}
        {activeTab === "SECURITY" && (
          <form onSubmit={handleUpdatePassword} className="space-y-4 pt-1">
            {passwordError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{passwordError}</span>
              </div>
            )}

            <div>
              <label className="font-semibold text-fg-secondary block mb-1">{t("profile.fields.currentPassword")}</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="font-semibold text-fg-secondary block mb-1">{t("profile.fields.newPassword")}</label>
              <input
                type="password"
                required
                placeholder={t("profile.fields.passwordPlaceholder")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-fg-secondary">
                    <span>{t("profile.fields.passwordStrength")}</span>
                    <span className="font-bold">{strength.text}</span>
                  </div>
                  <div className="h-1.5 w-full bg-hover rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${strength.color}`}
                      style={{ width: `${(strength.score / 3) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="font-semibold text-fg-secondary block mb-1">{t("profile.fields.confirmPassword")}</label>
              <input
                type="password"
                required
                placeholder={t("profile.fields.confirmPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2 bg-subtle border border-line rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 2FA Toggle */}
            <div className="p-3 bg-subtle rounded-xl border border-line flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-semibold text-fg flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-fg-secondary" />
                  <span>{t("profile.twoFactor.title")}</span>
                </div>
                <div className="text-[11px] text-fg-tertiary">{t("profile.twoFactor.hint")}</div>
              </div>
              <button
                type="button"
                onClick={() => setIs2FAEnabled(!is2FAEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  is2FAEnabled ? "bg-emerald-500" : "bg-hover"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-surface transition-transform absolute top-1 ${
                    is2FAEnabled ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-line-subtle">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 border border-line hover:bg-hover rounded-xl font-semibold text-fg-secondary cursor-pointer"
              >
                {t("common:actions.cancel")}
              </button>
              <button
                type="submit"
                className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-semibold shadow-card cursor-pointer"
              >
                {t("profile.actions.updatePassword")}
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Notifications */}
        {activeTab === "NOTIFICATIONS" && (
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <div className="p-3 bg-subtle rounded-xl border border-line flex items-center justify-between">
                <div>
                  <div className="font-semibold text-fg">{t("profile.notifications.paymentFailure.title")}</div>
                  <div className="text-[11px] text-fg-tertiary">{t("profile.notifications.paymentFailure.hint")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifyPaymentFailure(!notifyPaymentFailure)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    notifyPaymentFailure ? "bg-primary" : "bg-hover"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-surface transition-transform absolute top-1 ${
                      notifyPaymentFailure ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <div className="p-3 bg-subtle rounded-xl border border-line flex items-center justify-between">
                <div>
                  <div className="font-semibold text-fg">{t("profile.notifications.discrepancy.title")}</div>
                  <div className="text-[11px] text-fg-tertiary">{t("profile.notifications.discrepancy.hint")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifyDiscrepancy(!notifyDiscrepancy)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    notifyDiscrepancy ? "bg-primary" : "bg-hover"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-surface transition-transform absolute top-1 ${
                      notifyDiscrepancy ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <div className="p-3 bg-subtle rounded-xl border border-line flex items-center justify-between">
                <div>
                  <div className="font-semibold text-fg">{t("profile.notifications.chargeback.title")}</div>
                  <div className="text-[11px] text-fg-tertiary">{t("profile.notifications.chargeback.hint")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifyRiskDispute(!notifyRiskDispute)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    notifyRiskDispute ? "bg-primary" : "bg-hover"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-surface transition-transform absolute top-1 ${
                      notifyRiskDispute ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end border-t border-line-subtle">
              <button
                type="button"
                onClick={() => {
                  setSuccessToast(t("profile.notifications.saved"));
                  setTimeout(() => {
                    setSuccessToast(null);
                    onClose();
                  }, 1200);
                }}
                className="px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl font-semibold shadow-card cursor-pointer"
              >
                {t("profile.notifications.save")}
              </button>
            </div>
          </div>
        )}

        {/* 退出登录 */}
        {onLogout && (
          <div className="mt-6 pt-4 border-t border-line-subtle">
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-rose-700">{t("profile.logout.title")}</div>
                <div className="text-[11px] text-fg-secondary mt-0.5">
                  {t("profile.logout.hint")}
                </div>
              </div>
              <button
                id="user-settings-logout-btn"
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t("profile.logout.button")}
              </button>
            </div>
          </div>
        )}
      </div>
    </SideSheet>
  );
};
