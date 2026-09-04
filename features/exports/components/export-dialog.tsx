"use client";

import { ReactNode, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExportForm } from "@/features/exports/components/export-form";
import { ExportSection } from "@/features/exports/lib/export-sections";

export function ExportDialog({
  trigger,
  defaultSection = "stocks",
  title = "Выгрузка в Excel",
  description = "Выберите раздел и период — файл .xlsx скачается на устройство.",
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  defaultSection?: ExportSection;
  title?: string;
  description?: string;
  /** Управляемый режим: открытие из меню без собственной кнопки-триггера. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = onOpenChange ?? setInnerOpen;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ExportForm defaultSection={defaultSection} onDownloaded={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
