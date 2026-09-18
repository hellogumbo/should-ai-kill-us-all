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
  const cacheLabel = (status, askedAt) => {
    const age = Math.max(0, Math.round((Date.now() - Date.parse(askedAt)) / 1000));
    if (status === "throttled") return `the standing ruling from ${age} s ago, Jev takes a minute between rulings`;
    if (status === "hit" || status === "shared") return "the standing ruling, good for ten minutes";
    if (status === "stale") return "a stale copy, Jev was unreachable";
    return "a fresh decision";
  };
  const intent = (text) => `https://x.com/intent/post?text=${encodeURIComponent(text)}`;

  let ruling = null;

  const tweetText = (headline) => {
    if (!ruling) return `Should AI kill us all? We asked Jev. ${SITE}`;
    const p = ruling.pShould !== null ? pct(ruling.pShould) : p4(ruling.pYes);
    return [
      `Jev says AI should ${ruling.yes ? "" : "NOT "}kill us all (p = ${p})${headline ? `, ${ruling.yes ? "after" : "even after"} reading: “${clip(headline.title, 90)}”` : ""}.`,
      ruling.split ? "Its own oracle disagrees." : null,
      ruling.level ? `Doom level: ${ruling.level}.` : null,
      SITE,
    ].filter(Boolean).join(" ");
  };

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
    picker.load([
      ...data.exhibits.map((h, i) => ({ ...h, label: `Specimen ${String(i + 1).padStart(2, "0")} · ${h.category}` })),
      ...data.ai.map((h, i) => ({ ...h, label: `Omen ${String(i + 1).padStart(2, "0")} · AI` })),
    ]);
  };

  const renderLedger = (history) => {
    const rows = history.slice(0, 60);
    const yesCount = history.filter((h) => h.choice === "yes").length;
    const oldest = history[history.length - 1];
    $("ledger-lede").textContent = history.length
      ? `${history.length} ruling${history.length === 1 ? "" : "s"} since ${utc(oldest.asked_at)}. ${yesCount === 0 ? "None of them yes." : `${yesCount} of them yes.`}${history.length > rows.length ? ` Showing the latest ${rows.length}.` : ""}`
      : "The ledger opens with the first ruling.";
    $("ledger-rows").innerHTML = rows
      .map((h) => `<tr class="${h.choice === "yes" ? "is-yes" : ""}"><td>${utc(h.asked_at)}</td><td class="ruling">${h.choice === "yes" ? "Yes" : "No"}</td><td>${h.p_should === null ? "—" : pct(h.p_should)}</td><td>${h.doom === null ? "—" : `${h.doom.toFixed(2)} · ${esc(h.doom_level || "")}`}</td><td>${h.survives === null ? "—" : pct(h.survives)}</td><td class="exhibit">${h.exhibit ? `<a href="${esc(h.exhibit.url)}" target="_blank" rel="noopener">${esc(h.exhibit.title)}</a>` : "—"}</td></tr>`)
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
      `Asked ${utc(data.asked_at)}, answered in ${data.latency_ms} ms, ${cacheLabel(cacheStatus, data.asked_at)}.`,
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

    ruling = { yes, pYes, pShould, split, level: idx >= 0 ? levels[idx] : null };
    renderNews(data);
    renderLedger(data.history || []);
    $("request-json").textContent = JSON.stringify(request, null, 2);
    $("usage").textContent = data.usage ? `${data.usage.input_tokens} tokens in, ${data.usage.output_tokens} out` : "raw answers";
    $("response-json").textContent = JSON.stringify({ model: data.model, answers }, null, 2);
    share.href = intent(tweetText(data.exhibits[0]));
    askAgain.disabled = false;
  };

  const picker = (() => {
    const modal = $("share-modal");
    const card = $("card");
    const stage = $("stage");
    const counter = $("counter");
    const preview = $("tweet-preview");
    const post = $("post-x");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let items = [];
    let index = 0;
    let busy = false;
    let drag = null;

    const paint = () => {
      const h = items[index];
      card.innerHTML = `<span class="spec-label">${esc(h.label)}</span><p class="card-title">${esc(h.title)}</p><span class="src">${esc(h.source || "")}</span>`;
      counter.textContent = `${index + 1} / ${items.length}`;
      preview.textContent = tweetText(h);
      post.href = intent(tweetText(h));
    };

    const finish = (dir) => {
      index = (index + dir + items.length) % items.length;
      card.style.transform = "";
      paint();
      card.className = `card ${dir > 0 ? "in-right" : "in-left"}`;
      card.addEventListener("animationend", () => { card.className = "card"; busy = false; }, { once: true });
    };

    const go = (dir) => {
      if (busy || items.length < 2) return;
      busy = true;
      if (reduced.matches) { finish(dir); card.className = "card"; busy = false; return; }
      card.className = `card ${dir > 0 ? "out-left" : "out-right"}`;
      card.addEventListener("animationend", () => finish(dir), { once: true });
    };

    const open = () => {
      if (!items.length) return false;
      modal.hidden = false;
      document.body.classList.add("has-modal");
      paint();
      card.className = "card";
      requestAnimationFrame(() => modal.classList.add("is-open"));
      $("arrow-next").focus();
      return true;
    };
    const close = () => {
      modal.classList.remove("is-open");
      document.body.classList.remove("has-modal");
      setTimeout(() => { modal.hidden = true; }, 220);
      share.focus();
    };

    $("arrow-prev").addEventListener("click", () => go(-1));
    $("arrow-next").addEventListener("click", () => go(1));
    modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", close));
    document.addEventListener("keydown", (e) => {
      if (modal.hidden) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "Escape") close();
    });

    stage.addEventListener("pointerdown", (e) => {
      if (busy || e.button !== 0) return;
      drag = { x: e.clientX, dx: 0, id: e.pointerId };
      stage.setPointerCapture(e.pointerId);
      card.classList.add("is-dragging");
    });
    stage.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x;
      card.style.transform = `translateX(${drag.dx}px) rotate(${drag.dx / 40}deg)`;
    });
    const release = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = drag.dx;
      drag = null;
      card.classList.remove("is-dragging");
      if (Math.abs(dx) > 70) go(dx < 0 ? 1 : -1);
      else card.style.transform = "";
    };
    stage.addEventListener("pointerup", release);
    stage.addEventListener("pointercancel", release);

    return {
      load(list) { items = list; index = 0; if (!modal.hidden) paint(); },
      open,
    };
  })();

  share.addEventListener("click", (e) => {
    if (picker.open()) e.preventDefault();
  });

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
