"use client";

/** Resizes a photo in the browser to ≤ maxSide px WebP before uploading (fast on mobile data). */
export async function resizeImage(file: File, maxSide = 1200, quality = 0.84): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That image couldn't be read. Try a JPG or PNG.");
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  if (!blob) throw new Error("This browser couldn't prepare the image.");
  return { blob, width, height };
}

export async function uploadImage(file: File): Promise<{ id: string; url: string }> {
  const { blob, width, height } = await resizeImage(file);
  const form = new FormData();
  form.set("file", new File([blob], "photo.webp", { type: blob.type || "image/webp" }));
  form.set("width", String(width));
  form.set("height", String(height));
  const res = await fetch("/api/admin/images", { method: "POST", body: form, credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed.");
  return data;
}
