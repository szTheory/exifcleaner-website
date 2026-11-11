[![Netlify Status](https://api.netlify.com/api/v1/badges/5a6f90a6-5f68-4990-9b66-4a9efec08bed/deploy-status)](https://app.netlify.com/sites/exifcleaner/deploys)

# exifcleaner-website

>Official website for [ExifCleaner, a desktop app for removing image metadata.](https://exifcleaner.com)


## Development

Built with Hugo, a static site generator written in Go. Uses npm for JavaScript package management.

### Running locally

Start the website with

```bash
hugo server
```

Then open http://localhost:1313/

### Brand assets

Brand files are never committed here. `brand.pin.json` pins one commit of
[szTheory/exifcleaner-brand](https://github.com/szTheory/exifcleaner-brand) by its
zip's sha256 and size. Node 20+ only, no dependencies.

```bash
npm run brand:fetch    # download (cached in .brand-cache/), verify, ship the allowlist to static/brand/
npm run build          # brand:fetch, then hugo (this is what Netlify runs)
npm run brand:update   # move the pin to latest main; or: npm run brand:update -- <ref-or-sha>
npm test               # checksum, cache, pin-rewrite tests (no network)
```

A checksum or size mismatch fails the build. Only the files listed in the pin's
`ship` allowlist are copied to `static/brand/` (gitignored). To change what the site
receives, edit the allowlist; to take a new brand revision, run `brand:update` and
commit the `brand.pin.json` diff.

## License

MIT