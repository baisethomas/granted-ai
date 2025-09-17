"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText } from "lucide-react";
import clsx from "clsx";

export default function TopNav() {
  const pathname = usePathname();
  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={clsx(
        "px-3 py-1.5 rounded-md text-sm transition-colors",
        pathname === href ? "bg-black/10" : "hover:bg-black/5"
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="w-full sticky top-0 z-50 border-b border-black/10 bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 shadow-sm">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-[#0f172a]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background">
            <FileText size={16} />
          </span>
          Granted
        </Link>
        <nav className="flex gap-1">
          {link("/dashboard", "Dashboard")}
          {link("/upload", "Upload")}
          {link("/grant-form", "Grant Form")}
          {link("/draft", "Draft")}
          {link("/settings", "Settings")}
        </nav>
      </div>
    </header>
  );
}
