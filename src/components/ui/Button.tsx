import { cn } from "@/lib/utils/cn";

const variants = {
  default:
    "bg-foreground text-background hover:opacity-90 disabled:opacity-50",
  ghost: "bg-transparent text-foreground hover:bg-black/5",
  danger: "bg-red-500 text-white hover:bg-red-600 disabled:opacity-50",
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
}

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
