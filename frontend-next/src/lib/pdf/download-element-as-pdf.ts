import { cloneForPdfCapture, removePdfCaptureClone } from "./strip-lab-from-clone";

/** Capture a DOM node with html2canvas and save as A4 PDF (legacy create-invoice parity). */
export async function downloadElementAsPdf(element: HTMLElement, fileName: string): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const captureRoot = cloneForPdfCapture(element);
  const target = captureRoot.firstElementChild as HTMLElement;

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 800,
      windowWidth: 800,
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("Empty canvas");
    }

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
  } finally {
    removePdfCaptureClone(captureRoot);
  }
}
