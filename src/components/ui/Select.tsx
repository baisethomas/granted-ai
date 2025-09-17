import * as React from "react";
import clsx from "clsx";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "h-10 rounded-md border border-black/15 bg-white/80 backdrop-blur px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/40",
        className
      )}
      {...props}
    />
  );
}
