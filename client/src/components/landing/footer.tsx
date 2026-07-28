export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200/80 bg-white/70">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-4 text-sm text-slate-600">
        <div>© {currentYear} Granted</div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a href="/privacy" className="hover:text-slate-900">Privacy</a>
          <a href="/security" className="hover:text-slate-900">Security</a>
          <a href="/terms" className="hover:text-slate-900">Terms</a>
          <a href="/#features" className="hover:text-slate-900">Features</a>
          <a href="/#how" className="hover:text-slate-900">How it works</a>
          <a href="/#faq" className="hover:text-slate-900">FAQ</a>
        </div>
      </div>
    </footer>
  );
}
