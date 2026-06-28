import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const FIXTURE_DIR = join(process.cwd(), "test/fixtures/nonprofit");

const DOCX_BODY =
  "Riverside Community Food Bank provides meals to over 850 families each month across three counties. " +
  "Our 2024 annual budget totals $1.2 million with 72% allocated to direct program services.";

const PDF_BODY = "Riverside Community Food Bank annual report excerpt";

async function buildPdf(text: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 72, y: 720, size: 12, font, color: rgb(0, 0, 0) });
  return Buffer.from(await pdf.save());
}

async function main() {
  mkdirSync(FIXTURE_DIR, { recursive: true });

  const doc = new Document({
    sections: [{ children: [new Paragraph({ children: [new TextRun(DOCX_BODY)] })] }],
  });
  writeFileSync(join(FIXTURE_DIR, "community-impact-brief.docx"), await Packer.toBuffer(doc));
  writeFileSync(join(FIXTURE_DIR, "community-impact-brief.pdf"), await buildPdf(PDF_BODY));
  writeFileSync(
    join(FIXTURE_DIR, "README.md"),
    "# Nonprofit extraction fixtures\n\nRegenerate: `npm run fixtures:nonprofit`\n"
  );

  console.log(`Wrote fixtures to ${FIXTURE_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
