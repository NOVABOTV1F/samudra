import { cn } from "@/lib/utils";

export function WaveMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-accent", className)}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 22c2-4 4-8 8-8s6 4 8 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="16" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 26h12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}
