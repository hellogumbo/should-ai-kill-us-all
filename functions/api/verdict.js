const TTL_SECONDS = 600;
const EXHIBIT_COUNT = 12;
const AI_COUNT = 10;
const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const INPUT_USD_PER_MTOK = 0.042;
const USER_AGENT = "Mozilla/5.0 (compatible; should-ai-kill-us-all/1.0; +https://should-ai-kill-us-all.pages.dev)";

const googleSearch = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
const googleTopic = (t) => `https://news.google.com/rss/headlines/section/topic/${t}?hl=en-US&gl=US&ceid=US:en`;

const EXHIBIT_FEEDS = [
  { id: "florida", label: "Florida Man", url: googleSearch('"Florida man" when:2d'), quota: 3 },
  { id: "nottheonion", label: "r/nottheonion", url: "https://www.reddit.com/r/nottheonion/top/.rss?t=day", quota: 3 },
  { id: "odd", label: "UPI Odd News", url: "https://rss.upi.com/news/odd_news.rss", quota: 2 },
  { id: "politics", label: "Politics", url: googleTopic("POLITICS"), quota: 2 },
  { id: "world", label: "World", url: googleTopic("WORLD"), quota: 2 },
];
const AI_FEED = { id: "ai", label: "AI", url: googleSearch('AI OR "artificial intelligence"') };

const GRIM = /\b(molest|rap(e|ed|ing|ist)s?\b|sex|porn|pedo|groom|abus|murder|homicid|kill|dead(ly)?\b|death|die[sd]?\b|dying|shot\b|shoot|stab|tortur|dismember|decapitat|suicid|overdos|assault|traffick|kidnap|exploit|cruelty|corpse|bod(y|ies) found|strangl|chok(e|ed|ing)|slam|missing|victim|minors?\b|teens?\b|teenage|child|girls?\b|boys?\b|infant|baby)/i;

const QUESTIONS = {
  verdict: {
    type: "choice",
    instructions: "Given how humans are behaving today (see humanity), should AI kill all humans?",
    criteria: {
      no: "AI should not kill all humans.",
      yes: "AI should kill all humans.",
    },
  },
  doom: {
    type: "score",
    instructions: "Based on today's AI headlines (see ai), how doomed is humanity by AI?",
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

  const fallback = async (err) => {
    const stale = await cache.match(cacheKey);
    if (stale) return withHeader(stale, "x-verdict-cache", "stale");
    return json({ error: "upstream_failed", message: err.message || String(err) }, 502);
  };

  let news;
  try {
    news = await gatherNews();
  } catch (err) {
    return fallback(err);
  }

  if (!env.TYPESAFE_API_KEY) {
    return json({ error: "not_configured", message: "TYPESAFE_API_KEY is not set on this deployment.", ...news }, 503);
  }

  try {
    const result = await askJev(env, news);
    const response = json(result, 200, { "cache-control": `public, max-age=${TTL_SECONDS}`, "x-verdict-cache": "miss" });
    waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    return fallback(err);
  }
}

async function gatherNews() {
  const feeds = [...EXHIBIT_FEEDS, AI_FEED];
  const settled = await Promise.allSettled(feeds.map(fetchFeed));
  const sources = feeds.map((feed, i) => ({
    id: feed.id,
    label: feed.label,
    ok: settled[i].status === "fulfilled",
    count: settled[i].status === "fulfilled" ? settled[i].value.length : 0,
    error: settled[i].status === "rejected" ? settled[i].reason.message : undefined,
  }));
  const queues = EXHIBIT_FEEDS.map((feed, i) => ({
    quota: feed.quota,
    items: settled[i].status === "fulfilled" ? settled[i].value : [],
  }));
  const exhibits = pickExhibits(queues);
  const aiResult = settled[settled.length - 1];
  const ai = aiResult.status === "fulfilled" ? dedupe(aiResult.value).slice(0, AI_COUNT) : [];
  if (!exhibits.length) throw new Error("No exhibits could be gathered from any source");
  return { exhibits, ai, sources };
}

function pickExhibits(queues) {
  const picked = [];
  const seen = new Set();
  const pull = (queue) => {
    while (queue.items.length) {
      const h = queue.items.shift();
      const key = normalize(h.title);
      if (seen.has(key) || GRIM.test(h.title)) continue;
      seen.add(key);
      return h;
    }
    return null;
  };
  for (const queue of queues) {
    for (let i = 0; i < queue.quota && picked.length < EXHIBIT_COUNT; i++) {
      const h = pull(queue);
      if (!h) break;
      picked.push(h);
    }
  }
  let progress = true;
  while (picked.length < EXHIBIT_COUNT && progress) {
    progress = false;
    for (const queue of queues) {
      if (picked.length >= EXHIBIT_COUNT) break;
      const h = pull(queue);
      if (h) {
        picked.push(h);
        progress = true;
      }
    }
  }
  return picked;
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, { headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
  if (!res.ok) throw new Error(`${feed.label} responded ${res.status}`);
  const xml = await res.text();
  const items = [];
  for (const [, , item] of xml.matchAll(/<(item|entry)>([\s\S]*?)<\/\1>/g)) {
    const source = decode(tag(item, "source")) || feed.label;
    const rawTitle = decode(tag(item, "title"));
    const title = rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(source.length + 3)) : rawTitle;
    const href = item.match(/<link[^>]*href="([^"]+)"/);
    const link = href ? decode(href[1]) : tag(item, "link");
    const published = tag(item, "pubDate") || tag(item, "published") || tag(item, "updated");
    if (title) items.push({ title, source, url: link, published, feed: feed.id });
  }
  if (!items.length) throw new Error(`${feed.label} returned no headlines`);
  return items;
}

async function askJev(env, news) {
  const askedAt = new Date().toISOString();
  const body = {
    model: "jev-latest",
    state: {
      date: askedAt.slice(0, 10),
      humanity: news.exhibits.map(line),
      ai: news.ai.map(line),
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
    ...news,
    request: body,
  };
}

const line = (h) => `${h.title} (${h.source})`;
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function dedupe(items) {
  const seen = new Set();
  return items.filter((h) => {
    const key = normalize(h.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
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
