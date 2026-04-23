import type { GrantMetric, MetricCategory, MetricType } from "@/lib/api";

export const CATEGORY_ORDER: MetricCategory[] = [
  "impact",
  "financial",
  "timeline",
  "reporting",
  "custom",
];

export const CATEGORY_LABELS: Record<MetricCategory, string> = {
  impact: "Impact",
  financial: "Financial",
  timeline: "Timeline",
  reporting: "Reporting",
  custom: "Custom",
};

export function groupMetricsByCategory(
  metrics: GrantMetric[],
): Record<MetricCategory, GrantMetric[]> {
  const out: Record<MetricCategory, GrantMetric[]> = {
    impact: [],
    financial: [],
    timeline: [],
    reporting: [],
    custom: [],
  };
  for (const m of metrics) {
    const cat = (m.category as MetricCategory) in out
      ? (m.category as MetricCategory)
      : "custom";
    out[cat].push(m);
  }
  return out;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatMetricValue(
  value: string | null,
  type: MetricType,
  unit: string | null | undefined,
): string {
  if (value == null || value === "") return "—";
  switch (type) {
    case "currency": {
      const n = Number(value);
      return Number.isFinite(n) ? currencyFormatter.format(n) : value;
    }
    case "percent": {
      const n = Number(value);
      return Number.isFinite(n) ? `${n}%` : value;
    }
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return value;
      const formatted = n.toLocaleString("en-US");
      return unit ? `${formatted} ${unit}` : formatted;
    }
    case "date": {
      const d = new Date(value);
      return Number.isNaN(d.getTime())
        ? value
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    default:
      return value;
  }
}

export function progressPct(value: string | null, target: string | null): number | null {
  if (!value || !target) return null;
  const v = Number(value);
  const t = Number(target);
  if (!Number.isFinite(v) || !Number.isFinite(t) || t === 0) return null;
  return Math.max(0, Math.min(100, Math.round((v / t) * 100)));
}
