/**
 * Photos reduced on the phone before they are kept or sent (feature 003, research R6,
 * FR-009): longest side 1600 px, JPEG at quality 0.8, about 200 KB, with the platform's own
 * canvas and no library.
 */

const maxSide = 1600;
/** The body limit of every request (feature 002, research R13). */
const maxBytes = 1024 * 1024;

export function scaledSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

/** The reduced photo, or null when it cannot be read: a photo problem never blocks a record. */
export async function compressPhoto(file: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const size = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    for (const quality of [0.8, 0.6, 0.4]) {
      const blob = await toJpeg(canvas, quality);
      if (blob && blob.size <= maxBytes) return blob;
    }
    return null;
  } catch {
    return null;
  }
}
