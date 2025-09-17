import * as React from "react";
import clsx from "clsx";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        "w-full h-10 rounded-md border border-black/15 bg-white/80 backdrop-blur px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/40",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
