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
