import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

export async function exportDraftToDocx(draft: string, filename: string) {
  const lines = draft.split(/\n+/);
  const paragraphs = lines.map((line) => {
    if (/^#+\s/.test(line)) {
      return new Paragraph({
        children: [new TextRun(line.replace(/^#+\s/, ""))],
        heading: HeadingLevel.HEADING_2,
      });
    }
    return new Paragraph({
      children: [new TextRun(line)],
      alignment: AlignmentType.LEFT,
    });
  });

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
