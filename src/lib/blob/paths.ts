export function safeUploadFilename(name: string): string {
  return name.replace(/[\\/\u0000-\u001f]+/g, "_").slice(0, 120) || "upload.pdf";
}

export function buildUploadPathname(documentId: string, filename: string): string {
  return `uploads/${documentId}/${safeUploadFilename(filename)}`;
}

export function documentIdFromPathname(pathname: string): string | null {
  const match = /^uploads\/([^/]+)\//.exec(pathname);
  return match?.[1] ?? null;
}
