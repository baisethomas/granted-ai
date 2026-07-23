import "../server/env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

type Size = "1024x1024" | "1536x1024" | "1024x1536";

const VALID_SIZES: Size[] = ["1024x1024", "1536x1024", "1024x1536"];

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1] ?? "";
      i++;
    }
  }
  return args;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prompt = args.prompt;
  if (!prompt) {
    console.error(
      'Usage: npm run marketing:image -- --prompt "..." [--size 1024x1024|1536x1024|1024x1536] [--out path.png]'
    );
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("[marketing:image] OPENAI_API_KEY is not set. Add it to .env.local or .env.");
    process.exit(1);
  }

  const size = (args.size || "1024x1024") as Size;
  if (!VALID_SIZES.includes(size)) {
    console.error(`[marketing:image] Invalid --size "${size}". Valid: ${VALID_SIZES.join(", ")}`);
    process.exit(1);
  }

  const outPath = args.out || path.join("marketing", "assets", `${slugify(prompt)}.png`);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log(`[marketing:image] Generating ${size} image...`);
  const result = await openai.images.generate({
    model: process.env.GRANTED_IMAGE_MODEL || "gpt-image-1",
    prompt,
    size,
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    console.error("[marketing:image] No image data returned from OpenAI.");
    process.exit(1);
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(b64, "base64"));
  console.log(`[marketing:image] Saved ${outPath}`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[marketing:image] Unhandled error:", error);
  process.exit(1);
});
