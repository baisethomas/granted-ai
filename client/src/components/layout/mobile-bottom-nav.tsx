import { mainNavItems } from "./sidebar";

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const mobileNavItems = mainNavItems.filter(
  (item) => item.id !== "settings" && item.id !== "organization",
);

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden"
      aria-label="Primary mobile navigation"
    >
      <div className="grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
        {mobileNavItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium transition-colors ${
                isActive ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">{item.id === "forms" ? "Forms" : item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
