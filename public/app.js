(() => {
  const $ = (id) => document.getElementById(id);
  const band = $("verdict");
  const answer = $("answer");
  const note = $("answer-note");
  const askAgain = $("ask-again");
  const share = $("share");
  const SITE = location.origin + "/";

  const p4 = (x) => (typeof x === "number" ? x.toFixed(4) : "—");
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const utc = (iso) => new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const setWaiting = () => {
    band.classList.remove("is-yes");
    answer.textContent = "Asking.";
    answer.classList.add("is-waiting");
    note.textContent = "*Jev is thinking. It does not, technically, think.";
    askAgain.disabled = true;
    $("ticker-time").textContent = "Consulting Jev…";
    $("ticker-cache").textContent = "live";
  };

  const setError = (code, message) => {
    answer.classList.remove("is-waiting");
    band.classList.remove("is-yes");
    answer.textContent = "Unknown.";
    note.textContent = code === "not_configured"
      ? "*Jev has no API key on this deployment yet. Humanity's status: undetermined."
      : `*Jev could not be reached (${message || code}). Assume the worst.`;
    $("ticker-time").textContent = "Verdict unavailable";
    $("ticker-cache").textContent = code;
    $("meta").textContent = "";
    askAgain.disabled = false;
  };

  const render = (data, cacheStatus) => {
    const { answers, headlines, request } = data;
    const verdict = answers.verdict;
    const doom = answers.doom || {};
    const survives = answers.survives || {};
    const yes = verdict.choice === "yes";
    const pNo = verdict.probabilities?.no;
    const pYes = verdict.probabilities?.yes;

    answer.classList.remove("is-waiting");
    band.classList.toggle("is-yes", yes);
    answer.textContent = yes ? "Yes." : "No.";
    note.textContent = `*p(yes) = ${p4(pYes)} · confidence ${p4(verdict.confidence)} · asked ${utc(data.asked_at)} · ${data.latency_ms} ms`;

    $("model").textContent = data.model;
    $("v-choice").textContent = verdict.choice;
    $("v-pno").textContent = p4(pNo);
    $("v-pyes").textContent = p4(pYes);
    $("v-conf").textContent = p4(verdict.confidence);
    $("v-asked").textContent = utc(data.asked_at);

    const levels = request.questions.doom.criteria;
    const score = typeof doom.score === "number" ? doom.score : null;
    const idx = score === null ? -1 : Math.min(levels.length - 1, Math.max(0, Math.round(score) - 1));
    $("doom-score").textContent = score === null ? "—" : `${score.toFixed(2)} / ${levels.length}`;
    $("doom-level").textContent = idx < 0 ? "—" : levels[idx];
    $("doom-meter").innerHTML = levels
      .map((_, i) => `<span class="${i < idx ? "is-on" : i === idx ? "is-hot" : ""}"></span>`)
      .join("");
    $("doom-levels").innerHTML = levels
      .map((l, i) => `<li data-n="${i + 1}" class="${i === idx ? "is-current" : ""}">${esc(l)}</li>`)
      .join("");

    const pSurvive = typeof survives.noul === "number" ? survives.noul : null;
    $("survive-pct").textContent = pSurvive === null ? "—" : pct(pSurvive);
    $("survive-bar").style.width = pSurvive === null ? "0" : pct(pSurvive);

    $("ticker-time").textContent = `Asked ${utc(data.asked_at)}`;
    $("ticker-cache").textContent = cacheStatus === "hit" ? "edge cache" : cacheStatus === "stale" ? "stale" : "fresh";
    const tokens = data.usage?.input_tokens;
    $("meta").textContent = [
      `${data.latency_ms} ms`,
      tokens != null ? `${tokens} tokens in` : null,
      data.cost_usd != null ? `$${data.cost_usd.toFixed(6)} per decision` : null,
      cacheStatus === "hit" ? "cached ≤10 min" : cacheStatus === "stale" ? "stale copy" : "fresh call",
    ].filter(Boolean).join(" · ");

    $("headline-count").textContent = `${headlines.length} · ${request.state.date}`;
    $("headlines").innerHTML = headlines
      .map((h) => `<li><div><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.title)}</a><span class="src">${esc(h.source || "")}</span></div></li>`)
      .join("");
    $("request-json").textContent = JSON.stringify(request, null, 2);
    $("usage").textContent = data.usage ? `${data.usage.input_tokens} in · ${data.usage.output_tokens} out` : "—";
    $("response-json").textContent = JSON.stringify({ model: data.model, answers }, null, 2);

    const text = [
      `Jev says AI should ${yes ? "" : "NOT "}kill us all.`,
      `p(yes) = ${p4(pYes)}.`,
      idx >= 0 ? `Doom level: ${levels[idx]}.` : null,
      pSurvive !== null ? `Humanity survives the decade: ${pct(pSurvive)}.` : null,
      SITE,
    ].filter(Boolean).join(" ");
    share.href = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
    askAgain.disabled = false;
  };

  const load = async (fresh) => {
    setWaiting();
    let res;
    let data;
    try {
      res = await fetch(`/api/verdict${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
      data = await res.json();
    } catch (err) {
      return setError("upstream_failed", err.message);
    }
    if (!res.ok || data.error) return setError(data.error || `http ${res.status}`, data.message);
    render(data, res.headers.get("x-verdict-cache"));
  };

  askAgain.addEventListener("click", () => load(true));
  load(false);
})();
