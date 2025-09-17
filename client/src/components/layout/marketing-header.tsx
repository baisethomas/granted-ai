import { Button } from "@/components/ui/button";

export default function MarketingHeader({ onLogout }: { onLogout?: () => void }) {
  return (
    <header className="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-slate-900 to-slate-700" />
          <span className="font-semibold tracking-tight">Granted</span>
        </div>
        <div className="flex items-center gap-4">
          {!onLogout && (
            <a href="/pricing" className="text-slate-700 hover:text-slate-900">Pricing</a>
          )}
          {onLogout ? (
            <Button variant="outline" onClick={onLogout}>Log out</Button>
          ) : (
            <a href="/auth" className="text-slate-700 hover:text-slate-900">Log in</a>
          )}
        </div>
      </div>
    </header>
  );
}



