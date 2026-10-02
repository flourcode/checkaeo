# NamerCheck

A free tool for people daydreaming about escaping their 9-to-5. It works in two steps:

1. **Test the side hustle idea.** Someone types a rough, one-sentence idea. Gemini 3.5 Flash-Lite returns an honest first read: a sharper version of the idea, who pays, the risks, a 7-day validation test, where to find the first 10 customers, the first two evenings of work, and 12 name ideas, with the ones whose .com looks open listed first. The page then builds a landing page prompt that uses whichever name the person checks. Each suggested name gets a real .com check.
2. **Check the name.** Picking a name (or typing one) checks domains through RDAP, the major social handles, and a local naming-distinctiveness score.

There's no login, database, pricing, email capture, or build step.

## Project structure

```text
/
  index.html        Page markup
  styles.css        Styles (light and dark)
  app.js            Frontend: idea test, normalization, scoring, batch checks, recent checks
  README.md         This file
  lambda/
    index.mjs       Router: sends each request to NamerCheck or the Idea Sifter
    namercheck.mjs  NamerCheck: availability checks + Gemini idea report
    sifter.mjs      Idea Sifter: an unchanged copy of the sifter's index.mjs
    lambda.mjs      Alias so the old "lambda.handler" setting keeps working
  namercheck-lambda.zip   The four lambda/ files, ready to upload
```

There are two separate deployments:

| Deployment | Files |
|---|---|
| AWS Amplify (static hosting) | `index.html`, `styles.css`, `app.js` and nothing else |
| AWS Lambda | `namercheck-lambda.zip`, uploaded over the existing Idea Sifter Lambda |

## One Lambda, two tools

NamerCheck shares the Idea Sifter's Lambda and Function URL:

```text
https://6cu5wlvx2mylhy7xzdefy5bsya0ccmxb.lambda-url.us-east-1.on.aws/
```

The tools don't share code. `index.mjs` is a small router that only decides who answers:

| Request | Goes to |
|---|---|
| `POST` with an `action` field (`fetch_feed`, `triage`, `analyze_betalist`, `plan`) | Idea Sifter |
| `GET /health` and `OPTIONS` | Idea Sifter (its page checks `/health` for `"service": "betalist-idea-sifter"`) |
| `POST` with `kind` or `checks`, and any other `GET` | NamerCheck |

`sifter.mjs` is a byte-for-byte copy of the sifter's `index.mjs`. When the sifter changes, rename its new `index.mjs` to `sifter.mjs`, drop it into `lambda/`, and re-zip. Don't edit sifter code here.

To give NamerCheck its own Lambda later, deploy `namercheck.mjs` on its own, renamed to `index.mjs`. It works standalone.

## The rule that matters most

Every domain and handle result is one of four statuses:

| Status | Label | Meaning |
|---|---|---|
| `available` | Available | The platform said explicitly that the name is free. No current check returns this; it's kept for any future source that answers explicitly. The page doesn't list it in its legend. |
| `likely_available` | Likely Available | The authoritative source has no record. Reserved, premium, or deleted names can look the same. |
| `taken` | Taken | A registration exists, an account exists, or a suspended account holds the name. |
| `unknown` | Unable to Verify | The check couldn't establish the answer. |

These never become Available or Taken: HTTP 403, HTTP 429, a CAPTCHA, a login wall, an anti-bot response, a timeout, a malformed response, unexpected HTML, or a network error. All of them are `unknown`.

"Unable to Verify" is a deliberate part of the product, not a bug to hide. If you add or change a platform, keep to this rule: classify a result only on positive evidence, and return `unknown` for everything else.

## The AI never decides availability

Gemini writes the idea report and suggests names. It never says whether a name, domain, or handle is free, and its system prompt forbids claiming that. Every suggested name goes through the same RDAP and platform checks as a typed name, under the same four-status rules.

AI output is labelled on the page as an opinion, not market research. All of it is rendered as plain text, never as HTML.

## One request per check

When someone clicks **Check this name**, the browser sends **one** request to the Lambda. That request holds a `checks` array with every selected domain and every primary social platform. Every row shows "Checking…" right away, and all rows fill in when the batch returns.

**Check fallback handles** works the same way: one request covers every fallback handle on every platform.

**Test my idea** makes two requests: one AI request for the report, then one batch request that checks the .com of every suggested name. **Check this name** on a suggestion then runs a normal name check, which is one more batch.

A single **Try again** on a row sends a batch of one.

Inside the Lambda, every check in a batch is isolated:

- Each check runs in parallel, up to `BATCH_CONCURRENCY`.
- Each has a hard deadline of `CHECK_DEADLINE_MS`.
- If one upstream service fails, throws, or hangs, only that item comes back `unknown`. The rest of the batch still returns.
- The frontend also checks each item, and turns any missing or malformed result into `unknown`.

A primary check holds 7 items (.com, .io and .co plus 4 platforms). A fallback check holds 12 (3 handles on 4 platforms). Both fit easily under `MAX_BATCH = 30`.

## Deploy the Lambda

This overwrites the Idea Sifter's code with the combined version. The sifter keeps working.

1. In the AWS console, open the existing Idea Sifter function.
2. **Code → Upload from → .zip file** and choose `namercheck-lambda.zip`.
3. **Runtime settings:** keep the handler at `index.handler` (`lambda.handler` also works) and the runtime at Node.js 20.x or newer.
4. **Timeout:** keep the sifter's current timeout. The sifter waits up to 85 s for Gemini, so it's already longer than NamerCheck needs. NamerCheck caps its own work at about 20 s per check and 24 s per idea report.
5. **Function URL CORS** (Configuration → Function URL → Edit). AWS adds the CORS headers here, and the code doesn't add its own:
   - **Allow origin:** your NamerCheck site, such as `https://yourdomain.com` or the `https://….amplifyapp.com` address, as well as the sifter's origin. `*` works while testing.
   - **Allow methods:** `GET`, `POST`
   - **Allow headers:** `content-type`
   - Leave `CORS_ORIGIN` and `SEND_CORS_HEADERS` unset. If you ever move to an API Gateway REST API, set `CORS_ORIGIN` and both tools will send their own headers instead.
6. **Environment variables:** add the NamerCheck ones you want from the table below. `GEMINI_API_KEY` is shared with the sifter, so it's probably already set.
7. `app.js` already points at the shared Function URL.

Quick test after uploading:

```sh
URL=https://6cu5wlvx2mylhy7xzdefy5bsya0ccmxb.lambda-url.us-east-1.on.aws/
curl -s "${URL}health"                                    # sifter: "service":"betalist-idea-sifter"
curl -s -X POST "$URL" -d '{"checks":[{"kind":"domain","domain":"example.com"}]}'
curl -s -X POST "$URL" -d '{"kind":"idea","idea":"meal prep for traveling sales reps"}'
```

### Environment variables

| Variable | Purpose |
|---|---|
| `ALLOWED_ORIGINS` | **Set this in production:** `ALLOWED_ORIGINS=https://YOURDOMAIN.COM`. Use a comma-separated list if you have several, such as your Amplify preview domain. The default `*` allows any origin. |
| `YOUTUBE_API_KEY` | Uses the official YouTube Data API (`channels.list` with `forHandle`). Strongly recommended. |
| `GITHUB_TOKEN` | A fine-grained token with no scopes. Raises GitHub's limit from 60 to 5,000 requests an hour. |
| `GEMINI_API_KEY` | **Required for idea testing.** Shared with the Idea Sifter. Without it, idea requests return 503 and name checks still work. |
| `NAMERCHECK_GEMINI_MODEL` | Default `gemini-3.5-flash-lite`. This is separate from the sifter's `GEMINI_MODEL`, so changing the sifter's model never changes NamerCheck's. |
| `GEMINI_TIMEOUT_MS` | Default 24000. Keep it under the Lambda timeout. |
| `AI_RATE_LIMIT_PER_MINUTE`, `AI_RATE_LIMIT_PER_HOUR` | Per-IP limits on idea reports. Defaults are 3 a minute and 15 an hour, per warm instance. |
| `BOT_USER_AGENT`, `SITE_URL` | The User-Agent sent to APIs. `SITE_URL` gets appended so operators can reach you. |
| `CHECK_TIMEOUT_MS` | Per-request upstream timeout. Default 8000. |
| `CHECK_DEADLINE_MS` | Hard limit per check inside a batch. Default 20000. |
| `BATCH_CONCURRENCY` | Checks run in parallel per batch. Default 12. |
| `RATE_LIMIT_PER_MINUTE` | In-memory limit on requests (batches) per IP. Default 30. See the hardening notes below. |
| `SEND_CORS_HEADERS` | Leave unset. It defaults to `false` when `CORS_ORIGIN` is empty, because the Function URL handles CORS. |

The API keys stay in Lambda. The browser never sees them. The sifter's own variables (`GEMINI_MODEL`, `GEMINI_THINKING_LEVEL`, `FEED_HOSTS`, `CORS_ORIGIN`) only affect the sifter. `ALLOWED_ORIGINS` and the rate limits above only affect NamerCheck requests.

## Production hardening

**Set `ALLOWED_ORIGINS=https://YOURDOMAIN.COM`.** This stops other websites from using your endpoint from their visitors' browsers.

**CORS and origin checks are not abuse protection.** The `Origin` header is enforced by browsers only. Anyone using `curl`, a script, or a server can send any `Origin` they like, or none at all. Treat the endpoint as public.

**Shared Lambda, shared limits.** Both tools run on one function, so reserved concurrency and any WAF rule cover both. Heavy NamerCheck traffic could slow the sifter. If the public NamerCheck site gets busy, give it its own Lambda (see "One Lambda, two tools").

**Put real throttling in front of the Lambda.** A Function URL has no built-in throttling. For a public deployment, use one or both of these:

- **Reserved concurrency:** the simplest cap with a Function URL. Set it to around 10–20 on the shared function.
- **API Gateway throttling:** stage or route rate and burst limits, for example 5 requests per second with a burst of 10. This needs an API Gateway in front instead of the Function URL.
- **AWS WAF:** a rate-based rule per IP, such as 100 requests per 5 minutes, attached to API Gateway or to a CloudFront distribution in front of a Function URL. AWS managed rules can also filter known bad bots.

**Don't rely only on the built-in rate limiter.** The Lambda's in-memory limiter and its result cache (10 minutes for definite results, 1 minute for unknowns) exist per warm instance. Concurrent instances don't share them, and a cold start resets them. They're a convenience, not protection. No database is needed: API Gateway throttling, WAF, and reserved concurrency cover it.

**Cap the AI spend in Google too.** The AI limits in the Lambda are per warm instance, like the other in-memory limits. Set a budget alert on the Google Cloud project behind your Gemini key, and lower its requests-per-minute quota if you want a hard ceiling. On the free tier, Google's limits are themselves the cap.

**Input whitelisting and SSRF protection** are built in:

- `kind` must be `domain` or `social` inside a batch. `idea` is only accepted on its own, never inside `checks`.
- Ideas must be 8–1,000 characters. Gemini's reply is parsed, then every field is type-checked, trimmed and length-capped, and names are stripped to letters, numbers and spaces.
- `platform` must be an own key of the `platforms` object.
- Every handle must pass its platform's username rules before any request is made.
- Domains must be valid LDH names whose TLD has an HTTPS RDAP server in the IANA bootstrap file.
- Every outbound request, **including every redirect hop**, must be HTTPS on port 443, to a host on the fixed allowlist (`ALLOWED_HOST_SUFFIXES`) or to a known RDAP server. IP literals and `localhost` are refused. A redirect anywhere else stops the check and returns `unknown`.
- Bodies are limited to 20 KB, batches to 30 items, and upstream responses are read to at most 2 MB.

## API

Send a `POST` with a JSON body. The frontend sends it as `text/plain` so there's no CORS preflight; the Lambda parses either.

```json
{
  "checks": [
    { "kind": "domain", "domain": "quotabird.com" },
    { "kind": "domain", "domain": "quotabird.io" },
    { "kind": "social", "platform": "youtube", "handle": "quotabird" },
    { "kind": "social", "platform": "github", "handle": "quotabird" }
  ]
}
```

The response is `{ "results": [...] }`, in the same order as `checks`. A single check object without the `checks` wrapper also still works.

Idea report:

```json
{ "kind": "idea", "idea": "meal prep for traveling sales reps" }
```

The response is `{ "idea": { ...report... }, "model": "gemini-3.5-flash-lite" }`. The report has these fields:

- `verdict`: one of `promising`, `needs_sharpening`, `tough_road`, `not_a_business_idea`
- `verdictReason`, `sharpenedIdea`
- `assumptions` (array)
- `targetCustomer`, `painPoint`, `valueProposition`, `revenueModel`, `existingAlternatives`, `fitsAround9to5`
- `risks` (array)
- `validation`: `{ sevenDayTest, successSignal, pivotSignal }`
- `timeline`: `{ day1, day2 }`
- `realityCheck`
- `firstCustomers` (array): where the first 10 buyers are and how to approach them
- `headline`, `benefits` (array of 3), `price`: short landing page ingredients
- `nicheWords` (array)
- `nameIdeas`: an array of `{ name, why }`

Errors come back as `{ "error": "..." }`:

| Status | Meaning |
|---|---|
| 400 | Idea too short |
| 413 | Idea too long |
| 422 | The model declined to evaluate it |
| 429 | Rate limited |
| 502 | Bad or incomplete AI output |
| 503 | Not configured, or the AI is busy |
| 504 | Timed out |

The error messages are written for end users. The frontend shows them as they are.

Example availability result:

```json
{
  "kind": "social", "platformId": "github", "platform": "GitHub",
  "handle": "quotabird", "status": "taken", "confidence": "high",
  "url": "https://github.com/quotabird", "method": "api",
  "note": "Used by a user on GitHub.", "checkedAt": "2026-10-02T12:00:00.000Z"
}
```

`method` is one of `api`, `public_page`, `rdap`, `validation`, or `error`.

Handles that break a platform's rules (for example, more than 15 characters on X) come back `unknown` with `invalid: true` and a note that explains the rule.

A `GET` request returns a health object showing which official APIs are configured.

Quick test:

```sh
curl -s -X POST "$URL" -d '{"checks":[{"kind":"domain","domain":"example.com"},{"kind":"social","platform":"github","handle":"octocat"}]}'
```

## Deploy the frontend on Amplify

Deploy only `index.html`, `styles.css`, and `app.js`. There are two ways:

- **Manual deploy:** zip those three files and drag the zip into Amplify Hosting.
- **Git:** connect the repo and keep the `lambda/` folder out of the published output. For example, use a `baseDirectory` that holds only the static files, or a build step that copies the three files into `dist/`.

There's no build step for the frontend itself.

## How each check works

### Domains

The Lambda uses RDAP. The IANA bootstrap file (`data.iana.org/rdap/dns.json`) maps each TLD to its authoritative RDAP server, and the Lambda caches it for 24 hours.

- A `200` response whose `ldhName` matches the domain means **Taken**. The result includes the registration year and registrar when the registry provides them.
- A `404` means **Likely Available**.
- **.io and .co** run RDAP but aren't in the IANA bootstrap (it's optional for country-code TLDs). Their servers are listed in `SUPPLEMENTAL_RDAP` in `namercheck.mjs`. Before a supplemental server's "not found" counts as Likely Available, it must prove itself: one of its control domains (`nic.io`, `google.io`, `nic.co`, `google.co`), which are known to be registered, has to come back as a matching registration. This is checked every 6 hours per warm instance. If it fails, every lookup on that TLD is Unable to Verify, so a wrong or broken server can't produce false "available" results.
- A TLD with no RDAP server, a timeout, a `429`, or any other answer means **Unable to Verify**.
- Domains in redemption or pending delete are still **Taken**, with a note saying so.

### GitHub

The Lambda calls `api.github.com/users/{name}`. Users and organizations share one namespace.

- A `404` means **Likely Available**, because names from suspended or deleted accounts can be held.
- A `403` or `429` is a rate limit, so the result is **Unable to Verify**.

### YouTube

With `YOUTUBE_API_KEY` set, the Lambda uses the Data API. Without it, the Lambda fetches the public `@handle` page:

- A canonical `/channel/UC…` link means **Taken**.
- A real `404` on youtube.com means **Likely Available** (low confidence).
- A redirect to a consent page means **Unable to Verify**.

### Instagram, X, Facebook, Threads, LinkedIn, Reddit

Not checked. From AWS servers they always return login walls, anti-bot pages or HTTP 403, so any result would be a guess, and showing a wall of "Unable to Verify" made the tool look broken. The page links straight to the handle on Instagram, X, Facebook, Threads and LinkedIn instead, labelled as not checked.

X and Reddit could come back with official API credentials (an X API bearer token, Reddit app-only OAuth). Each would be one adapter in `platforms` in `namercheck.mjs` plus a matching entry in `PLATFORMS` in `app.js`.

### Bluesky

The Lambda calls `com.atproto.identity.resolveHandle` on `public.api.bsky.app` for `{name}.bsky.social`. An error saying the handle couldn't be resolved means **Likely Available**.

## Idea testing with Gemini 3.5 Flash-Lite

This replaces the old Side Hustle Slingshot (`mvp_launch_plan`) endpoint and keeps its launch-plan fields. What changed from that handoff:

- **One endpoint.** The idea route lives in this same Lambda (`{ "kind": "idea" }`), so the site talks to one URL and the Gemini key stays server-side.
- **Model.** `gemini-3.5-flash-lite` (GA), called through `generateContent`. Change it with `GEMINI_MODEL`.
- **No `temperature`.** Google deprecated `temperature`, `top_p` and `top_k` starting with the 3.5 Flash-Lite and 3.6 Flash generation, so the request leaves them out. Flash-Lite defaults to the `minimal` thinking level, which suits this task.
- **Enforced JSON.** The request sends a JSON Schema (`responseJsonSchema`) so the model has to return the exact report shape. If an API version ever rejects the schema field, the Lambda retries once in plain JSON mode. It still strips stray code fences before parsing.
- **Key in a header.** The key goes in `x-goog-api-key` instead of the `?key=` query string, so it doesn't end up in URLs or logs.
- **Landing page prompt built in the browser.** Gemini no longer writes `mvpPrompt`. It returns short ingredients (`headline`, `benefits`, `price`), and `buildLandingPrompt()` in `app.js` assembles the prompt from them plus the report. That makes the AI reply about a third shorter: cheaper, faster, and less likely to be cut off. The prompt also uses the name the person actually checked, and updates if they check another. The page it describes runs the 7-day test, with every button pointing at a `FORM_LINK_URL` placeholder.
- **Sharper angle.** The system prompt makes the model shrink broad or crowded ideas to one buyer, one job, one input and one result ("a checker instead of a platform"). `sharpenedIdea` is that narrower version, not a restatement.
- **First customers.** `firstCustomers` says where the first 10 buyers can be reached and how to approach them. It describes kinds of places, and names a community only if it's certain the community exists.
- **Thin prompts work.** When the idea is vague, the model picks the most plausible specific version and lists its assumptions on the page, instead of guessing silently.
- **Honest output.** The system prompt tells the model to be blunt and not invent statistics or company names. Off-topic or harmful input gets the verdict `not_a_business_idea` with no plan.
- **Safer rendering.** The old card injected AI text with `innerHTML`. Everything is now rendered with `textContent`.
- **New fields.** The report adds `nicheWords`, which feed the distinctiveness score for the suggested names, and `nameIdeas`.

**Privacy:** the idea text goes to Google's Gemini API and isn't stored by NamerCheck. It isn't in recent checks, the URL, or Lambda logs. Google's API terms govern what Google receives. On the free tier Google may use prompts to improve its products, so check the current terms, and use a paid-tier key if that matters to you. The FAQ on the page says this in plain words.

**Cost:** one report is roughly 1,500 input tokens and about 1,500–2,000 output tokens, capped at 3,072. At the published Flash-Lite price ($0.30 per million input tokens, $2.50 per million output), that's under a cent per report. Check Google's pricing page for current rates.

## Fragile unofficial check: TikTok

TikTok has no public username API. Its adapter depends on page markup that can change without notice, so the fragile parts live in small helpers in a `FRAGILE` comment block in `lambda/namercheck.mjs`:

| Helper | What it depends on |
|---|---|
| `extractTikTokUserDetail(html)` | The `__UNIVERSAL_DATA_FOR_REHYDRATION__` script tag on TikTok profile pages. |
| `tiktokDetailMatchesHandle(detail, handle)` | The `userInfo.user.uniqueId` field. |
| `isTikTokNotFound(detail)` and `TIKTOK_NOT_FOUND_CODES` | The status codes that mean "no account". Banned and private codes deliberately stay unknown. |

If TikTok changes its pages and a helper stops matching, the result falls through to **Unable to Verify**. It never guesses. If TikTok starts blocking AWS outright, remove it from both platform lists, the same way the others were removed.

## Expect occasional "Unable to Verify"

The four checked platforms and the three registries normally answer. Rate limits and timeouts still happen, and they show as **Unable to Verify** with a **Try again** link and a direct link to look by hand. That's the honest result. Without a `GITHUB_TOKEN`, GitHub allows only 60 lookups an hour from one Lambda, so set the token.

## Recent checks

The browser keeps the last 8 checked names in `localStorage` under `namercheck:recent`, stored only as `{ "name": "QuotaBird", "checkedAt": 1234567890 }`. Each entry can be checked again or removed, and **Clear history** removes them all.

Availability results are never stored, so **Check again** always runs fresh lookups. If `localStorage` is blocked or full, the section stays hidden and everything else keeps working.

## Adding or removing a platform

1. In `lambda/namercheck.mjs`, add an entry to `platforms` with `name`, `profileUrl`, `validate`, and `check`. Then add its hosts to `ALLOWED_HOST_SUFFIXES`.
2. In `app.js`, add the matching entry to `PLATFORMS` with `name`, `url`, and `display`, using the same key.
3. Keep `platforms + domain endings ≤ MAX_BATCH` (today 4 + 3). If you add many, raise `MAX_BATCH` in the Lambda and `CONFIG.maxBatch` in `app.js` together.

Domains are limited to .com, .io and .co (`CONFIG.tlds` in `app.js`), the endings people actually start with. All three are checkable through registry RDAP. To add an ending, add it to `CONFIG.tlds` and check that its registry has an RDAP server, either in the IANA bootstrap or verified in `SUPPLEMENTAL_RDAP`. Otherwise it will always show "Unable to Verify".

## The distinctiveness score

The score runs locally in `app.js` (`scoreName`). It starts at 100 and takes points off for:

- **an everyday English word** (−40). This is the biggest single signal: words like Pond, Bask or Verde almost never have their .com free and are hard to own in search. Simple plurals and verb forms count too.
- **length** outside the 5–8 letter sweet spot (−3 to −15)
- **spelling that isn't obvious from sound**, such as "ph", "ch", an "x", a "q" without "u", a soft "c", or "y" used as a vowel (−4, or −8 for two or more)
- common SaaS prefixes and suffixes, overused startup words, dropped vowels ("Taskr"), consonant clusters and digits
- looking or sounding like well-known products (Dice and Levenshtein similarity, plus a simple phonetic key)
- closeness to the optional competitor and niche words (capped at −36 total)

Only names with none of these problems reach 100: invented or compound, 5–8 letters, easy to spell. In the name ideas list, an everyday word is labelled "Everyday word" instead of showing a number.

**The everyday-word list** (`WORD_DATA` near the end of `app.js`) holds about 31,000 English words from the open-source [wordfreq](https://github.com/rspeer/wordfreq) project. Words of 4–6 letters are included at a Zipf frequency of 2.5 or higher, longer words at 3.0 or higher. It's front-coded to keep it around 50 KB gzipped. Rare real words, such as "terrapin", aren't in it; their .com check still shows them as taken. To regenerate:

```python
# pip install wordfreq
from wordfreq import zipf_frequency, iter_wordlist
import itertools
words = sorted({w for w in itertools.islice(iter_wordlist("en"), 300000)
                if w.isascii() and w.isalpha() and w.islower() and 4 <= len(w) <= 10
                and zipf_frequency(w, "en") >= (2.5 if len(w) <= 6 else 3.0)})
out, prev = [], ""
for w in words:
    k = 0
    while k < min(len(prev), len(w), 9) and prev[k] == w[k]:
        k += 1
    out.append(f"{k}{w[k:]}")
    prev = w
print("".join(out))  # paste into WORD_DATA
```

It measures naming distinctiveness only. It isn't a trademark score, legal clearance, a guarantee of search uniqueness, or a guarantee that a name can be registered. The page says so.

## Links

The "Check registrar" link goes to Namecheap search, and the registration lookups go to ICANN Lookup. Neither is an affiliate link. Change `CONFIG.registrarUrl` if you'd like a different registrar.

## Free, permanently

NamerCheck has no paid tier, pricing, Stripe, upgrade prompts, premium results, email capture, login, accounts, database, or license keys.
