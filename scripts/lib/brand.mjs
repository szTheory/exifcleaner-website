// Pinned brand-asset mechanism. Dependency-free (Node built-ins only) so it runs
// unchanged on a bare Netlify build image. The brand files themselves are never
// committed here: brand.pin.json names one immutable commit of
// szTheory/exifcleaner-brand plus the sha256 and size of its committed zip, and
// this module fetches, verifies, and unpacks only an allowlist from it.
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { inflateRawSync } from "node:zlib";

export const ZIP_ROOT = "exifcleaner-brand/";

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;

export function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

export function zipUrl(repo, commit) {
  return `https://raw.githubusercontent.com/${repo}/${commit}/exifcleaner-brand.zip`;
}

// ---------------------------------------------------------------- pin file

export function parsePin(text) {
  const pin = JSON.parse(text);
  const fail = (m) => {
    throw new Error(`brand.pin.json: ${m}`);
  };
  if (typeof pin.repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(pin.repo)) fail("repo must be owner/name");
  if (!HEX40.test(pin.commit ?? "")) fail("commit must be a full 40-char lowercase SHA");
  if (!HEX64.test(pin.sha256 ?? "")) fail("sha256 must be 64 lowercase hex chars");
  if (!Number.isInteger(pin.size) || pin.size <= 0) fail("size must be a positive integer");
  if (pin.url !== zipUrl(pin.repo, pin.commit)) fail("url must be the committed zip at the pinned commit");
  if (!Array.isArray(pin.ship) || pin.ship.length === 0) fail("ship must be a non-empty allowlist");
  for (const e of pin.ship) {
    for (const p of [e?.from, e?.to]) {
      if (typeof p !== "string" || p === "" || p.startsWith("/") || p.split("/").includes("..")) {
        fail(`unsafe allowlist path: ${JSON.stringify(p)}`);
      }
    }
  }
  return pin;
}

export async function loadPin(pinPath) {
  return parsePin(await readFile(pinPath, "utf8"));
}

export function serializePin(pin) {
  return (
    JSON.stringify(
      {
        repo: pin.repo,
        commit: pin.commit,
        url: pin.url,
        sha256: pin.sha256,
        size: pin.size,
        ship: pin.ship,
      },
      null,
      2,
    ) + "\n"
  );
}

// Move the pin to `commit`, recording the size and sha256 of `zipBytes`.
export async function rewritePin(pinPath, pin, commit, zipBytes) {
  if (!HEX40.test(commit)) throw new Error(`not a full commit SHA: ${commit}`);
  const next = {
    ...pin,
    commit,
    url: zipUrl(pin.repo, commit),
    sha256: sha256Hex(zipBytes),
    size: zipBytes.length,
  };
  parsePin(serializePin(next)); // never write a pin we would refuse to read
  await writeFile(pinPath, serializePin(next));
  return next;
}

// ----------------------------------------------------------- verify + cache

export function verifyBytes(buf, pin) {
  if (buf.length !== pin.size) {
    throw new Error(`brand zip size mismatch: expected ${pin.size} bytes, got ${buf.length}`);
  }
  const got = sha256Hex(buf);
  if (got !== pin.sha256) {
    throw new Error(`brand zip sha256 mismatch: expected ${pin.sha256}, got ${got}`);
  }
}

export function cachePath(cacheDir, pin) {
  return join(cacheDir, `exifcleaner-brand-${pin.commit}.zip`);
}

async function readIfPresent(path) {
  try {
    return await readFile(path);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

// Returns { path, bytes, source: "cache" | "download" }. A valid cached zip is
// used without touching the network. An invalid cached zip is discarded and
// re-downloaded. A downloaded zip that fails verification is never cached and
// the call throws.
export async function ensureZip({ pin, cacheDir, download }) {
  const path = cachePath(cacheDir, pin);
  const cached = await readIfPresent(path);
  if (cached) {
    try {
      verifyBytes(cached, pin);
      return { path, bytes: cached, source: "cache" };
    } catch (err) {
      console.warn(`brand cache invalid (${err.message}); re-downloading`);
      await rm(path, { force: true });
    }
  }
  const bytes = await download(pin.url, pin.size);
  verifyBytes(bytes, pin);
  await mkdir(cacheDir, { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, bytes);
  await rename(tmp, path);
  return { path, bytes, source: "download" };
}

// Network download with a hard size cap (the pinned size) and a few retries on
// transport errors. Checksum failures are not retried; they are fatal.
export async function httpDownload(url, maxBytes, { attempts = 3, fetchImpl = fetch } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const chunks = [];
      let total = 0;
      for await (const chunk of res.body) {
        total += chunk.length;
        if (total > maxBytes) throw new Error(`download exceeds pinned size (${maxBytes} bytes): ${url}`);
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (err) {
      lastErr = err;
      if (/exceeds pinned size/.test(err.message)) break;
      if (i < attempts) await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
  throw lastErr;
}

// ------------------------------------------------------------------- zip

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Minimal central-directory reader: stored and deflate entries, no zip64.
export function listZipEntries(zip) {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file (no end-of-central-directory record)");
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  if (count === 0xffff || p === 0xffffffff) throw new Error("zip64 archives are not supported");
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt zip central directory");
    const method = zip.readUInt16LE(p + 10);
    const crc = zip.readUInt32LE(p + 16);
    const csize = zip.readUInt32LE(p + 20);
    const usize = zip.readUInt32LE(p + 24);
    const nlen = zip.readUInt16LE(p + 28);
    const elen = zip.readUInt16LE(p + 30);
    const clen = zip.readUInt16LE(p + 32);
    const offset = zip.readUInt32LE(p + 42);
    const name = zip.toString("utf8", p + 46, p + 46 + nlen);
    entries.set(name, { name, method, crc, csize, usize, offset });
    p += 46 + nlen + elen + clen;
  }
  return entries;
}

export function readZipEntry(zip, entry) {
  const o = entry.offset;
  if (zip.readUInt32LE(o) !== 0x04034b50) throw new Error(`corrupt local header for ${entry.name}`);
  const start = o + 30 + zip.readUInt16LE(o + 26) + zip.readUInt16LE(o + 28);
  const raw = zip.subarray(start, start + entry.csize);
  let data;
  if (entry.method === 0) data = raw;
  else if (entry.method === 8) data = inflateRawSync(raw);
  else throw new Error(`unsupported zip compression method ${entry.method} for ${entry.name}`);
  if (data.length !== entry.usize || crc32(data) !== entry.crc) {
    throw new Error(`zip entry failed integrity check: ${entry.name}`);
  }
  return data;
}

// ------------------------------------------------------------------ ship

// Copy only the allowlisted files into outDir, which is wiped first so a file
// removed from the allowlist disappears from the site. Fails if any allowlisted
// file is absent from the zip.
export async function shipAssets({ zipBytes, pin, outDir }) {
  const entries = listZipEntries(zipBytes);
  const files = pin.ship.map(({ from, to }) => {
    const entry = entries.get(ZIP_ROOT + from);
    if (!entry) throw new Error(`allowlisted file missing from brand zip: ${ZIP_ROOT}${from}`);
    return { to, data: readZipEntry(zipBytes, entry) };
  });
  const root = resolve(outDir);
  await rm(root, { recursive: true, force: true });
  for (const { to, data } of files) {
    const dest = resolve(root, to);
    if (!dest.startsWith(root + sep)) throw new Error(`allowlist path escapes output dir: ${to}`);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, data);
  }
  return pin.ship.map((e) => e.to);
}
