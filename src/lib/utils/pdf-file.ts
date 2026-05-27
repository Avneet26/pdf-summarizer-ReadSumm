const PDF_MIME_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/vnd.pdf",
]);

export function hasPdfExtension(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}

export function hasPdfMimeType(type: string): boolean {
  const normalized = type.split(";")[0]?.trim().toLowerCase() ?? "";
  return PDF_MIME_TYPES.has(normalized);
}

export function isLikelyPdfByMetadata(name: string, type: string): boolean {
  return hasPdfExtension(name) || hasPdfMimeType(type);
}

export function bufferHasPdfHeader(data: ArrayLike<number>): boolean {
  return (
    data.length >= 4 &&
    data[0] === 0x25 &&
    data[1] === 0x50 &&
    data[2] === 0x44 &&
    data[3] === 0x46
  );
}

export async function fileHasPdfHeader(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 4).arrayBuffer();
  return bufferHasPdfHeader(new Uint8Array(buffer));
}

/** Accept PDFs by extension/MIME or by magic bytes (common for iOS Files). */
export async function isAcceptedPdfFile(file: File): Promise<boolean> {
  if (isLikelyPdfByMetadata(file.name, file.type)) return true;
  return fileHasPdfHeader(file);
}
