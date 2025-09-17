export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200/80 bg-white/70">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between text-sm text-slate-600">
        <div>© {currentYear} Granted</div>
        <div className="flex gap-4">
          <a href="#features" className="hover:text-slate-900">Features</a>
          <a href="#how" className="hover:text-slate-900">How it works</a>
          <a href="#faq" className="hover:text-slate-900">FAQ</a>
        </div>
      </div>
    </footer>
  );
}