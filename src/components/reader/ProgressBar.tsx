"use client";

interface ProgressBarProps {
  current: number;
  total: number;
  accentColor: string;
}

export function ProgressBar({ current, total, accentColor }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Card {Math.min(current + 1, total || 1)} of {total || 1}
        </span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percent}%`,
            backgroundColor: accentColor,
          }}
        />
      </div>
    </div>
  );
}
