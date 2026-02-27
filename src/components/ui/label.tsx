import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";

import { cn } from "../../lib/utils";

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
});
Label.displayName = LabelPrimitive.Root.displayName;
