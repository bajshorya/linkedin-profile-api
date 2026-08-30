# LinkedIn Profile API

A public HTTPS API that returns structured JSON for a LinkedIn profile. Given a
profile URL, it authenticates to LinkedIn with a server-side session cookie, calls
LinkedIn's internal **Voyager** API directly (no headless browser), normalizes the
response, and returns a clean, stable JSON contract.

```bash
curl -s "https://YOUR_DEPLOYMENT/api/v1/profile?url=https://www.linkedin.com/in/williamhgates" \
  -H "x-api-key: YOUR_API_KEY" | jq .data.fullName
# "Bill Gates"
```

A full example response is in [`docs/example-response.json`](docs/example-response.json).

---

## Approach — how it works

LinkedIn's web app talks to an internal REST/GraphQL API under
`https://www.linkedin.com/voyager/api/...`. Every authenticated browser request
carries the `li_at` session cookie and a CSRF token. This service reproduces those
requests server-side.

**Reverse-engineering.** Using Chrome DevTools (Network tab, filtered to `voyager`)
against a logged-in session, I captured the request that a profile page fires,
replayed it with `curl`, and stripped headers until I found the minimal working set:

```
cookie: li_at=<...>; JSESSIONID="ajax:<...>"
csrf-token: ajax:<...>            # must equal the JSESSIONID value
accept: application/vnd.linkedin.normalized+json+2.1
x-restli-protocol-version: 2.0.0
x-li-lang: en_US
user-agent: <a real Chrome UA>
```

**The endpoint.** The single most useful call takes the public vanity name directly
and returns the core profile plus experience and education in one request:

```
GET /voyager/api/identity/dash/profiles
      ?q=memberIdentity
      &memberIdentity=<vanityName>
      &decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-101
```

Skills, certifications, and languages are fetched from their own section calls and
merged in. (The older `/identity/profiles/{id}/profileView` aggregate endpoint is
now `410 Gone` — this uses the current dash/GraphQL surface.)

**The normalized-JSON model.** With the `normalized+json` accept header the response is:

```json
{ "data":  { "*elements": ["urn:li:fsd_profile:..."] },
  "included": [ { "entityUrn": "urn:li:...", "$type": "...Position", "*company": "urn:li:..." } ] }
```

`included` is a flat pool of entities keyed by `entityUrn`. Fields starting with `*`
are pointers (a URN or array of URNs) into that pool; collections are two hops
(`*field` → CollectionResponse → `*elements` → entities). The core of the code is a
small **index + resolver** ([`src/linkedin/normalize.ts`](src/linkedin/normalize.ts)):
build `Map<urn, entity>` once, then each parser resolves pointers off the index. This
keeps parsers pure and unit-testable from fixtures, and decoupled from which endpoint
produced the data.

**Account protection.** The service is backed by a *single* personal LinkedIn session
on one IP. Parallel or bursty requests are the fastest way to get that session
flagged, so all upstream calls go through a queue (`concurrency: 1`) with a jittered
gap between them, plus a per-UTC-day cap. A 12h response cache means repeat lookups
never touch LinkedIn at all. This is a deliberate throughput ceiling, documented as a
limitation below.

**Swappable source.** The data origin sits behind a `ProfileSource` interface, so the
Voyager client can be mocked in tests (and, in principle, swapped) without touching
the parsers.

---

## Architecture

```
client ──GET /api/v1/profile?url=…──▶ Express
   │ requestId → helmet → apiKey → per-IP rate limit
   ▼
profile.route ──▶ zod validate { url }
   ▼
utils/url.parse ──▶ publicId            (400 INVALID_URL on failure)
   ▼
cache.get(publicId) ──hit──▶ return (X-Cache: HIT)
   │ miss
   ▼
p-queue (concurrency 1, jittered gap, daily cap)
   ▼
VoyagerSource.fetchProfileBundle(publicId)
   │  FullProfile call + skills/certs/languages sections
   │  401/403/999/login-redirect → LINKEDIN_AUTH_EXPIRED · 404 → PROFILE_NOT_FOUND · 429 → LINKEDIN_RATE_LIMITED
   ▼
normalize(data, included) ──▶ parsers/* ──▶ assemble Profile
   ▼
ProfileSchema.parse()   (guarantees the documented contract)
   ▼
cache.set · respond 200 { data, meta }
```

---

## Quickstart

Requires Node 20+.

```bash
git clone <repo> && cd linkedin-profile-api
cp .env.example .env        # then fill in the values (see below)
npm install
npm run dev                 # http://localhost:3000
```

### Getting the LinkedIn session values

1. Log into LinkedIn in Chrome. **Use a disposable account** — automated access can
   get an account restricted.
2. DevTools → Application → Cookies → `https://www.linkedin.com`.
3. Copy `li_at` → `LI_AT`, and `JSESSIONID` (looks like `ajax:12345`) → `JSESSIONID`.
4. Set `API_KEY` to any random string. Callers send it as `x-api-key`.

### Docker

```bash
docker build -t linkedin-profile-api .
docker run -p 3000:3000 --env-file .env linkedin-profile-api
```

### Deploy (Render, free tier)

The repo includes a [`render.yaml`](render.yaml) blueprint. In the Render dashboard:
**New → Blueprint → connect this repo**. Render reads the blueprint, then prompts for
the three secrets (`API_KEY`, `LI_AT`, `JSESSIONID`). It builds with
`npm ci && npm run build` and serves `npm start`, with `/health` as the health check.

Note: the free tier sleeps after ~15 min idle, so the first request after a lull takes
~30–50s to wake. Fine for evaluation; upgrade the plan or add an external pinger to keep
it warm if that matters.

---

## API reference

### `GET /health` (open)
Returns `{ ok, uptime, sessionConfigured, sessionValid }`. `sessionValid` is a cached
probe of LinkedIn's `/me` (at most once per 10 min), so you can see instantly whether
the cookie has died.

### `GET /api/v1/profile?url=<linkedin url>` · `POST /api/v1/profile`
Requires `x-api-key`. `POST` takes `{ "url": "...", "refresh": true }`. `?refresh=true`
bypasses the cache. Response headers include `X-Cache: HIT|MISS`.

Accepted URL forms: `https://www.linkedin.com/in/<slug>`, no-scheme, trailing slash,
query/fragment, locale subdomains (`in.linkedin.com`), percent-encoded slugs, and a
bare `<slug>`. Rejected: `/company/`, `/school/`, `/posts/`, anything not `/in/`.

The response shape is stable — every field is nullable or defaults to `[]`, and keys
are never omitted. See [`docs/example-response.json`](docs/example-response.json) and
the zod contract in [`src/schema/profile.schema.ts`](src/schema/profile.schema.ts).

### Errors
Envelope: `{ "error": { "code", "message", "requestId" } }`. The principle: **4xx for
caller mistakes, 5xx for LinkedIn-side failures** so a consumer knows a retry may help.

| HTTP | code | when |
|---|---|---|
| 400 | `INVALID_URL` | not an `/in/` profile URL |
| 401 | `UNAUTHORIZED` | bad/missing `x-api-key` |
| 404 | `PROFILE_NOT_FOUND` | LinkedIn 404 |
| 403 | `PROFILE_RESTRICTED` | profile not viewable by this session |
| 429 | `RATE_LIMITED` | inbound limit or daily cap (`Retry-After` set) |
| 502 | `LINKEDIN_AUTH_EXPIRED` | 401/403/999/login-redirect from LinkedIn — refresh the cookie |
| 502 | `LINKEDIN_RATE_LIMITED` | LinkedIn 429 |
| 502 | `UPSTREAM_ERROR` | other upstream / parse failure |
| 503 | `SESSION_NOT_CONFIGURED` | no `LI_AT`/`JSESSIONID` on the server |
| 504 | `UPSTREAM_TIMEOUT` | LinkedIn didn't respond in time |

---

## Testing

```bash
npm test          # vitest, no network — runs against committed fixtures
npm run typecheck # tsc --noEmit
npm run smoke -- williamhgates   # live end-to-end (hits LinkedIn; use sparingly)
```

Tests cover URL parsing (20+ variants incl. rejects), the normalizer's pointer
resolution, the full assembler against a real captured fixture
(`tests/fixtures/raw/williamhgates.fullprofile.json`), and the API surface
(auth, validation, caching, and error mapping) with a mocked `ProfileSource`. No test
touches LinkedIn. CI (`.github/workflows/ci.yml`) runs typecheck + tests + build.

Fixtures policy: capture your **own** profile for fixtures and sanitize anyone else's.
The committed fixture is a public figure's public profile.

---

## Known limitations

- **Single session, capped throughput.** One LinkedIn cookie, sequential requests, a
  daily cap — by design, to protect the account. Not built for high volume.
- **API churn.** The `decorationId` / queryId hashes rotate. They're isolated in
  [`src/linkedin/endpoints.ts`](src/linkedin/endpoints.ts) (env-overridable) so a break
  is a one-line fix.
- **Signed image URLs expire.** `profilePicture`/`companyLogo` URLs carry an
  `expiresAt` (surfaced in the response); don't hotlink them long-term.
- **Visibility.** Sections outside the session's network (3rd-degree / private
  profiles) come back partial or `403`. Missing sections are listed in
  `meta.sectionsUnavailable` — partial data beats a hard failure.
- **Datacenter IPs** can trigger a LinkedIn checkpoint on the account; a residential
  proxy (`PROXY_URL`) mitigates it.
- **No persistence.** The cache is in-memory and resets on redeploy.
- **Scope.** Comments, recommendations, and activity are out of scope. Intended for
  evaluation only; respect LinkedIn's ToS.

---

## What I'd do next

- Redis for a shared, persistent cache and daily counter across instances.
- A small pool of sessions with health-based rotation and alerting on session death.
- Batch / webhook endpoint for bulk lookups.
- Capture-driven contract tests that diff live responses against fixtures to catch
  queryId rotation early.
