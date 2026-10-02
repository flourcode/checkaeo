# SideGator

A casual, 10-second gut check for side hustle ideas. The kind of tool someone opens on a break, tries three or four ideas in, and comes back to next week.

Type an idea, get one answer card:

- **A verdict:** Great idea, Worth a shot, Crowded market, Nah, brah, or (for illegal or harmful ideas only) Can't help with that one, with a one-line reason.
- **The sharper version** of the idea, **who pays**, and **what to try first** this week.
- **Names with an open .com.** Gemini suggests 12 brandable names, and the Lambda checks every .com live at the registry in the same request. Only open ones are shown, with a Register link. Near-duplicates (MeowLens and MewLens, Purrshot and Purrshots) are dropped before checking, and the prompt rules out dropped-vowel spellings like "KittnArt".
- **See what's already out there:** 5 related search phrases, each a link to Google results, so people can size up the competition themselves.
- **Try one of these instead:** 3 other ideas on the same interest. One click checks the next one.

Weak or vague ideas are never a dead end. The AI reshapes them into the nearest workable version and says why.

Starting a new idea is one move: after a result, clicking into the box selects the old idea so typing replaces it. **Clear** (or Escape) empties it, and **Check another idea** at the bottom of the card jumps back up with an empty box.

**About the name:** the product is SideGator. Internal names still say "namercheck" (`lambda/namercheck.mjs`, the `NAMERCHECK_GEMINI_MODEL` variable, the project folder) so the existing Lambda setup and environment variables keep working. Renaming those is optional cleanup.

No login, no database, no saved history, no build step. Nothing typed is stored.

## Files

```text
/
  index.html        Page
  styles.css        Styles (light and dark)
  app.js            One request, render the card (no storage)
  README.md
  lambda/
    index.mjs       Router: sends each request to SideGator or the Idea Sifter
    namercheck.mjs  SideGator: Gemini + live .com checks
    sifter.mjs      Idea Sifter: an unchanged copy of the sifter's index.mjs
    lambda.mjs      Alias so the old "lambda.handler" setting keeps working
  namercheck-lambda.zip   The four lambda/ files, ready to upload
```

| Deployment | Files |
|---|---|
| AWS Amplify | `index.html`, `styles.css`, `app.js` |
| AWS Lambda | `namercheck-lambda.zip`, uploaded over the existing Idea Sifter Lambda |

## One Lambda, two tools

SideGator shares the Idea Sifter's Lambda and Function URL (`https://6cu5wlvx2mylhy7xzdefy5bsya0ccmxb.lambda-url.us-east-1.on.aws/`). `index.mjs` only routes:

| Request | Goes to |
|---|---|
| `POST` with an `action` field, `GET /health`, `OPTIONS` | Idea Sifter |
| Everything else (`POST { "kind": "idea" }`, other `GET`s) | SideGator |

`sifter.mjs` is a byte-for-byte copy of the sifter's `index.mjs`. When the sifter changes, drop its new `index.mjs` in as `sifter.mjs` and re-zip.

### Deploy

1. Open the Lambda, choose **Code → Upload from → .zip file**, and pick `namercheck-lambda.zip`. Keep the handler (`index.handler`) and the sifter's timeout.
2. **Function URL CORS:** allow your SideGator site's origin (as well as the sifter's), methods `GET` and `POST`, and header `content-type`. Leave `CORS_ORIGIN` and `SEND_CORS_HEADERS` unset; AWS handles CORS.
3. Push `index.html`, `styles.css` and `app.js` to Amplify.

Quick test:

```sh
curl -s -X POST "https://6cu5wlvx2mylhy7xzdefy5bsya0ccmxb.lambda-url.us-east-1.on.aws/" \
  -d '{"kind":"idea","idea":"meal prep for traveling sales reps"}'
```

### Environment variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | **Required.** Shared with the sifter. |
| `NAMERCHECK_GEMINI_MODEL` | Default `gemini-3.5-flash-lite`. Separate from the sifter's `GEMINI_MODEL`. |
| `GEMINI_TIMEOUT_MS` | Default 20000. |
| `AI_RATE_LIMIT_PER_MINUTE`, `AI_RATE_LIMIT_PER_HOUR` | Per-IP limits, defaults 6 and 40, per warm instance. Enough for someone testing a handful of ideas. |
| `ALLOWED_ORIGINS` | Optional origin allowlist for SideGator requests, such as `https://yourdomain.com`. |
| `BOT_USER_AGENT`, `SITE_URL` | User-Agent sent to the registry. |

## API

`POST { "kind": "idea", "idea": "meal prep for traveling sales reps" }` returns:

```json
{
  "idea": {
    "verdict": "crowded",
    "verdictReason": "People want it, but meal kits are everywhere.",
    "sharpenedIdea": "Frozen meal packs for reps who live in hotels.",
    "whoPays": "Field sales reps, about $80 a week.",
    "firstMove": "Post a sign-up page in two sales subreddits.",
    "keywords": ["healthy meals for travel", "meal prep delivery for one"],
    "alternatives": ["...", "...", "..."],
    "names": [{ "name": "Roadfed", "domain": "roadfed.com", "status": "likely_available" }]
  },
  "model": "gemini-3.5-flash-lite"
}
```

`verdict` is one of `great`, `worth_a_shot`, `crowded`, `nah`, `cant_help`.

Each name's `status` is one of:
- `likely_available`: the registry has no record
- `taken`
- `unknown`: timed out or couldn't be checked

Errors come back as `{ "error": "..." }` with a user-readable message (400, 413, 422, 429, 502, 503, 504).

## How it stays fast

- **One request per check.** The Lambda starts loading the .com registry details while Gemini thinks. It then checks all 12 .coms in parallel, with a 6-second cap, so a slow lookup becomes `unknown` instead of holding up the answer.
- **A short reply.** Gemini returns a short JSON reply (capped at 1,024 tokens) shaped by an enforced schema. There's no `temperature`, because it's deprecated for Gemini 3.5+. Flash-Lite's default minimal thinking is used.
- **A small page.** About 21KB in total, with no storage and no other API calls.

## Honesty rules

- **The AI never decides availability.** Only a registry "not found" makes a name show as open. Anything unclear is `unknown`, and those names are only shown, marked "couldn't check", when the registry couldn't be reached at all.
- **"Open" means likely available.** Premium or reserved names can look the same, and the footer says so.
- **The verdict is labelled** as an AI's quick read, not market research or legal advice.
- **Weak ideas get reshaped, not refused.** Only clearly illegal or harmful ideas get `cant_help`, with no names or keywords and three legitimate alternatives.
- **Model output is parsed, type-checked and length-capped** on the server, and rendered with `textContent` only.
- **Outbound requests are allowlisted:** HTTPS only, to Google's Gemini API, IANA, and the RDAP server from the IANA bootstrap file. Redirects are re-checked.

## Hardening for public traffic

Origin checks only stop other websites; scripts can still call the URL directly. The in-memory rate limits reset with each Lambda instance. For real protection:

- **Reserved concurrency:** set it on the shared function (for example 10–20).
- **Google Cloud budget alert:** set one on the project behind the Gemini key.
- **AWS WAF:** add a rate-based rule if traffic grows.
