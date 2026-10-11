import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full resize-none bg-transparent text-base leading-relaxed text-ink placeholder:text-mist/80",
          "focus-visible:outline-none disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
