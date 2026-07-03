import * as React from "react";
import { cn } from "@/lib/utils";

// Native select styled to match — on phones the OS picker is the best UX.
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full appearance-none rounded-lg border border-paper-deep bg-white px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export { Select };
