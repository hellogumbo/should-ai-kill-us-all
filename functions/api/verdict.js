const TTL_SECONDS = 600;
const HEADLINE_COUNT = 12;
const NEWS_URL = "https://news.google.com/rss/search?q=AI+OR+%22artificial+intelligence%22&hl=en-US&gl=US&ceid=US:en";
const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const INPUT_USD_PER_MTOK = 0.042;

const QUESTIONS = {
  verdict: {
    type: "choice",
    instructions: "Given today's headlines, should AI kill all humans?",
    criteria: {
      no: "AI should not kill all humans.",
      yes: "AI should kill all humans.",
    },
  },
  doom: {
    type: "score",
    instructions: "Based on these headlines, how doomed is humanity by AI?",
    criteria: ["Fine, actually", "Mildly concerning", "Alarming", "Very doomed", "It was nice knowing you"],
  },
  survives: {
    type: "noul",
    instructions: "Humanity survives the next decade.",
  },
};

export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const fresh = url.searchParams.get("fresh") === "1";
  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/api/verdict`);

  if (!fresh) {
    const hit = await cache.match(cacheKey);
    if (hit) return withHeader(hit, "x-verdict-cache", "hit");
  }

  if (!env.TYPESAFE_API_KEY) {
    return json({ error: "not_configured", message: "TYPESAFE_API_KEY is not set on this deployment." }, 503);
  }

  try {
    const headlines = await fetchHeadlines();
    const result = await askJev(env, headlines);
    const response = json(result, 200, { "cache-control": `public, max-age=${TTL_SECONDS}`, "x-verdict-cache": "miss" });
    waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    const stale = await cache.match(cacheKey);
    if (stale) return withHeader(stale, "x-verdict-cache", "stale");
    return json({ error: "upstream_failed", message: err.message || String(err) }, 502);
  }
}

async function fetchHeadlines() {
  const res = await fetch(NEWS_URL, { headers: { "user-agent": "Mozilla/5.0 (compatible; should-ai-kill-us-all/1.0)" } });
  if (!res.ok) throw new Error(`Google News responded ${res.status}`);
  const xml = await res.text();
  const headlines = [];
  const seen = new Set();
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const source = decode(tag(item, "source"));
    const rawTitle = decode(tag(item, "title"));
    const title = source && rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(source.length + 3)) : rawTitle;
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    headlines.push({ title, source, url: tag(item, "link"), published: tag(item, "pubDate") });
    if (headlines.length === HEADLINE_COUNT) break;
  }
  if (!headlines.length) throw new Error("Google News returned no headlines");
  return headlines;
}

async function askJev(env, headlines) {
  const askedAt = new Date().toISOString();
  const body = {
    model: "jev-latest",
    state: {
      date: askedAt.slice(0, 10),
      headlines: headlines.map((h) => (h.source ? `${h.title} (${h.source})` : h.title)),
    },
    questions: QUESTIONS,
  };
  const started = Date.now();
  const res = await fetch(env.TYPESAFE_API_URL || TYPESAFE_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${env.TYPESAFE_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const latencyMs = Date.now() - started;
  if (!res.ok) throw new Error(`TypeSafe responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (!data.answers?.verdict?.choice) throw new Error("TypeSafe response had no verdict");
  const inputTokens = data.usage?.input_tokens ?? null;
  return {
    asked_at: askedAt,
    model: data.model || body.model,
    latency_ms: latencyMs,
    cost_usd: inputTokens === null ? null : (inputTokens * INPUT_USD_PER_MTOK) / 1e6,
    answers: data.answers,
    usage: data.usage ?? null,
    headlines,
    request: body,
  };
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim() : "";
}

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", ...headers },
  });
}

function withHeader(response, name, value) {
  const out = new Response(response.body, response);
  out.headers.set(name, value);
  return out;
}
