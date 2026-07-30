import qrcode from "qrcode-generator";

export function renderQrSvg(value, { cellSize = 6, margin = 4 } = {}) {
  const qr = qrcode(0, "M");
  qr.addData(String(value), "Byte");
  qr.make();
  return qr
    .createSvgTag({ cellSize, margin, scalable: true })
    .replace("<svg ", '<svg role="img" aria-label="GS1 Digital Link QR code" ');
}
