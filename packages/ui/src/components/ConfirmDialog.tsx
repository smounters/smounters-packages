import { Button } from "@heroui/react";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useUiLabels } from "../provider";

export interface ConfirmRequest {
  message: string;
  title?: string | undefined;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  /** Красная кнопка подтверждения — для удаления и прочего необратимого. */
  danger?: boolean | undefined;
}

type Ask = (req: ConfirmRequest) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

/**
 * Замена window.confirm. Возвращает ПРОМИС, потому что все вызовы императивные и живут внутри
 * async-обработчиков (`if (!(await confirm({...}))) return;`) — компонент с колбэками потребовал бы
 * переписывать каждый обработчик.
 */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm требует <ConfirmProvider> выше по дереву");
  return ask;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { actions } = useUiLabels();
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback<Ask>((next) => {
    setReq(next);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    setReq(null);
    resolveRef.current?.(ok);
    resolveRef.current = null;
  }, []);

  const value = useMemo(() => ask, [ask]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {req && (
        // Закрытие по фону/Esc = отказ: отмена должна быть самым лёгким действием, а не подтверждение.
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <button type="button" aria-label={actions.cancel} className="absolute inset-0 bg-black/50" onClick={() => settle(false)} />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={req.title ?? req.message}
            className="relative w-[min(28rem,92vw)] rounded-large border border-border bg-surface p-5 shadow-xl"
          >
            {req.title && <h2 className="mb-2 font-semibold text-foreground text-lg">{req.title}</h2>}
            <p className="text-foreground text-sm">{req.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onPress={() => settle(false)}>
                {req.cancelLabel ?? actions.cancel}
              </Button>
              <Button variant={req.danger ? "danger" : "primary"} onPress={() => settle(true)} autoFocus>
                {req.confirmLabel ?? actions.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
