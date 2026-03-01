import { type ReactNode, useEffect } from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

interface SlideOverPanelProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
}

export function SlideOverPanel({
  open,
  title,
  description,
  onClose,
  children,
  panelClassName,
}: SlideOverPanelProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/24 backdrop-blur-[1px]">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute inset-y-0 right-0 z-10 flex h-full min-h-0 w-full max-w-[28.5rem] flex-col border-l border-slate-200 bg-white/95 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)] backdrop-blur",
          "max-[640px]:max-w-full max-[640px]:p-4",
          panelClassName,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold tracking-[-0.01em] text-slate-900">{title}</h3>
            {description ? (
              <p className="text-sm leading-relaxed text-slate-600">{description}</p>
            ) : null}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="mt-4 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-8">
          {children}
        </div>
      </section>
    </div>
  );
}
