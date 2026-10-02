import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PHOTO_BYTES,
  MAX_RESOURCE_FILE_BYTES,
  classifyResourceFile,
  preparePhoto,
  resourceFileKindFromPath,
  normalizePhotoFile,
  normalizeResourceFile,
  uploadContractPhoto,
  validatePhoto,
  validateResourceFile,
} from "./imageUpload.ts";

test("validatePhoto accepts JPEG PNG and WebP through the inclusive 20 MB boundary", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.doesNotThrow(() => validatePhoto(fileOfSize(MAX_PHOTO_BYTES, type, "photo.bin")));
  }
  assert.throws(() => validatePhoto(fileOfSize(MAX_PHOTO_BYTES + 1, "image/jpeg", "large.jpg")), /20 MB or smaller/);
  assert.throws(() => validatePhoto(fileOfSize(10, "image/gif", "moving.gif")), /JPEG, PNG, or WebP/);
});

test("validatePhoto accepts desktop image files when the browser omits the MIME type", () => {
  assert.doesNotThrow(() => validatePhoto(fileOfSize(20, "", "booth-photo.JPG")));
  assert.throws(() => validatePhoto(fileOfSize(20, "", "booth-photo.pdf")), /JPEG, PNG, or WebP/);
});

test("resource attachments accept images and PDFs through the inclusive size boundary", () => {
  assert.doesNotThrow(() => validateResourceFile(fileOfSize(MAX_RESOURCE_FILE_BYTES, "application/pdf", "guide.pdf")));
  assert.doesNotThrow(() => validateResourceFile(fileOfSize(20, "", "guide.PDF")));
  assert.doesNotThrow(() => validateResourceFile(fileOfSize(20, "image/png", "diagram.png")));
  assert.throws(() => validateResourceFile(fileOfSize(MAX_RESOURCE_FILE_BYTES + 1, "application/pdf", "large.pdf")), /20 MB or smaller/);
  assert.throws(() => validateResourceFile(fileOfSize(20, "text/plain", "notes.txt")), /image or PDF/);
});

test("resource attachments classify PDFs separately from images", () => {
  assert.equal(classifyResourceFile(fileOfSize(20, "application/pdf", "guide.pdf")), "pdf");
  assert.equal(classifyResourceFile(fileOfSize(20, "image/jpeg", "diagram.jpg")), "image");
  assert.equal(resourceFileKindFromPath("red-folder/guide.PDF"), "pdf");
  assert.equal(resourceFileKindFromPath("red-folder/diagram.webp"), "image");
});

test("MIME-less browser files are rewrapped with the correct upload content type", () => {
  const photo = normalizePhotoFile(fileOfSize(20, "", "booth.PNG"));
  const pdf = normalizeResourceFile(fileOfSize(20, "", "guide.PDF"));
  assert.equal(photo.type, "image/png");
  assert.equal(pdf.type, "application/pdf");
  assert.equal(photo.name, "booth.PNG");
  assert.equal(pdf.name, "guide.PDF");
});

test("preparePhoto leaves a 4800 pixel image unchanged", async () => {
  const original = fileOfSize(20, "image/png", "Booth View.png");
  let resized = false;
  const result = await preparePhoto(original, {
    dimensions: async () => ({ width: 4800, height: 2700 }),
    resizeToJpeg: async () => { resized = true; return new Blob(); },
  });
  assert.equal(result.file, original);
  assert.equal(result.optimized, false);
  assert.equal(result.width, 4800);
  assert.equal(resized, false);
});

test("preparePhoto resizes a 4801+ image to a 4800 long edge at JPEG quality 95", async () => {
  const original = fileOfSize(20, "image/webp", "My Booth!!.webp");
  let request: { width: number; height: number; quality: number } | undefined;
  const result = await preparePhoto(original, {
    dimensions: async () => ({ width: 9602, height: 4801 }),
    resizeToJpeg: async (_file, width, height, quality) => {
      request = { width, height, quality };
      return new Blob(["optimized"], { type: "image/jpeg" });
    },
  });
  assert.deepEqual(request, { width: 4800, height: 2400, quality: 0.95 });
  assert.equal(result.optimized, true);
  assert.equal(result.file.name, "my-booth.jpg");
  assert.equal(result.file.type, "image/jpeg");
});

test("uploadContractPhoto removes only its generated object when the database insert fails", async () => {
  const removed: string[][] = [];
  const uploaded: string[] = [];
  const client = {
    storage: { from: () => ({
      upload: async (path: string) => { uploaded.push(path); return { error: null }; },
      remove: async (paths: string[]) => { removed.push(paths); return { error: null }; },
    }) },
    from: () => ({ insert: async () => ({ error: new Error("Database offline") }) }),
  };
  await assert.rejects(() => uploadContractPhoto({
    contractId: "contract-1",
    userId: "user-1",
    slot: "Front",
    file: fileOfSize(20, "image/jpeg", "Front Photo.jpg"),
  }, {
    client,
    randomUUID: () => "attempt-123",
    prepare: async (file) => ({ file, width: 1000, height: 800, optimized: false }),
  }), /Database offline/);
  assert.deepEqual(uploaded, ["user-1/contract-1/attempt-123-front-photo.jpg"]);
  assert.deepEqual(removed, [["user-1/contract-1/attempt-123-front-photo.jpg"]]);
});

test("uploadContractPhoto sends MIME-less desktop photos with an inferred image type", async () => {
  let uploadedType = "";
  const client = {
    storage: { from: () => ({
      upload: async (_path: string, file: File) => { uploadedType = file.type; return { error: null }; },
      remove: async () => ({ error: null }),
    }) },
    from: () => ({ insert: async () => ({ error: null }) }),
  };
  await uploadContractPhoto({
    contractId: "contract-1",
    userId: "user-1",
    slot: "Front",
    file: fileOfSize(20, "", "front.jpg"),
  }, {
    client,
    randomUUID: () => "attempt-456",
    prepare: async (file) => ({ file, width: 1000, height: 800, optimized: false }),
  });
  assert.equal(uploadedType, "image/jpeg");
});

function fileOfSize(size: number, type: string, name: string) {
  return new File([new Uint8Array(size)], name, { type });
}
