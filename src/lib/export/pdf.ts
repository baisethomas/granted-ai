import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportElementToPdf(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, { scale: 2 });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let position = 0;
  let heightLeft = imgHeight;

  while (heightLeft > 0) {
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    if (heightLeft > 0) {
      pdf.addPage();
      position = 0;
    }
  }

  pdf.save(filename);
}
