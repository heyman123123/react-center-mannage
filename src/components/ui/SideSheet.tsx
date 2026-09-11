import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface SideSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerExtra?: React.ReactNode;
  widthClass?: string; // default max-w-xl
  id?: string;
}

export const SideSheet: React.FC<SideSheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  headerExtra,
  widthClass = "max-w-2xl",
  id,
}) => {
  // Lock body scroll when open and handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div id={id} className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side Panel Sliding from Left to Right */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 h-full w-full bg-white shadow-2xl flex flex-col border-r border-zinc-200 animate-in slide-in-from-left duration-300 ease-out focus:outline-none",
          widthClass
        )}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3 pr-4">
            {icon && (
              <div className="p-2 rounded-xl bg-zinc-100 text-zinc-800 shrink-0">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h2 className="text-base font-bold text-zinc-900 leading-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              title="关闭 (Esc)"
              className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-3.5 border-t border-zinc-100 bg-zinc-50/80 shrink-0 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
