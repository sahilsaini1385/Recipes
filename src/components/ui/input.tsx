import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-lg border border-paper-deep bg-white px-3 py-2 text-base text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
