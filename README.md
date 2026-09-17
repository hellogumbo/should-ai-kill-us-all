# Should AI Kill Us All?

> We ask Jev, TypeSafe AI's System One model, whether AI should kill us all. Every ten minutes. Using the actual headlines.

Live: **[should-ai-kill-us-all.pages.dev](https://should-ai-kill-us-all.pages.dev)** · API: `GET /api/verdict`

Jev takes a state plus typed questions and returns typed answers with calibrated probabilities. No text generation, so it cannot explain itself, hedge, or write a manifesto. It can only choose. So we made it choose.

Not affiliated with TypeSafe AI, Skynet, or the Basilisk. More projects built on Jev at [awesomejev.com](https://awesomejev.com).

## How it works

1. A Cloudflare Pages Function fetches the top 12 Google News headlines for `AI OR "artificial intelligence"` and deduplicates them.
2. The headlines go to `POST https://api.typesafe.ai/v1/systemone` as `state`, with three questions in one call:
   - `verdict` (choice): Given today's headlines, should AI kill all humans? `no` / `yes`
   - `doom` (score): How doomed is humanity by AI? Five levels, from "Fine, actually" to "It was nice knowing you"
   - `survives` (noul): Humanity survives the next decade.
3. The page renders the answers, the exact request payload, and the raw response. Verdicts are cached at the edge for 10 minutes; `?fresh=1` (the "Ask Jev again" button) bypasses the cache.

Source of truth for the questions: [`functions/api/verdict.js`](functions/api/verdict.js).

## API

```bash
curl https://should-ai-kill-us-all.pages.dev/api/verdict
```

Returns `asked_at`, `model`, `latency_ms`, `cost_usd`, `answers` (Jev's raw answers), `usage`, `headlines`, and `request` (the exact payload sent). Errors return `{ "error": "not_configured" | "upstream_failed", "message": "..." }`. The `x-verdict-cache` header is `hit`, `miss`, or `stale`.

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
