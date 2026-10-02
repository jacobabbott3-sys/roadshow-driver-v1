export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_RESOURCE_FILE_BYTES = 20 * 1024 * 1024;
const MAX_LONG_EDGE = 4800;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const PDF_TYPE = "application/pdf";

type PrepareDependencies = {
  dimensions: (file: File) => Promise<{ width: number; height: number }>;
  resizeToJpeg: (file: File, width: number, height: number, quality: number) => Promise<Blob>;
};

export type UploadClient = {
  storage: { from: (bucket: string) => {
    upload: (path: string, file: File, options?: { contentType?: string; upsert?: boolean }) => Promise<{ error: unknown }>;
    remove: (paths: string[]) => Promise<{ error: unknown }>;
  } };
  from: (table: string) => { insert: (values: Record<string, unknown>) => PromiseLike<{ error: unknown }> };
};

type UploadDependencies = {
  client: UploadClient;
  randomUUID: () => string;
  prepare: typeof preparePhoto;
};

export function validatePhoto(file: File) {
  if (!isSupportedPhoto(file)) throw new Error("Choose a JPEG, PNG, or WebP photo.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Photos must be 20 MB or smaller.");
}

export function validateResourceFile(file: File) {
  const kind = classifyResourceFile(file);
  if (!kind) throw new Error("Choose an image or PDF file.");
  if (file.size > MAX_RESOURCE_FILE_BYTES) throw new Error("Resource files must be 20 MB or smaller.");
}

export function classifyResourceFile(file: File): "image" | "pdf" | null {
  if (file.type === PDF_TYPE || extensionForAny(file.name) === "pdf") return "pdf";
  return isSupportedPhoto(file) ? "image" : null;
}

export function normalizePhotoFile(file: File) {
  validatePhoto(file);
  return file.type ? file : withContentType(file, photoContentType(file));
}

export function normalizeResourceFile(file: File) {
  validateResourceFile(file);
  if (file.type) return file;
  return withContentType(file, classifyResourceFile(file) === "pdf" ? PDF_TYPE : photoContentType(file));
}

export function resourceFileKindFromPath(path: string | null): "image" | "pdf" | null {
  if (!path) return null;
  return extensionForAny(path) === "pdf" ? "pdf" : "image";
}

export async function preparePhoto(file: File, dependencies: PrepareDependencies = browserPrepareDependencies) {
  validatePhoto(file);
  const { width, height } = await dependencies.dimensions(file);
  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_LONG_EDGE) return { file, width, height, optimized: false };
  const scale = MAX_LONG_EDGE / longEdge;
  const outputWidth = Math.round(width * scale);
  const outputHeight = Math.round(height * scale);
  const blob = await dependencies.resizeToJpeg(file, outputWidth, outputHeight, 0.95);
  const optimized = new File([blob], normalizedPhotoName(file.name, true), { type: "image/jpeg", lastModified: Date.now() });
  return { file: optimized, width: outputWidth, height: outputHeight, optimized: true };
}

export async function uploadContractPhoto(input: {
  contractId: string;
  userId: string;
  slot: string;
  file: File;
  onProgress?: (percent: number) => void;
}, supplied: Partial<UploadDependencies> & Pick<UploadDependencies, "client">) {
  const dependencies: UploadDependencies = {
    client: supplied.client,
    randomUUID: supplied.randomUUID || (() => crypto.randomUUID()),
    prepare: supplied.prepare || preparePhoto,
  };
  input.onProgress?.(5);
  const prepared = await dependencies.prepare(input.file);
  const uploadFile = normalizePhotoFile(prepared.file);
  input.onProgress?.(30);
  const path = `${input.userId}/${input.contractId}/${dependencies.randomUUID()}-${normalizedPhotoName(uploadFile.name, prepared.optimized)}`;
  const bucket = dependencies.client.storage.from("roadshow-photos");
  const { error: uploadError } = await bucket.upload(path, uploadFile, { contentType: uploadFile.type, upsert: false });
  if (uploadError) throw asError(uploadError, "Unable to upload the photo.");
  input.onProgress?.(80);
  const { error: recordError } = await dependencies.client.from("photos").insert({
    contract_id: input.contractId,
    slot_name: input.slot,
    storage_path: path,
    uploaded_by: input.userId,
  });
  if (recordError) {
    await bucket.remove([path]);
    throw asError(recordError, "Unable to save the photo record.");
  }
  input.onProgress?.(100);
  return { path, optimized: prepared.optimized, width: prepared.width, height: prepared.height };
}

export function normalizedPhotoName(value: string, forceJpeg = false) {
  const extension = forceJpeg ? "jpg" : extensionFor(value);
  const base = value.replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "photo";
  return `${base}.${extension}`;
}

function extensionFor(name: string) {
  const extension = extensionForAny(name);
  return extension === "jpeg" || extension === "jpg" || extension === "png" || extension === "webp" ? extension : "jpg";
}

function extensionForAny(name: string) {
  return name.split(".").at(-1)?.toLocaleLowerCase() || "";
}

function isSupportedPhoto(file: File) {
  return ALLOWED_TYPES.has(file.type) || (!file.type && ALLOWED_PHOTO_EXTENSIONS.has(extensionForAny(file.name)));
}

function photoContentType(file: File) {
  if (file.type) return file.type;
  const extension = extensionForAny(file.name);
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

function withContentType(file: File, type: string) {
  return new File([file], file.name, { type, lastModified: file.lastModified });
}

function asError(value: unknown, fallback: string) {
  if (value instanceof Error) return value;
  if (typeof value === "object" && value && "message" in value && typeof value.message === "string") return new Error(value.message);
  return new Error(fallback);
}

const browserPrepareDependencies: PrepareDependencies = {
  dimensions: async (file) => withImage(file, (image) => ({ width: image.naturalWidth, height: image.naturalHeight })),
  resizeToJpeg: async (file, width, height, quality) => withImage(file, (image) => new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) { reject(new Error("This browser cannot resize photos.")); return; }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to optimize this photo.")), "image/jpeg", quality);
  })),
};

async function withImage<T>(file: File, consume: (image: HTMLImageElement) => T | Promise<T>): Promise<T> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The selected photo could not be read."));
      element.src = url;
    });
    return await consume(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}
