// No network: every test uses a locally built fixture zip and an injected downloader.
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { after, describe, test } from "node:test";
import {
  cachePath,
  crc32,
  ensureZip,
  httpDownload,
  parsePin,
  rewritePin,
  sha256Hex,
  shipAssets,
  verifyBytes,
  zipUrl,
} from "./lib/brand.mjs";

// Build a zip (stored or deflate) in memory.
function makeZip(files, { deflate = false } = {}) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name);
    const data = Buffer.from(content);
    const comp = deflate ? deflateRawSync(data) : data;
    const method = deflate ? 8 : 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(crc32(data), 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    locals.push(lh, nameBuf, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc32(data), 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const COMMIT = "a".repeat(40);
const REPO = "szTheory/exifcleaner-brand";
const files = {
  "exifcleaner-brand/assets/fonts/OFL-A.txt": "license A\n".repeat(50),
  "exifcleaner-brand/assets/fonts/OFL-B.txt": "license B\n",
  "exifcleaner-brand/assets/icons/not-allowlisted.svg": "<svg/>",
};
const ship = [
  { from: "assets/fonts/OFL-A.txt", to: "fonts/OFL-A.txt" },
  { from: "assets/fonts/OFL-B.txt", to: "fonts/OFL-B.txt" },
];

function pinFor(zip, overrides = {}) {
  return {
    repo: REPO,
    commit: COMMIT,
    url: zipUrl(REPO, COMMIT),
    sha256: sha256Hex(zip),
    size: zip.length,
    ship,
    ...overrides,
  };
}

const tmps = [];
async function tmp() {
  const d = await mkdtemp(join(tmpdir(), "brand-test-"));
  tmps.push(d);
  return d;
}
after(() => Promise.all(tmps.map((d) => rm(d, { recursive: true, force: true }))));

function countingDownloader(bytes) {
  const fn = async () => {
    fn.calls++;
    return bytes;
  };
  fn.calls = 0;
  return fn;
}

describe("verifyBytes", () => {
  const zip = makeZip(files);
  test("accepts matching bytes", () => verifyBytes(zip, pinFor(zip)));
  test("rejects a sha256 mismatch of identical length", () => {
    const tampered = Buffer.from(zip);
    tampered[40] ^= 0xff;
    assert.throws(() => verifyBytes(tampered, pinFor(zip)), /sha256 mismatch/);
  });
  test("rejects a size mismatch", () => {
    assert.throws(() => verifyBytes(Buffer.concat([zip, Buffer.from("x")]), pinFor(zip)), /size mismatch/);
  });
});

describe("ensureZip", () => {
  const zip = makeZip(files);

  test("downloads on a cold cache, verifies, then serves from cache with no download", async () => {
    const cacheDir = join(await tmp(), "cache");
    const pin = pinFor(zip);
    const dl = countingDownloader(zip);
    const first = await ensureZip({ pin, cacheDir, download: dl });
    assert.equal(first.source, "download");
    assert.equal(dl.calls, 1);
    const second = await ensureZip({ pin, cacheDir, download: dl });
    assert.equal(second.source, "cache");
    assert.equal(dl.calls, 1, "cache hit must not download");
  });

  test("works offline when the cache matches (downloader throws if called)", async () => {
    const cacheDir = await tmp();
    const pin = pinFor(zip);
    await writeFile(cachePath(cacheDir, pin), zip);
    const offline = async () => {
      throw new Error("network unreachable");
    };
    const r = await ensureZip({ pin, cacheDir, download: offline });
    assert.equal(r.source, "cache");
  });

  test("fails on a downloaded checksum mismatch and caches nothing", async () => {
    const cacheDir = join(await tmp(), "cache");
    const bad = makeZip({ ...files, "exifcleaner-brand/extra": "tampered" });
    const pin = pinFor(zip); // pin describes the good zip
    await assert.rejects(ensureZip({ pin, cacheDir, download: countingDownloader(bad) }), /mismatch/);
    await assert.rejects(readFile(cachePath(cacheDir, pin)), { code: "ENOENT" });
  });

  test("a corrupt cached zip is discarded and replaced by a verified download", async () => {
    const cacheDir = await tmp();
    const pin = pinFor(zip);
    await writeFile(cachePath(cacheDir, pin), Buffer.from("corrupt"));
    const dl = countingDownloader(zip);
    const r = await ensureZip({ pin, cacheDir, download: dl });
    assert.equal(r.source, "download");
    assert.deepEqual(await readFile(cachePath(cacheDir, pin)), zip);
  });

  test("a corrupt cache plus a bad download still fails (no silent fallback)", async () => {
    const cacheDir = await tmp();
    const pin = pinFor(zip);
    await writeFile(cachePath(cacheDir, pin), Buffer.from("corrupt"));
    await assert.rejects(ensureZip({ pin, cacheDir, download: countingDownloader(Buffer.from("nope")) }), /mismatch/);
  });
});

describe("httpDownload", () => {
  const stream = (chunks) => ({ ok: true, body: (async function* () { yield* chunks; })() });
  test("concatenates the body", async () => {
    const buf = await httpDownload("u", 10, { fetchImpl: async () => stream([Buffer.from("ab"), Buffer.from("cd")]) });
    assert.equal(buf.toString(), "abcd");
  });
  test("aborts when the body exceeds the pinned size", async () => {
    await assert.rejects(
      httpDownload("u", 3, { attempts: 3, fetchImpl: async () => stream([Buffer.from("abcd")]) }),
      /exceeds pinned size/,
    );
  });
  test("rejects non-2xx", async () => {
    await assert.rejects(httpDownload("u", 3, { attempts: 1, fetchImpl: async () => ({ ok: false, status: 404 }) }), /HTTP 404/);
  });
});

describe("shipAssets", () => {
  for (const deflate of [false, true]) {
    test(`copies only the allowlist (${deflate ? "deflate" : "stored"}) and wipes stale output`, async () => {
      const zip = makeZip(files, { deflate });
      const outDir = join(await tmp(), "static", "brand");
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "stale.txt"), "left over");
      const shipped = await shipAssets({ zipBytes: zip, pin: pinFor(zip), outDir });
      assert.deepEqual(shipped, ["fonts/OFL-A.txt", "fonts/OFL-B.txt"]);
      assert.deepEqual((await readdir(outDir)).sort(), ["fonts"], "stale file removed");
      assert.deepEqual((await readdir(join(outDir, "fonts"))).sort(), ["OFL-A.txt", "OFL-B.txt"]);
      assert.equal(await readFile(join(outDir, "fonts/OFL-A.txt"), "utf8"), files["exifcleaner-brand/assets/fonts/OFL-A.txt"]);
    });
  }
  test("fails when an allowlisted file is missing from the zip", async () => {
    const zip = makeZip({ "exifcleaner-brand/assets/fonts/OFL-A.txt": "x" });
    await assert.rejects(shipAssets({ zipBytes: zip, pin: pinFor(zip), outDir: join(await tmp(), "o") }), /missing from brand zip/);
  });
  test("fails an entry whose contents do not match its recorded CRC", async () => {
    const zip = makeZip({ ...files });
    const idx = zip.indexOf("license B");
    zip[idx] ^= 0x01;
    await assert.rejects(shipAssets({ zipBytes: zip, pin: pinFor(zip), outDir: join(await tmp(), "o") }), /integrity check/);
  });
});

describe("parsePin / rewritePin", () => {
  const zip = makeZip(files);
  test("rejects a url that does not match repo+commit", () => {
    const bad = JSON.stringify(pinFor(zip, { url: "https://example.com/x.zip" }));
    assert.throws(() => parsePin(bad), /url must be/);
  });
  test("rejects a branch name instead of a full SHA", () => {
    assert.throws(() => parsePin(JSON.stringify(pinFor(zip, { commit: "main" }))), /40-char/);
  });
  test("rejects an allowlist path that escapes", () => {
    assert.throws(() => parsePin(JSON.stringify(pinFor(zip, { ship: [{ from: "a", to: "../../x" }] }))), /unsafe/);
  });

  test("rewrites commit, url, size and sha256, keeping repo and allowlist", async () => {
    const dir = await tmp();
    const pinPath = join(dir, "brand.pin.json");
    await writeFile(pinPath, JSON.stringify(pinFor(zip)));
    const newZip = makeZip({ ...files, "exifcleaner-brand/new": "new" });
    const newCommit = "b".repeat(40);
    await rewritePin(pinPath, parsePin(await readFile(pinPath, "utf8")), newCommit, newZip);
    const written = parsePin(await readFile(pinPath, "utf8"));
    assert.equal(written.commit, newCommit);
    assert.equal(written.url, zipUrl(REPO, newCommit));
    assert.equal(written.size, newZip.length);
    assert.equal(written.sha256, sha256Hex(newZip));
    assert.deepEqual(written.ship, ship);
    // and the rewritten pin now verifies the new zip but not the old one
    verifyBytes(newZip, written);
    assert.throws(() => verifyBytes(zip, written), /mismatch/);
  });

  test("refuses a non-SHA commit and leaves the pin file untouched", async () => {
    const dir = await tmp();
    const pinPath = join(dir, "brand.pin.json");
    const original = JSON.stringify(pinFor(zip));
    await writeFile(pinPath, original);
    await assert.rejects(rewritePin(pinPath, pinFor(zip), "main", zip), /full commit SHA/);
    assert.equal(await readFile(pinPath, "utf8"), original);
  });
});

test("the committed brand.pin.json is valid", async () => {
  const pin = parsePin(await readFile(new URL("../brand.pin.json", import.meta.url), "utf8"));
  assert.equal(pin.repo, "szTheory/exifcleaner-brand");
});
