import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning" | "confirm";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  confirm: (message: string, onConfirm: () => void, options?: { confirmLabel?: string; cancelLabel?: string }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const success = useCallback((message: string) => showToast(message, "success"), [showToast]);
  const error = useCallback((message: string) => showToast(message, "error"), [showToast]);
  const info = useCallback((message: string) => showToast(message, "info"), [showToast]);
  const warning = useCallback((message: string) => showToast(message, "warning"), [showToast]);

  const confirm = useCallback(
    (message: string, onConfirm: () => void, options?: { confirmLabel?: string; cancelLabel?: string }) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [
        ...prev,
        {
          id,
          type: "confirm",
          message,
          onConfirm,
          confirmLabel: options?.confirmLabel || "Confirm",
          cancelLabel: options?.cancelLabel || "Cancel",
        },
      ]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning, confirm }}>
      {children}

      {/* Bottom Right Toast Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          if (toast.type === "confirm") {
            return (
              <div
                key={toast.id}
                className="pointer-events-auto flex flex-col gap-3 p-4 rounded-xl border border-[#2C353D] bg-[#161B1F]/95 backdrop-blur-md text-white text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-200 ring-1 ring-white/5"
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="flex-1 font-medium text-[#CBD5E1] leading-relaxed pt-0.5">
                    {toast.message}
                  </div>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="text-[#8E9BA8] hover:text-white p-1 rounded-md hover:bg-[#222930] transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#232B32]/80 mt-1">
                  <button
                    onClick={() => {
                      if (toast.onCancel) toast.onCancel();
                      removeToast(toast.id);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#222930] hover:bg-[#2C353D] text-[#CBD5E1] hover:text-white border border-[#2C353D] text-xs font-medium transition-all cursor-pointer shadow-sm"
                  >
                    {toast.cancelLabel || "Cancel"}
                  </button>
                  <button
                    onClick={() => {
                      if (toast.onConfirm) toast.onConfirm();
                      removeToast(toast.id);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold border border-rose-500/60 text-xs transition-all cursor-pointer shadow-sm"
                  >
                    {toast.confirmLabel || "Confirm"}
                  </button>
                </div>
              </div>
            );
          }

          const iconMap = {
            success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
            error: <AlertCircle className="w-4 h-4 text-rose-400" />,
            warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
            info: <Info className="w-4 h-4 text-cyan-400" />,
          };

          const iconBgMap = {
            success: "bg-emerald-500/10 border-emerald-500/25",
            error: "bg-rose-500/10 border-rose-500/25",
            warning: "bg-amber-500/10 border-amber-500/25",
            info: "bg-cyan-500/10 border-cyan-500/25",
          };

          const badgeBorder = {
            success: "border-emerald-500/30",
            error: "border-rose-500/30",
            warning: "border-amber-500/30",
            info: "border-cyan-500/30",
          };

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border bg-[#161B1F]/95 backdrop-blur-md text-xs shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-5 duration-200 ring-1 ring-white/5 ${
                toast.type === "success"
                  ? `${badgeBorder.success}`
                  : toast.type === "error"
                  ? `${badgeBorder.error}`
                  : toast.type === "warning"
                  ? `${badgeBorder.warning}`
                  : `${badgeBorder.info}`
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${
                  iconBgMap[toast.type as keyof typeof iconBgMap] || iconBgMap.info
                }`}
              >
                {iconMap[toast.type as keyof typeof iconMap] || iconMap.info}
              </div>
              <div className="flex-1 font-medium leading-relaxed break-words text-[#CBD5E1] pt-0.5">
                {toast.message}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-[#8E9BA8] hover:text-white p-1 rounded-md hover:bg-[#222930] transition-colors cursor-pointer shrink-0 ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
