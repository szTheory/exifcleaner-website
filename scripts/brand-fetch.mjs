// Fetch the pinned brand zip (cached, checksum-verified) and ship the allowlist.
// Runs locally and in the Netlify build (see netlify.toml). Exits non-zero on
// any checksum/size mismatch or missing allowlisted file.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureZip, httpDownload, loadPin, shipAssets } from "./lib/brand.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pin = await loadPin(join(root, "brand.pin.json"));

const { bytes, source } = await ensureZip({
  pin,
  cacheDir: join(root, ".brand-cache"),
  download: httpDownload,
});
const shipped = await shipAssets({ zipBytes: bytes, pin, outDir: join(root, "static", "brand") });
console.log(`brand: ${pin.repo}@${pin.commit.slice(0, 7)} (${source}, sha256 verified); shipped ${shipped.length} file(s) to static/brand/`);
