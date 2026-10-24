import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface Toast {
  id: number;
  kind: "ok" | "bad";
  message: string;
}

const ToastContext = createContext<{ show: (message: string, kind?: "ok" | "bad") => void } | undefined>(undefined);

let counter = 0;

/** Short confirmations ("Saved"). Anything the person must act on belongs in an Alert on the page instead. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: "ok" | "bad" = "ok") => {
    const id = ++counter;
    setToasts((current) => [...current, { id, kind, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), kind === "bad" ? 8000 : 4500);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={toast.kind === "bad" ? "toast toast--bad" : "toast"}>
            {toast.kind === "bad" ? <AlertCircle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context.show;
}
