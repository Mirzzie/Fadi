"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** Shared modal shell for the portfolio CMS dialogs. */
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="grid max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="border-b border-border px-5 py-5 pr-14 sm:px-6 sm:pr-14">
          <DialogTitle className="text-xl leading-tight tracking-tight">{title}</DialogTitle>
        </div>
        <div className="nice-scrollbar min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {children}
        </div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
