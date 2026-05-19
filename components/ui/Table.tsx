import { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-border bg-white shadow-panel">
      <table className="w-full text-sm text-left">
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{children}</thead>;
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function Tr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`transition-colors hover:bg-slate-50/70 ${className}`}>{children}</tr>;
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`px-5 py-3 font-semibold ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-3.5 ${className}`}>{children}</td>;
}
