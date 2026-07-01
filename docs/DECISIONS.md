# Architecture Decision Log

Short records of decisions we've deliberately made, so they don't get re-litigated. Newest first. When a decision's revisit trigger fires, add a new entry rather than editing the old one.

---

## 2026-06-30 — Stay on OpenAI for generation; do not adopt OpenRouter yet

**Decision:** Keep the current setup — OpenAI for generation (`gpt-4o-mini` default via `GRANTED_DEFAULT_MODEL`) and OpenAI `text-embedding-3-small` for embeddings. Do **not** route through OpenRouter at this time. The dormant `GRANTED_DEFAULT_PROVIDER` env switch stays scaffolding for now.

**Context / why:**
- Considered OpenRouter primarily for cost savings.
- The cost lever is model choice, not the router — and we're already on one of the cheapest hosted models. Estimated savings were ~$0.0005/generation (single-digit dollars/month at realistic volume). Not material.
- Generation here is **not** "just text": it's grounded, cited, assumption-tagged RAG output for an audience that specifically distrusts AI hallucination. Citation faithfulness and honesty are the product. Cheaper models degrade exactly there. The marginal saving isn't worth risking the core value prop.
- The system also hasn't been stress-tested yet — no reason to change a working component before we understand its real behavior.

**Revisit triggers — reopen this if any occur:**
1. OpenAI degrades `gpt-4o-mini` quality or raises its price materially.
2. Generation volume grows enough that per-call savings become real money.
3. We need multi-provider resilience (fallback on OpenAI outage) or want to A/B models.

**When we revisit, do this first (don't switch on vibes):**
1. Build a real provider abstraction (`generate()` / `embed()` interface) — the `GRANTED_DEFAULT_PROVIDER` seam already anticipates this. Keep embeddings on a dedicated provider (OpenRouter is chat-focused).
2. Run a **citation-faithfulness / assumption-honesty eval** across candidate models using the `fixtures:nonprofit` script. Decide on faithfulness, not price.
3. Restrict routing to no-log providers — grant documents are sensitive nonprofit data.

Related: the "Reality vs. the docs" note in [`CLAUDE.md`](../CLAUDE.md) records the current OpenAI-only state.
