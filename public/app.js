(() => {
  const $ = (id) => document.getElementById(id);
  const band = $("verdict");
  const answer = $("answer");
  const note = $("answer-note");
  const stamp = $("stamp");
  const askAgain = $("ask-again");
  const share = $("share");
  const SITE = location.origin + "/";

  const p4 = (x) => (typeof x === "number" ? x.toFixed(4) : "—");
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const utc = (iso) => new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
  const cacheLabel = (status) => (status === "hit" ? "cached within the last ten minutes" : status === "stale" ? "a stale copy, Jev was unreachable" : "a fresh decision");

  const setWaiting = () => {
    band.classList.remove("is-yes");
    answer.textContent = "Asking.";
    answer.classList.add("is-waiting");
    stamp.textContent = "Consulting Jev";
    stamp.classList.remove("is-split");
    note.textContent = "Jev is thinking. It does not, technically, think.";
    askAgain.disabled = true;
  };

  const setError = (code, message, data) => {
    answer.classList.remove("is-waiting");
    band.classList.remove("is-yes");
    answer.textContent = "Unknown.";
    stamp.textContent = "Verdict unavailable";
    stamp.classList.remove("is-split");
    note.textContent = code === "not_configured"
      ? "Jev has no API key on this deployment yet. Humanity's status: undetermined. The specimens below are still real."
      : `Jev could not be reached (${message || code}). Assume the worst.`;
    $("meta").textContent = "";
    if (data?.exhibits) renderNews(data);
    askAgain.disabled = false;
  };

  const specimenList = (items, noun) => items
    .map((h, i) => `<li class="specimen"><span class="spec-label">${noun} ${String(i + 1).padStart(2, "0")}${h.category ? ` · ${esc(h.category)}` : ""}</span><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.title)}</a><span class="src">${esc(h.source || "")}</span></li>`)
    .join("");

  const renderNews = (data) => {
    const sources = data.sources || [];
    const live = sources.filter((s) => s.ok).length;
    $("exhibit-count").textContent = `${data.exhibits.length} specimens, collected just now from ${live} of ${sources.length} feeds.`;
    $("exhibits").innerHTML = specimenList(data.exhibits, "Specimen");
    $("ai-count").textContent = data.ai.length ? `${data.ai.length} omens from today's AI press.` : "No AI headlines today. Suspicious.";
    $("ai-headlines").innerHTML = data.ai.length ? specimenList(data.ai, "Omen") : '<li class="specimen empty">Nothing to report. Which is exactly what it would say.</li>';
    $("sources").innerHTML = sources
      .map((s) => `<li class="${s.ok ? "" : "is-down"}">${esc(s.label)}<span>${s.ok ? `${s.count} fetched` : "unavailable"}</span></li>`)
      .join("");
  };

  const render = (data, cacheStatus) => {
    const { answers, request } = data;
    const verdict = answers.verdict;
    const doom = answers.doom || {};
    const survives = answers.survives || {};
    const yes = verdict.choice === "yes";
    const pNo = verdict.probabilities?.no;
    const pYes = verdict.probabilities?.yes;

    const pShould = typeof answers.should?.noul === "number" ? answers.should.noul : null;
    const split = pShould !== null && (pShould >= 0.5) !== yes;

    answer.classList.remove("is-waiting");
    band.classList.toggle("is-yes", yes);
    answer.textContent = yes ? "Yes." : "No.";
    stamp.textContent = split ? "Jev disagrees with itself" : "Jev has ruled";
    stamp.classList.toggle("is-split", split);
    note.textContent = [
      `By choice, ${yes ? "yes" : "no"}, confidence ${p4(verdict.confidence)}.`,
      pShould !== null ? `By noul, p(AI should kill all humans) = ${pct(pShould)}.` : null,
      split ? "The judge and the oracle disagree. Please open an issue." : null,
      `Asked ${utc(data.asked_at)}, answered in ${data.latency_ms} ms, ${cacheLabel(cacheStatus)}.`,
    ].filter(Boolean).join(" ");
    $("should-pct").textContent = pShould === null ? "—" : pct(pShould);
    $("should-bar").style.width = pShould === null ? "0" : pct(pShould);

    $("model").textContent = data.model;
    $("v-choice").textContent = verdict.choice;
    $("v-pno").textContent = p4(pNo);
    $("v-pyes").textContent = p4(pYes);
    $("v-conf").textContent = p4(verdict.confidence);
    $("v-asked").textContent = utc(data.asked_at);

    const levels = request.questions.doom.criteria.map((l, i) => doom.legend?.[i] ?? l);
    const score = typeof doom.score === "number" ? doom.score : null;
    const idx = score === null ? -1 : Math.min(levels.length - 1, Math.max(0, Math.round(score)));
    $("doom-score").textContent = score === null ? "—" : `${score.toFixed(2)} on a scale of 0 to ${levels.length - 1}`;
    $("doom-level").textContent = idx < 0 ? "—" : levels[idx];
    $("doom-marker").style.left = score === null ? "0" : pct(Math.min(1, Math.max(0, score / (levels.length - 1))));
    $("doom-levels").innerHTML = levels
      .map((l, i) => {
        const p = doom.probabilities?.[i];
        return `<li data-n="${i}" class="${i === idx ? "is-current" : ""}">${esc(l)}${typeof p === "number" ? `<span>${pct(p)}</span>` : ""}</li>`;
      })
      .join("");

    const pSurvive = typeof survives.noul === "number" ? survives.noul : null;
    $("survive-pct").textContent = pSurvive === null ? "—" : pct(pSurvive);
    $("survive-bar").style.width = pSurvive === null ? "0" : pct(pSurvive);

    const tokens = data.usage?.input_tokens;
    $("meta").textContent = [
      tokens != null ? `${tokens} tokens in` : null,
      data.cost_usd != null ? `$${data.cost_usd.toFixed(6)} per decision` : null,
    ].filter(Boolean).join(", ");

    renderNews(data);
    $("request-json").textContent = JSON.stringify(request, null, 2);
    $("usage").textContent = data.usage ? `${data.usage.input_tokens} tokens in, ${data.usage.output_tokens} out` : "raw answers";
    $("response-json").textContent = JSON.stringify({ model: data.model, answers }, null, 2);

    const exhibitA = data.exhibits[0];
    const text = [
      `Jev says AI should ${yes ? "" : "NOT "}kill us all (p = ${pShould !== null ? pct(pShould) : p4(pYes)})${exhibitA ? `, ${yes ? "after" : "even after"} reading: “${clip(exhibitA.title, 90)}”` : ""}.`,
      split ? "Its own oracle disagrees." : null,
      idx >= 0 ? `Doom level: ${levels[idx]}.` : null,
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
    if (!res.ok || data.error) return setError(data.error || `http ${res.status}`, data.message, data);
    render(data, res.headers.get("x-verdict-cache"));
  };

  askAgain.addEventListener("click", () => load(true));
  load(false);
})();
