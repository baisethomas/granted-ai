import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, Shield } from "lucide-react";

export function TrustSection() {
  const benefits = [
    "Drafts aligned to funder priorities",
    "Context reuse across applications",
    "Version history with \"current\" selection",
    "Simple exports when you're ready",
  ];

  return (
    <section className="py-12 border-t border-slate-200/80 bg-white/70">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="col-span-1 md:col-span-2">
          <h2 className="text-2xl font-semibold text-slate-900">
            Built for Nonprofits, By People Who Understand Them
          </h2>
          <ul className="mt-4 space-y-3 text-slate-700">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-slate-900" />
                {benefit}
              </li>
            ))}
          </ul>
          <p className="text-slate-600 mt-4">
            We know grant writing can be overwhelming, especially for small teams and grassroots organizations. 
            Granted makes the process simple, strategic, and stress-free — without sacrificing quality.
          </p>
        </div>
        <Card className="hover:shadow-md transition">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-slate-900" />
              <h3 className="font-medium">Save dozens of hours</h3>
            </div>
            <p className="text-slate-600 mt-2">
              Teams report moving from blank page to strong first draft in minutes, not weeks.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <Shield className="h-5 w-5 text-slate-900" />
              <h3 className="font-medium">Your data, private</h3>
            </div>
            <p className="text-slate-600 mt-2">
              Your uploads are used only to help you draft. No public training or sharing.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}