/** Browser side: the three ways to sign all end as the same 600x180 transparent PNG the server checks. */
export const SIG_WIDTH = 600;
export const SIG_HEIGHT = 180;
export const SIG_INK = "#182033";
/** An uploaded image is refused above these (file size, pixels per side). */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_MAX_SIDE = 8000;

function blankCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = SIG_WIDTH;
  canvas.height = SIG_HEIGHT;
  return canvas;
}

/** The signatory's name in a handwriting font, shrunk to fit; null when the canvas is unavailable. */
export async function renderAutoSignature(name: string): Promise<string | null> {
  const text = name.trim();
  if (!text) return null;
  try {
    await document.fonts.load("500 64px Caveat", text);
  } catch {
    /* falls back to the generic cursive face */
  }
  const canvas = blankCanvas();
  const context = canvas.getContext("2d");
  if (!context) return null;
  let size = 96;
  for (; size > 24; size -= 4) {
    context.font = `500 ${size}px Caveat, cursive`;
    if (context.measureText(text).width <= SIG_WIDTH - 40) break;
  }
  context.fillStyle = SIG_INK;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillText(text, SIG_WIDTH / 2, SIG_HEIGHT / 2 + size * 0.25);
  return canvas.toDataURL("image/png");
}

export type ImageRefusal = "type" | "size" | "unreadable";

/** An uploaded PNG or JPG, fitted into the signature frame; light background becomes transparent. */
export async function imageToSignature(file: File): Promise<{ image: string } | { refused: ImageRefusal }> {
  if (!/^image\/(png|jpeg)$/.test(file.type)) return { refused: "type" };
  if (file.size > IMAGE_MAX_BYTES) return { refused: "size" };
  const url = URL.createObjectURL(file);
  try {
    const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("unreadable"));
      img.src = url;
    });
    if (!bitmap.naturalWidth || !bitmap.naturalHeight || bitmap.naturalWidth > IMAGE_MAX_SIDE || bitmap.naturalHeight > IMAGE_MAX_SIDE) return { refused: "size" };
    const canvas = blankCanvas();
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return { refused: "unreadable" };
    const scale = Math.min((SIG_WIDTH - 20) / bitmap.naturalWidth, (SIG_HEIGHT - 20) / bitmap.naturalHeight);
    const w = bitmap.naturalWidth * scale;
    const h = bitmap.naturalHeight * scale;
    context.drawImage(bitmap, (SIG_WIDTH - w) / 2, (SIG_HEIGHT - h) / 2, w, h);
    const pixels = context.getImageData(0, 0, SIG_WIDTH, SIG_HEIGHT);
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      const light = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
      d[i + 3] = Math.min(255, Math.round(d[i + 3] * Math.min(1, (1 - light) * 1.6)));
    }
    context.putImageData(pixels, 0, 0);
    return { image: canvas.toDataURL("image/png") };
  } catch {
    return { refused: "unreadable" };
  } finally {
    URL.revokeObjectURL(url);
  }
}
