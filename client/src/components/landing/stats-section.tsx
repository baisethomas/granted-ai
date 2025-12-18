export function StatsSection() {
  const stats = [
    { label: "Hours saved", value: "48+" },
    { label: "Drafts generated", value: "120+" },
    { label: "Docs reused", value: "300+" },
    { label: "Win rate uplift", value: "+15%" },
  ];

  return (
    <section className="py-10">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div 
            key={stat.label} 
            className="rounded-xl border border-slate-200/80 bg-white/70 p-4 text-center hover:shadow-md transition"
          >
            <div className="text-2xl font-extrabold bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
              {stat.value}
            </div>
            <div className="text-xs mt-1 text-slate-600">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}