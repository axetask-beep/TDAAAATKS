// Reads an arbitrary file as a data URL for storage in attachments.file_url.
// There is no binary upload endpoint or object storage in this app — a
// data URL stored directly in a text column is the pragmatic choice given
// that constraint (mirrors resizeImageToDataUrl in lib/image.ts, but without
// the canvas resize since this isn't necessarily an image).
export function readFileAsDataUrl(file: File, maxBytes = 8 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error(`Fichier trop volumineux (max ${Math.round(maxBytes / (1024 * 1024))} Mo).`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

// Uploads go through Vercel (4.5 Mo per request, base64 adds a third): 3 Mo per file.
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

const EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'application/zip': 'zip',
  'text/plain': 'txt', 'text/csv': 'csv',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'video/mp4': 'mp4',
};

// A name any OS can save: Android pickers can return "document:1001085109"
// (no extension, ':' is forbidden on Windows), so the file couldn't be opened.
export function safeFileName(name: string, mime?: string | null) {
  let n = (name || 'fichier').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').trim() || 'fichier';
  const ext = mime && EXT[mime.split(';')[0]];
  if (ext && !/\.[a-z0-9]{2,5}$/i.test(n)) n += `.${ext}`;
  return n;
}

// Saves a stored file to disk. Browsers block opening a data: URL in a new
// tab (blank page), so turn it into a blob and download it under its name.
export async function downloadDataUrl(dataUrl: string, fileName: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFileName(fileName, blob.type);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
