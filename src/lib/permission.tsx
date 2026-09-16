import React, { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import type { SystemUser } from "../types/payment";

export type PermissionMode = "any" | "all";

export type PermissionContextValue = {
  user: SystemUser | null;
  ready: boolean;
};

const PermissionContext = createContext<PermissionContextValue>({
  user: null,
  ready: false,
});

export function PermissionProvider({
  value,
  children,
}: {
  value: PermissionContextValue;
  children: React.ReactNode;
}) {
  return (
    <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
  );
}

export function usePermissionContext(): PermissionContextValue {
  return useContext(PermissionContext);
}

function normalizeKeys(keys: string | string[]): string[] {
  return Array.isArray(keys) ? keys : [keys];
}

function userRoleKeys(user: SystemUser): string[] {
  if (user.roleKeys?.length) return user.roleKeys;
  if (user.roleKey) return [user.roleKey];
  return [];
}

/** 判定：SUPER_ADMIN 短路；否则看 user.menuKeys */
export function hasMenuAccess(
  user: SystemUser | null | undefined,
  keys: string | string[],
  mode: PermissionMode = "any",
): boolean {
  if (!user) return false;
  if (userRoleKeys(user).includes("SUPER_ADMIN")) return true;

  const menuKeys = user.menuKeys || [];
  const required = normalizeKeys(keys);
  if (required.length === 0) return true;
  if (mode === "all") return required.every((k) => menuKeys.includes(k));
  return required.some((k) => menuKeys.includes(k));
}

export function usePermission(
  keys: string | string[],
  mode: PermissionMode = "any",
): { allowed: boolean; ready: boolean } {
  const { user, ready } = usePermissionContext();
  return { allowed: hasMenuAccess(user, keys, mode), ready };
}

function DefaultPermissionFallback() {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-fg-secondary">
      <p className="text-base font-medium text-fg">{t("permission.denied")}</p>
      <p className="text-sm">{t("permission.deniedHint")}</p>
    </div>
  );
}

export function PermissionGate({
  menuKey,
  mode = "any",
  fallback,
  children,
}: {
  menuKey: string | string[];
  mode?: PermissionMode;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element | null {
  const { allowed, ready } = usePermission(menuKey, mode);
  if (!ready) return null;
  if (!allowed) {
    return <>{fallback ?? <DefaultPermissionFallback />}</>;
  }
  return <>{children}</>;
}

export function withPermission<P extends object>(
  keys: string | string[],
  options?: { mode?: PermissionMode; fallback?: React.ReactNode },
) {
  return function wrap(Comp: React.ComponentType<P>): React.FC<P> {
    const mode = options?.mode ?? "any";
    const Wrapped: React.FC<P> = (props) => (
      <PermissionGate menuKey={keys} mode={mode} fallback={options?.fallback}>
        <Comp {...props} />
      </PermissionGate>
    );
    const name = Comp.displayName || Comp.name || "Component";
    Wrapped.displayName = `withPermission(${name})`;
    return Wrapped;
  };
}
