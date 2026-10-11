import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[transform,background-color,color,box-shadow,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-foam text-abyss hover:bg-ink",
        ghost: "bg-transparent text-mist hover:bg-tide hover:text-ink",
        quiet:
          "bg-transparent text-mist hover:text-ink shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
        danger: "bg-transparent text-danger hover:bg-danger/10",
      },
      size: {
        sm: "h-9 rounded-lg px-3 text-sm",
        md: "h-11 rounded-xl px-4 text-sm",
        icon: "size-11 rounded-xl",
        iconSm: "size-9 rounded-lg",
      },
      press: {
        yes: "active:not-disabled:scale-[0.96]",
        no: "",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
      press: "yes",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  press,
  asChild,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, press, className }))}
      {...props}
    />
  );
}
