import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
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

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}

      {/* Bottom Right Toast Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-none border text-xs shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-5 duration-200 ${
              toast.type === "success"
                ? "bg-[#0c1a17] border-emerald-500/40 text-emerald-300"
                : toast.type === "error"
                ? "bg-[#1f0d0d] border-rose-500/40 text-rose-300"
                : "bg-[#0b1619] border-[#19b3d2]/40 text-[#19b3d2]"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : toast.type === "error" ? (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              ) : (
                <Info className="w-4 h-4 text-[#19b3d2]" />
              )}
            </div>
            <div className="flex-1 font-medium leading-relaxed break-words text-white">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#666666] hover:text-white p-0.5 transition-colors cursor-pointer shrink-0 ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
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
