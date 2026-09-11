export type ThemeMode = "light" | "dark";

const THEME_KEY = "app-theme";

/** 读取持久化主题，默认浅色 */
export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** 将主题应用到根节点并持久化 */
export function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* 隐私模式下忽略 */
  }
}
