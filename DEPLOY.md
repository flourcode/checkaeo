# Deploying CheckAEO

Two parts: a **static site** (any host — Amplify, Cloudflare Pages, Netlify, Vercel…) and **one small serverless function** that performs the scan.

How a scan works: the browser sends one HTTPS request to the function with the URL; the function fetches that site's homepage, robots.txt, sitemap and llms.txt, scores them in memory, and returns JSON in 2–10 seconds. There is no database, no queue, no scheduled job and nothing stored. The function exists only because browsers are not allowed to fetch other people's websites directly.

Pick **one** scanner backend:

| | Cloudflare Worker (Option A) | AWS Lambda Function URL (Option B) |
|---|---|---|
| Code | `worker/src/index.js` | `worker/src/lambda.js` (same engine) |
| Cost | Free tier: 100k requests/day | Free tier: 1M requests/month |
| Setup | ~5 minutes | ~10 minutes |
| Good if | You want the simplest path | You want everything in your AWS account |

---

## Option A — Cloudflare Worker

## 1. Deploy the scanner (Cloudflare Worker)

Requirements: a free Cloudflare account, Node 18+.

```bash
cd worker
npm install
npx wrangler login          # first time only
npx wrangler deploy
```

Wrangler prints a URL like `https://checkaeo-scan.<your-subdomain>.workers.dev`. Test it:

```bash
curl "https://checkaeo-scan.<your-subdomain>.workers.dev/scan?url=example.com"
```

You should get JSON with `"ok": true`, a `score`, and four `categories`.

### Optional hardening

- **Lock CORS to your domain**: in `worker/wrangler.toml` set  
  `ALLOWED_ORIGINS = "https://checkaeo.com,https://www.checkaeo.com"`  
  (comma-separated, no spaces required). `*` allows any site to call your scanner.
- **Custom domain** (e.g. `scan.checkaeo.com`): Cloudflare dashboard → Workers → your worker → Settings → Domains & Routes.
- **Rate limiting**: the worker has a best-effort in-memory limit (12 scans/min/IP per isolate). For a hard limit, add Cloudflare's Rate Limiting rules on the route.
- **Caching**: results are cached at the edge for 10 minutes (`CACHE_TTL` in `src/index.js`). Append `?fresh=1` to bypass while testing.

## Option B — AWS Lambda (all-AWS with Amplify)

1. Build the package: `cd worker && ./build-lambda.sh` → `worker/lambda.zip` (≈70 KB, no dependencies).
2. AWS Console → Lambda → **Create function** → Author from scratch → Runtime **Node.js 20.x** (or newer), architecture arm64 is fine.
3. Code → **Upload from .zip** → `lambda.zip`. Runtime settings → Handler: **`lambda.handler`**.
4. Configuration → General: **Timeout 30 s**, Memory 256 MB.
5. Configuration → **Function URL** → Create → Auth type **NONE** → tick **Configure CORS** → Allow origin `*` (or `https://checkaeo.com`), Allow methods `GET, POST`, Allow headers `content-type`.
6. Copy the Function URL (looks like `https://abc123.lambda-url.us-east-1.on.aws/`). Test: `curl "<url>scan?url=example.com"`.
7. Put it in `assets/js/config.js` as `SCAN_API_URL` (trailing slash is fine either way).

Optional: put CloudFront or API Gateway in front for a custom domain (`scan.checkaeo.com`) and AWS WAF rate limiting. The function also has a best-effort in-memory limit of 12 scans/minute/IP.

You can also run the same zip through **Amplify Gen 2 functions**, SAM or CDK — the handler has no AWS-specific dependencies.

## 2. Configure the front end

Open **`assets/js/config.js`**:

```js
SCAN_API_URL: 'https://checkaeo-scan.<your-subdomain>.workers.dev',   // no trailing slash
GA4_MEASUREMENT_ID: 'G-XXXXXXXXXX',                                    // or '' to disable analytics
```

- If `SCAN_API_URL` is left as `'YOUR_WORKER_URL'` or empty, the site runs in demo mode.
- If `GA4_MEASUREMENT_ID` is empty, **no analytics script is loaded at all**. When set, gtag.js is loaded with `anonymize_ip` and these events are sent: `scan_start`, `scan_complete` (score, grade), `scan_error`, `demo_view`, `export_png` (size), `export_svg`, `copy_image`, `copy_summary`, `share` (method), `show_fix`.

## 3. Deploy the static site

Upload the project root (everything except `worker/`) to any static host. The site uses clean URLs (`/methodology/` → `methodology/index.html`), which every host below supports by default.

**AWS Amplify Hosting** (GitHub repo)
1. Amplify Console → New app → Host web app → connect the GitHub repo and branch.
2. Amplify detects the included `amplify.yml`. It has no build step — it just copies the site into `dist/` and excludes the `worker/` source so it isn't published. Every push to the branch redeploys.
3. App settings → **Rewrites and redirects** → add a rule: Source `/<*>`, Target `/404.html`, Type **404 (Rewrite)** so unknown URLs show the styled 404 page. Clean URLs (`/methodology/` → `methodology/index.html`) work by default.
4. Domain management → add `checkaeo.com` (Amplify issues the certificate). Redirect `www` → apex.
5. Before your first push, set `SCAN_API_URL` (and optionally `GA4_MEASUREMENT_ID`) in `assets/js/config.js` — it's a plain file in the repo, no environment variables needed.

**Cloudflare Pages** (same account as the worker if you chose Option A)
```bash
npx wrangler pages deploy . --project-name checkaeo
```
Or connect the repo in the dashboard with no build command and output directory `/`.

**Netlify**: drag the folder onto app.netlify.com, or `netlify deploy --prod --dir=.`  
**Vercel**: `vercel --prod` (framework preset: Other)  
**GitHub Pages**: push to a repo, enable Pages from the root. Note: GitHub Pages serves `404.html` automatically.

### 404 page
- Cloudflare Pages, Netlify, GitHub Pages: `404.html` at the root is picked up automatically.
- Vercel: add `{ "cleanUrls": true }` and a rewrite to `/404.html` if needed, or rely on its default 404.

### Headers (optional but recommended)
Add these at your host (e.g. a `_headers` file for Cloudflare Pages / Netlify):
```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

## 4. Verify

1. Open the site, paste a public URL, click **Get my AEO Card**. A card should appear in ~5–15 s.
2. **Download card** → Square. The PNG should be 2160×2160 with the Manrope font rendered.
3. Visit `/?url=example.com` — the scan should start automatically.
4. Visit `/#demo=harborandoak` — the example card should show with the "example" notice.
5. Run `cd worker && npm test` — all tests pass.

## Updating the demo examples

`assets/js/demo-data.js` is generated by running the real analyzer over the HTML fixtures in `worker/test/`. If you change scoring, regenerate it so the examples stay honest (`cd worker && node test/generate-demo-data.mjs`).

## Remaining placeholders

- `assets/js/config.js` → `SCAN_API_URL`, `GA4_MEASUREMENT_ID`
- `hello@checkaeo.com` appears in the footer and on the About page — change if you use a different contact address.
