import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PHOTO_BYTES, preparePhoto, uploadContractPhoto, validatePhoto } from "./imageUpload.ts";

test("validatePhoto accepts JPEG PNG and WebP through the inclusive 20 MB boundary", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.doesNotThrow(() => validatePhoto(fileOfSize(MAX_PHOTO_BYTES, type, "photo.bin")));
  }
  assert.throws(() => validatePhoto(fileOfSize(MAX_PHOTO_BYTES + 1, "image/jpeg", "large.jpg")), /20 MB or smaller/);
  assert.throws(() => validatePhoto(fileOfSize(10, "image/gif", "moving.gif")), /JPEG, PNG, or WebP/);
});

test("preparePhoto leaves a 3200 pixel image unchanged", async () => {
  const original = fileOfSize(20, "image/png", "Booth View.png");
  let resized = false;
  const result = await preparePhoto(original, {
    dimensions: async () => ({ width: 3200, height: 1800 }),
    resizeToJpeg: async () => { resized = true; return new Blob(); },
  });
  assert.equal(result.file, original);
  assert.equal(result.optimized, false);
  assert.equal(result.width, 3200);
  assert.equal(resized, false);
});

test("preparePhoto resizes a 3201+ image to a 3200 long edge at JPEG quality 90", async () => {
  const original = fileOfSize(20, "image/webp", "My Booth!!.webp");
  let request: { width: number; height: number; quality: number } | undefined;
  const result = await preparePhoto(original, {
    dimensions: async () => ({ width: 6402, height: 3201 }),
    resizeToJpeg: async (_file, width, height, quality) => {
      request = { width, height, quality };
      return new Blob(["optimized"], { type: "image/jpeg" });
    },
  });
  assert.deepEqual(request, { width: 3200, height: 1600, quality: 0.9 });
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

function fileOfSize(size: number, type: string, name: string) {
  return new File([new Uint8Array(size)], name, { type });
}
