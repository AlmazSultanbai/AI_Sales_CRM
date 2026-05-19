"use client";

import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductThumb({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border bg-slate-100", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-400">
          <ImageIcon className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}
