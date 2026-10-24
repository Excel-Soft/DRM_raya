/** Clone node for html2canvas: drop Tailwind classes so inherited `lab()` colors are not parsed. */
export function cloneForPdfCapture(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  const stripTree = (node: Element) => {
    node.removeAttribute("class");
    for (const child of node.children) stripTree(child);
  };
  stripTree(clone);

  const wrap = document.createElement("div");
  wrap.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:800px",
    "background:#ffffff",
    "color:#111827",
    "font-family:Arial,Helvetica,sans-serif",
    "z-index:-1",
    "opacity:0",
    "pointer-events:none",
  ].join(";");
  wrap.appendChild(clone);
  document.body.appendChild(wrap);
  return wrap;
}

export function removePdfCaptureClone(wrap: HTMLElement): void {
  wrap.remove();
}
