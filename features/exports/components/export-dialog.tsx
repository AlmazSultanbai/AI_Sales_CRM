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
}: {
  trigger: ReactNode;
  defaultSection?: ExportSection;
  title?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
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
