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
        d="M4 19c3.2 0 3.2-6 6.4-6s3.2 6 6.4 6 3.2-6 6.4-6 3.2 6 6.4 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M4 24c3.2 0 3.2-4 6.4-4s3.2 4 6.4 4 3.2-4 6.4-4 3.2 4 6.4 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}
