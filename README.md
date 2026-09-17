# Should AI Kill Us All?

> We ask Jev, TypeSafe AI's System One model, whether AI should kill us all. Every ten minutes. Using the actual headlines.

Live: **[should-ai-kill-us-all.pages.dev](https://should-ai-kill-us-all.pages.dev)** · API: `GET /api/verdict`

Jev takes a state plus typed questions and returns typed answers with calibrated probabilities. No text generation, so it cannot explain itself, hedge, or write a manifesto. It can only choose. So we made it choose.

Not affiliated with TypeSafe AI, Skynet, or the Basilisk. More projects built on Jev at [awesomejev.com](https://awesomejev.com).

## How it works

1. A Cloudflare Pages Function gathers twelve exhibits about humans from Google News "Florida man", r/nottheonion, UPI Odd News, and the Google News Politics and World feeds, plus the top ten AI headlines. Feeds are fetched in parallel and any one may fail. Exhibits are deduplicated and headlines about real tragedy are filtered out so the case stays absurd.
2. Both lists go to `POST https://api.typesafe.ai/v1/systemone` as `state: { humanity, ai }`, with three questions in one call:
   - `verdict` (choice): Given how humans are behaving today, should AI kill all humans? `no` / `yes`
   - `doom` (score): Based on today's AI headlines, how doomed is humanity by AI? Five levels, from "Fine, actually" to "It was nice knowing you"
   - `survives` (noul): Humanity survives the next decade.
3. The page renders the answers, the exhibits, the exact request payload, and the raw response. Verdicts are cached at the edge for 10 minutes; `?fresh=1` (the "Ask Jev again" button) bypasses the cache.

Source of truth for the questions: [`functions/api/verdict.js`](functions/api/verdict.js).

## API

```bash
curl https://should-ai-kill-us-all.pages.dev/api/verdict
```

Returns `asked_at`, `model`, `latency_ms`, `cost_usd`, `answers` (Jev's raw answers), `usage`, `exhibits`, `ai`, `sources` (per-feed status), and `request` (the exact payload sent). Errors return `{ "error": "not_configured" | "upstream_failed", "message": "..." }`; `not_configured` still includes the exhibits. The `x-verdict-cache` header is `hit`, `miss`, or `stale`.

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
