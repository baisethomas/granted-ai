import * as React from "react";
import clsx from "clsx";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={clsx(
        "w-full min-h-[160px] rounded-md border border-black/15 bg-white/80 backdrop-blur px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/40",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
