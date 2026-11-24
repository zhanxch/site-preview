(() => {
  const runs = window.RSI_RUNS;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(location.search);

  const ROLES = [
    ["orchestration", "Orchestration", '<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>'],
    ["context", "Context", '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'],
    ["execution", "Execution", '<path d="M5 21h8M9 21v-4l-3-5 5-6 5 3M16 9l3-2M16 9l2 4"/><circle cx="11" cy="6" r="1.5"/>'],
    ["evaluation", "Evaluation", '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'],
    ["learning", "Learning", '<path d="m3 18 6-6 4 4 8-9M15 7h6v6"/>'],
  ];
  const CAMS = ["Left wrist camera", "Head camera", "Right wrist camera"];

  let run, cursor = 0, playing = false, timer = null, autoplayed = false;
  const nodes = new Map();

  /* ---------- sidebar ---------- */
  function renderRuns() {
    const q = $("run-search").value.trim().toLowerCase();
    const list = runs.filter((r) => !q || (r.title + r.method + r.task).toLowerCase().includes(q));
    $("run-count").textContent = runs.length;
    $("runs").innerHTML = list.map((r) => `
      <button class="run-item" data-run="${r.id}" aria-current="${r === run}">
        <strong>${esc(r.title)}</strong>
        <small>${esc(r.started)} · seed 0 · ${esc(r.method)}</small>
        <span class="tag ${r.outcome.tone}">${r.status} · ${r.outcome.tone === "ok" ? "success" : "failed"}</span>
      </button>`).join("") || '<p class="muted" style="padding:6px">No matching experiments.</p>';
  }
  $("runs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-run]");
    if (b) selectRun(runs.find((r) => r.id === b.dataset.run));
  });
  $("run-search").addEventListener("input", renderRuns);

  /* ---------- run selection ---------- */
  function selectRun(next) {
    stop();
    run = next;
    cursor = 0;
    renderRuns();
    $("run-benchmark").textContent = run.benchmark;
    $("run-title").textContent = run.title;
    $("method-badge").textContent = run.method;
    $("run-identifier").textContent = run.identifier;
    $("run-task").textContent = run.task;
    $("seek").max = run.events.length - 1;
    $("media-note").textContent = run.videoNote;
    $("media-video").src = run.video;

    const roleNames = [...new Set(run.events.filter((e) => e.agentRole).map((e) => e.agentRole))];
    $("role-filter").innerHTML = '<option value="">All roles</option>' + roleNames.map((r) => `<option>${esc(r)}</option>`).join("");

    for (const f of run.frames) for (const src of f.files) { const i = new Image(); i.src = src; }

    buildLogs();
    buildRoles();
    update(true);
  }

  /* ---------- logs ---------- */
  function callCard(e) {
    const isPolicy = e.lane === "policy";
    const tokens = e.tokens ? ` · in ${e.tokens.input.toLocaleString()} · out ${e.tokens.output}` : "";
    return `
      <button class="call" data-event="${e.index}" hidden>
        <div class="call-top"><span class="call-time">${e.time}</span><span class="call-title">${esc(e.title)}</span><span class="call-status">Returned</span></div>
        <div class="call-row"><span>${isPolicy ? "Policy input" : "Model input"}</span><span>${esc(e.input.summary)}</span></div>
        <div class="call-row"><span>${isPolicy ? "Policy output" : "Model output"}</span><span>${esc(e.output.summary)}</span></div>
        <div class="call-meta"><span class="chip role-chip">${esc(e.agentRole)}</span><span>${esc(e.model)}${e.effort ? " · " + e.effort : ""}${tokens}</span>${e.reported ? '<span class="chip rep">reported</span>' : ""}<span class="call-dur">${e.duration < 1 ? Math.round(e.duration * 1000) + " ms" : e.duration.toFixed(1) + " s"}</span></div>
      </button>`;
  }

  function buildLogs() {
    nodes.clear();
    for (const lane of ["llm", "policy"]) {
      const list = $(`${lane}-list`);
      const events = run.events.filter((e) => e.lane === lane);
      if (lane === "policy" && run.policy.state === "disabled") {
        list.innerHTML = `<div class="empty"><div><strong>Policy not configured</strong>${esc(run.policy.note)}</div></div>`;
        continue;
      }
      list.innerHTML = events.map(callCard).join("") + '<div class="empty waiting"><div>Waiting for the first call in this replay…</div></div>';
    }
    document.querySelectorAll(".call").forEach((el) => nodes.set(+el.dataset.event, [el]));
  }

  /* ---------- functional roles ---------- */
  function buildRoles() {
    $("roles").innerHTML = ROLES.map(([key, label, icon]) => {
      const cfg = run.roles[key];
      const disabled = cfg.state === "disabled";
      const items = run.events.filter((e) => e.role === key).map((e) => `
        <button class="role-call" data-event="${e.index}" hidden><b>${esc(e.title)}</b><span>${esc(e.output.summary)}</span></button>`).join("");
      return `
        <section class="role ${disabled ? "disabled" : ""}" data-role="${key}">
          <div class="role-head"><svg viewBox="0 0 24 24">${icon}</svg><h3>${label}</h3><span class="role-state">${disabled ? "Not configured" : "Configured"}</span></div>
          <p class="role-note">${esc(cfg.note)}</p>
          <div class="role-list">${disabled ? '<p class="role-empty">No records for this module.</p>' : items + '<p class="role-empty waiting">Awaiting activity…</p>'}</div>
        </section>`;
    }).join("");
    document.querySelectorAll(".role-call").forEach((el) => {
      const k = +el.dataset.event;
      nodes.set(k, [...(nodes.get(k) || []), el]);
    });
  }

  /* ---------- filtering ---------- */
  function matches(e) {
    const q = $("event-search").value.trim().toLowerCase();
    const role = $("role-filter").value;
    if (role && e.agentRole !== role) return false;
    if (!q) return true;
    return [e.title, e.input.summary, e.output.summary, e.model, e.agentRole].join(" ").toLowerCase().includes(q);
  }
  $("event-search").addEventListener("input", () => update());
  $("role-filter").addEventListener("change", () => update());

  /* ---------- update for cursor ---------- */
  function frameFor(step) {
    let f = run.frames[0];
    for (const fr of run.frames) if (fr.step <= step) f = fr;
    return f;
  }

  let lastFrame = null, lastCursor = -1;
  function update(force) {
    const ev = run.events[cursor];
    const done = cursor === run.events.length - 1;
    const verdictReached = run.events.slice(0, cursor + 1).some((e) => e.op === "result");

    $("seek").value = cursor;
    $("position").textContent = `${cursor + 1} / ${run.events.length}`;
    $("total").textContent = cursor + 1;
    $("last-event").textContent = ev.time;
    $("execution").textContent = done ? run.status : "Replaying";
    $("verdict").textContent = verdictReached ? run.outcome.label : "Not evaluated";
    $("verdict").className = verdictReached ? run.outcome.tone : "";
    $("sync").textContent = `Step ${ev.step} of ${run.maxStep} · ${ev.title}`;

    const frame = frameFor(ev.step);
    $("scene-step").textContent = `Step ${frame.step}`;
    if (force || frame !== lastFrame) {
      $("scene-images").innerHTML = frame.files.map((src, i) => `
        <figure class="cam" data-src="${src}" data-label="${CAMS[i]} · step ${frame.step}"><img src="${src}" alt="${CAMS[i]} at step ${frame.step}" width="400" height="300"><figcaption><span>${CAMS[i]}</span><span>step ${frame.step}</span></figcaption></figure>`).join("");
      lastFrame = frame;
    }

    let llm = 0, policy = 0;
    for (const e of run.events) {
      const els = nodes.get(e.index);
      if (!els) continue;
      const visible = e.index <= cursor && matches(e);
      for (const el of els) {
        const show = el.classList.contains("role-call") ? e.index <= cursor : visible;
        const wasHidden = el.hidden;
        el.hidden = !show;
        el.classList.toggle("current", e.index === cursor);
        if (show && wasHidden && !force && e.index === cursor) { el.classList.remove("fresh"); void el.offsetWidth; el.classList.add("fresh"); }
      }
      if (visible && e.lane === "llm") llm++;
      if (visible && e.lane === "policy") policy++;
    }
    $("llm-count").textContent = `${llm} interaction${llm === 1 ? "" : "s"}`;
    $("policy-count").textContent = run.policy.state === "disabled" ? "Off" : `${policy}`;
    document.querySelectorAll(".waiting").forEach((w) => {
      w.hidden = [...w.parentElement.querySelectorAll("[data-event]")].some((c) => !c.hidden);
    });

    document.querySelectorAll(".role").forEach((r) => r.classList.toggle("lit", r.dataset.role === ev.role));

    if (force || cursor !== lastCursor) {
      document.querySelectorAll(".log-body, .role-list").forEach((box) => {
        const shown = [...box.querySelectorAll("[data-event]:not([hidden])")];
        const el = shown[shown.length - 1];
        if (!el) return;
        const top = el.offsetTop;
        if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) {
          box.scrollTop = top + el.offsetHeight - box.clientHeight + 6;
        }
      });
      lastCursor = cursor;
    }
  }

  /* ---------- playback ---------- */
  function seek(i) { cursor = Math.max(0, Math.min(run.events.length - 1, i)); update(); }
  function setPlayUI() {
    $("play").setAttribute("aria-pressed", String(playing));
    $("play-icon").textContent = playing ? "❚❚" : "▶";
    $("play-label").textContent = playing ? "Pause" : cursor === run.events.length - 1 ? "Replay" : "Play";
  }
  function play() {
    if (cursor === run.events.length - 1) cursor = 0;
    playing = true;
    setPlayUI();
    const tick = () => {
      if (cursor >= run.events.length - 1) { stop(); return; }
      seek(cursor + 1);
      timer = setTimeout(tick, run.events[cursor].lane === "llm" ? 1100 : 650);
    };
    timer = setTimeout(tick, 400);
    update();
  }
  function stop() { playing = false; clearTimeout(timer); if (run) setPlayUI(); }

  $("play").addEventListener("click", () => (playing ? stop() : play()));
  $("prev").addEventListener("click", () => { stop(); seek(cursor - 1); setPlayUI(); });
  $("next").addEventListener("click", () => { stop(); seek(cursor + 1); setPlayUI(); });
  $("latest").addEventListener("click", () => { stop(); seek(run.events.length - 1); setPlayUI(); });
  $("seek").addEventListener("input", (e) => { stop(); seek(+e.target.value); setPlayUI(); });
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, select") || document.querySelector("dialog[open]")) return;
    if (e.key === "ArrowRight") { stop(); seek(cursor + 1); setPlayUI(); }
    if (e.key === "ArrowLeft") { stop(); seek(cursor - 1); setPlayUI(); }
    if (e.key === " ") { e.preventDefault(); playing ? stop() : play(); }
  });

  /* ---------- detail drawer ---------- */
  const kv = (obj) => obj ? `<dl class="kv">${Object.entries(obj).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</dd>`).join("")}</dl>` : "";
  const ACTION_COLS = ["l_dx", "l_dy", "l_dz", "l_rx", "l_ry", "l_rz", "l_grip", "r_dx", "r_dy", "r_dz", "r_rx", "r_ry", "r_rz", "r_grip"];
  const JOINT_COLS = ["l_j1", "l_j2", "l_j3", "l_j4", "l_j5", "l_j6", "l_grip", "r_j1", "r_j2", "r_j3", "r_j4", "r_j5", "r_j6", "r_grip"];

  function ioBlock(kind, label, data, peer) {
    let body = `<p>${esc(data.summary)}</p>${kv(data.fields)}`;
    if (data.note) body += `<div class="note-box"><b>execution_note</b> · ${esc(data.note)}</div>`;
    if (data.rows) {
      const cols = kind === "policy" ? JOINT_COLS : ACTION_COLS;
      body += `<div class="table-wrap"><table><thead><tr><th>#</th>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${data.rows.map((r, i) => `<tr><td>${i + 1}</td>${r.map((v) => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      body += `<p class="caption">${kind === "policy" ? "Predicted joint and gripper targets. Prediction index is not an executed step." : "Translations in metres, rotation-vector deltas in radians; gripper 0 = closed, 1 = open."}${data.exact ? " " + esc(data.exact) : " Values are illustrative."}</p>`;
    }
    if (data.plan) body += `<pre class="json">${esc("[\n" + data.plan.map((p) => "  " + JSON.stringify(p)).join(",\n") + "\n]")}</pre>`;
    if (data.receipt) body += `<pre class="json">${esc(JSON.stringify(data.receipt, null, 2))}</pre>`;
    return `<section class="io"><div class="io-head"><b>${label}</b><span>${peer}</span></div><div class="io-body">${body}</div></section>`;
  }

  function openDetail(i) {
    stop();
    seek(i);
    setPlayUI();
    const e = run.events[i];
    const roleLabel = ROLES.find((r) => r[0] === e.role)[1];
    const kind = e.lane === "llm" ? "model" : e.lane === "policy" ? "policy" : "record";
    $("detail-category").textContent = `${e.lane === "llm" ? "LLM INTERACTION" : e.lane === "policy" ? "POLICY CALL" : "FUNCTIONAL RECORD"} · ${roleLabel.toUpperCase()}`;
    $("detail-title").textContent = e.title;
    const meta = [["Time", e.time], ["Control step", e.step], ["Module", roleLabel]];
    if (e.agentRole) meta.push(["Record role", e.agentRole]);
    if (e.model) meta.push(["Model", e.model + (e.effort ? ` · ${e.effort}` : "")]);
    if (e.duration) meta.push(["Duration", e.duration < 1 ? Math.round(e.duration * 1000) + " ms" : e.duration.toFixed(1) + " s"]);
    if (e.tokens) meta.push(["Tokens", `${e.tokens.input.toLocaleString()} in · ${e.tokens.output} out`]);
    meta.push(["Source", e.reported ? "Reported in trajectory report" : "Illustrative reconstruction"]);
    $("detail-meta").innerHTML = meta.map(([k, v]) => `<div><span>${k}</span><strong>${esc(v)}</strong></div>`).join("");
    const inLabel = kind === "model" ? "Model input" : kind === "policy" ? "Policy input" : "Input";
    const outLabel = kind === "model" ? "Model output" : kind === "policy" ? "Policy output" : e.role === "execution" ? "Execution result" : "Output";
    $("detail-body").innerHTML = ioBlock(e.lane, inLabel, e.input, `To ${esc(e.input.to)}`) + ioBlock(e.lane, outLabel, e.output, `From ${esc(e.output.from)}`);
    $("detail").showModal();
  }

  document.addEventListener("click", (e) => {
    const card = e.target.closest("[data-event]");
    if (card) return openDetail(+card.dataset.event);
    const cam = e.target.closest(".cam");
    if (cam) {
      stop(); setPlayUI();
      $("full-image").src = cam.dataset.src;
      $("full-image").alt = cam.dataset.label;
      $("image-title").textContent = cam.dataset.label;
      $("image-dialog").showModal();
    }
    if (e.target.closest(".close")) e.target.closest("dialog").close();
  });
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));
  $("media").addEventListener("close", () => $("media-video").pause());
  $("media-button").addEventListener("click", () => { stop(); setPlayUI(); $("media").showModal(); });

  /* ---------- start ---------- */
  selectRun(runs.find((r) => r.id === params.get("run")) || runs[0]);
  setPlayUI();

  if (!reduceMotion && params.get("autoplay") !== "0") {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !autoplayed) { autoplayed = true; play(); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(document.querySelector(".scene-panel"));
  }
})();
