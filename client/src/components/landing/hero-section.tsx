import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface HeroSectionProps {
  onClickSeeHow: () => void;
  onNavigateToAuth: () => void;
}

export function HeroSection({ onClickSeeHow, onNavigateToAuth }: HeroSectionProps) {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-6 flex flex-col-reverse lg:flex-row items-center gap-12">
        <div className="w-full lg:w-1/2">
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight">
            <span className="bg-gradient-to-r from-[var(--brand-a)] via-[var(--brand-b)] to-[var(--brand-c)] bg-clip-text text-transparent">
              Granted — Your Grant Team in a Browser
            </span>
          </h1>
          <p className="mt-5 text-slate-600 text-lg">
            AI-powered grant writing that learns your story, finds funding, and delivers ready-to-submit applications — from start to finish — with minimal effort from you.
          </p>
          <ul className="mt-6 space-y-2 text-slate-700">
            <li>• Upload docs; we build your context</li>
            <li>• Generate tailored answers with AI</li>
            <li>• Track drafts, versions, and deadlines</li>
          </ul>
          <div className="mt-6 flex gap-3">
            <Button onClick={onNavigateToAuth}>
              Try Granted Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={onClickSeeHow}>
              See How It Works
            </Button>
          </div>
        </div>
        <div className="w-full lg:w-1/2">
          <img 
            src={"/u3552739745_Friendly_illustration_of_a_nonprofit_professional_32e0e39f-7aab-471c-809d-4b1abfd8b0c0_0.png"} 
            alt="Nonprofit professional working" 
            className="w-full h-auto" 
          />
        </div>
      </div>
    </section>
  );
}