// Move brand.pin.json to a new commit of the brand repo (default: latest main),
// rewriting commit, url, size and sha256 so the change is one reviewable diff.
// Usage: npm run brand:update [-- <ref-or-40-char-sha>]
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cachePath, httpDownload, listZipEntries, loadPin, rewritePin, ZIP_ROOT, zipUrl } from "./lib/brand.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pinPath = join(root, "brand.pin.json");
const pin = await loadPin(pinPath);
const ref = process.argv[2] ?? "main";

async function resolveCommit(ref) {
  if (/^[0-9a-f]{40}$/.test(ref)) return ref;
  const headers = { Accept: "application/vnd.github.sha", "User-Agent": "exifcleaner-website-brand-update" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${pin.repo}/commits/${encodeURIComponent(ref)}`, { headers });
  if (!res.ok) throw new Error(`cannot resolve ${pin.repo}@${ref}: HTTP ${res.status}`);
  const sha = (await res.text()).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`unexpected commit response for ${ref}`);
  return sha;
}

const commit = await resolveCommit(ref);
const bytes = await httpDownload(zipUrl(pin.repo, commit), 512 * 1024 * 1024);

// The new zip must still contain every allowlisted file before we pin it.
const entries = listZipEntries(bytes);
for (const { from } of pin.ship) {
  if (!entries.has(ZIP_ROOT + from)) throw new Error(`new brand zip lacks allowlisted file ${ZIP_ROOT}${from}; not updating the pin`);
}

const next = await rewritePin(pinPath, pin, commit, bytes);
// Seed the cache so the next fetch is a verified cache hit.
const cached = cachePath(join(root, ".brand-cache"), next);
await mkdir(dirname(cached), { recursive: true });
await writeFile(cached, bytes);

if (next.commit === pin.commit) console.log(`brand pin already at ${next.commit}`);
else console.log(`brand pin: ${pin.commit.slice(0, 7)} -> ${next.commit.slice(0, 7)} (${next.size} bytes, sha256 ${next.sha256})\nReview the brand.pin.json diff, then commit.`);
