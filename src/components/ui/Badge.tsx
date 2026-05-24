import { cn } from "@/lib/utils/cn";

const statusStyles: Record<string, string> = {
  queued: "bg-slate-100 text-slate-700",
  extracting: "bg-amber-100 text-amber-800",
  chunking: "bg-amber-100 text-amber-800",
  summarizing: "bg-sky-100 text-sky-800",
  ready: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  queued: "Queued",
  extracting: "Extracting",
  chunking: "Chunking",
  summarizing: "Summarizing",
  ready: "Ready",
  failed: "Failed",
};

export function Badge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        statusStyles[status] ?? "bg-slate-100 text-slate-700",
        className,
      )}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}
