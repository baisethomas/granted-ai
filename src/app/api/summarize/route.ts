import { NextRequest, NextResponse } from "next/server";
import { buildContextMemory } from "@/lib/agent/context";

type SummarizeBody = {
  documents: { name: string; text: string }[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<SummarizeBody>;
    const docs = (body?.documents ?? []).map((d) => ({ name: String(d.name), text: String(d.text || "") }));
    const memory = await buildContextMemory(docs);
    return NextResponse.json(memory);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
