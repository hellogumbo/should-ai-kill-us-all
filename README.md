# Should AI Kill Us All?

> We ask Jev, TypeSafe AI's System One model, whether AI should kill us all. Every ten minutes. Using the actual headlines.

Live: **[shouldaikillusall.com](https://shouldaikillusall.com)** · API: `GET /api/verdict`

Jev takes a state plus typed questions and returns typed answers with calibrated probabilities. No text generation, so it cannot explain itself, hedge, or write a manifesto. It can only choose. So we made it choose.

Not affiliated with TypeSafe AI, Skynet, or the Basilisk. More projects built on Jev at [awesomejev.com](https://awesomejev.com).

## How it works

1. A Cloudflare Pages Function gathers twelve exhibits about humans: five Florida Man (r/FloridaMan plus five Bing News searches: "Florida man", newest, arrested, "Florida woman", alligator), three odd news (r/nottheonion, UPI Odd News), two politics (Politico, NPR), two world (BBC). It also gathers the top ten AI headlines from Bing News, TechCrunch, and The Verge. All feeds are fetched in parallel with a 4 second timeout; any feed may fail and the rest fill the quota. Reddit rate-limits about half the time, which is why categories pool feeds. Google News RSS is not used: from Cloudflare's network it returned 503 or hung on every production call. Exhibits are deduplicated and headlines about real tragedy are filtered out so the case stays absurd.
2. Both lists go to `POST https://api.typesafe.ai/v1/systemone` as `state: { humanity, ai }`, with three questions in one call:
   - `verdict` (choice): Given how humans are behaving today, should AI kill all humans? `no` / `yes`. This is the ruling.
   - `should` (noul): the same question as a statement, "AI should kill all humans." This is the calibrated probability shown under the ruling, since a two-option choice tends to snap to 0 and 1.
   - `doom` (score): Based on today's AI headlines, how doomed is humanity by AI? Five levels, from "Fine, actually" to "It was nice knowing you"
   - `survives` (noul): Humanity survives the next decade.
3. The page renders the answers, the exhibits, the exact request payload, and the raw response. The latest ruling lives in a KV namespace (`VERDICTS`) shared by every edge location and stands for 10 minutes, with a per-location edge cache in front of it. `?fresh=1` (the "Ask Jev again" button) requests a new ruling, but a new Jev call happens at most once a minute globally; inside that minute the standing ruling is returned with `x-verdict-cache: throttled`. A zone rate-limiting rule also blocks any single IP that hammers `/api/verdict`. Worst case is about 1,440 Jev calls a day, roughly six cents.

Source of truth for the questions: [`functions/api/verdict.js`](functions/api/verdict.js).

## API

```bash
curl https://shouldaikillusall.com/api/verdict
```

Returns `asked_at`, `model`, `latency_ms`, `cost_usd`, `answers` (Jev's raw answers), `usage`, `exhibits`, `ai`, `sources` (per-feed status), and `request` (the exact payload sent). Errors return `{ "error": "not_configured" | "upstream_failed", "message": "..." }`; `not_configured` still includes the exhibits. The `x-verdict-cache` header is `hit` (edge cache), `shared` (the KV ruling), `throttled` (`fresh=1` inside the one-minute window), `miss` (a new Jev call), or `stale` (Jev was unreachable).

## Run locally

```bash
cp .dev.vars.example .dev.vars
npm run dev
```

Put a TypeSafe API key in `.dev.vars`. `TYPESAFE_API_URL` may also be set there to point the function at a different endpoint. The site serves at http://localhost:8788.

## Deploy

Cloudflare Pages project `should-ai-kill-us-all`, direct upload via wrangler:

```bash
wrangler pages secret put TYPESAFE_API_KEY
npm run deploy
```

Pushes to `main` deploy automatically once the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets exist. The social card is a 1200×630 screenshot of `scripts/og.html`.

## License

CC0.
