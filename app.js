const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- particle field ---------- */
(() => {
  const canvas = document.getElementById("field");
  const ctx = canvas.getContext("2d");
  const mouse = { x: -9999, y: -9999 };
  let w, h, dpr, points;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    const count = Math.round(Math.min(110, (innerWidth * innerHeight) / 14000));
    points = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25 * dpr,
      vy: (Math.random() - 0.5) * 0.25 * dpr,
      r: (Math.random() * 1.4 + 0.4) * dpr,
      hue: Math.random() < 0.5 ? "0,240,255" : Math.random() < 0.5 ? "124,92,255" : "255,61,154",
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    const link = 130 * dpr;
    const mx = mouse.x * dpr, my = mouse.y * dpr;

    for (const p of points) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;

      const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
      if (d < 160 * dpr && d > 0) {
        p.x += (dx / d) * 0.9 * dpr;
        p.y += (dy / d) * 0.9 * dpr;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.hue},.8)`;
      ctx.fill();
    }

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i], b = points[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < link) {
          ctx.strokeStyle = `rgba(${a.hue},${(1 - d / link) * 0.22})`;
          ctx.lineWidth = dpr * 0.6;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  addEventListener("resize", resize);
  addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  resize();
  frame();
})();

/* ---------- self-improvement loop ---------- */
(() => {
  const ring = document.getElementById("ring-path");
  const comet = document.getElementById("comet");
  const nodes = [...document.querySelectorAll(".node")];
  const runEl = document.getElementById("core-run");
  const rateEl = document.getElementById("core-rate");
  const bar = document.getElementById("core-bar");
  const period = 5200;
  let run = 1, start = performance.now(), lit = -1;

  const rateFor = (n) => Math.round(95 - 83 * Math.pow(0.8, n - 1));

  function setRun() {
    runEl.textContent = "#" + String(run).padStart(3, "0");
    const rate = rateFor(run);
    rateEl.textContent = rate;
    bar.style.width = rate + "%";
  }

  function tick(now) {
    let t = (now - start) / period;
    if (t >= 1) {
      start = now; t = 0;
      run = run >= 30 ? 1 : run + 1;
      setRun();
    }
    const angle = -Math.PI / 2 + t * Math.PI * 2;
    comet.setAttribute("transform", `translate(${260 + 190 * Math.cos(angle)} ${260 + 190 * Math.sin(angle)})`);
    ring.style.strokeDashoffset = String(100 - t * 100);

    let stage = -1;
    for (let i = 0; i < 4; i++) {
      const dist = Math.min(Math.abs(t - i / 4), Math.abs(t - 1 - i / 4));
      if (dist < 0.07) stage = i;
    }
    if (stage !== lit) {
      lit = stage;
      nodes.forEach((n, i) => n.classList.toggle("lit", i === stage));
    }
    requestAnimationFrame(tick);
  }

  setRun();
  if (reduceMotion) {
    ring.style.strokeDashoffset = "0";
    comet.setAttribute("transform", "translate(260 70)");
  } else {
    requestAnimationFrame(tick);
  }
})();

/* ---------- headline effects ---------- */
(() => {
  const el = document.querySelector(".scramble");
  const words = el.dataset.words.split("|");
  const glyphs = "!<>-_\\/[]{}=+*^?#01";
  let index = 0;

  function scrambleTo(target) {
    const from = el.textContent;
    const len = Math.max(from.length, target.length);
    let frame = 0;
    const total = 28;
    const step = () => {
      let out = "";
      for (let i = 0; i < len; i++) {
        const reveal = (i / len) * total * 0.7 + total * 0.3;
        if (frame >= reveal) out += target[i] || "";
        else out += frame < (i / len) * total * 0.5 ? from[i] || "" : glyphs[(Math.random() * glyphs.length) | 0];
      }
      el.textContent = out;
      if (frame++ < total) requestAnimationFrame(step);
      else el.textContent = target;
    };
    step();
  }

  const title = document.querySelector(".glitch");
  function glitch() {
    title.classList.add("glitching");
    setTimeout(() => title.classList.remove("glitching"), 160);
    setTimeout(() => {
      title.classList.add("glitching");
      setTimeout(() => title.classList.remove("glitching"), 90);
    }, 240);
  }

  if (!reduceMotion) {
    setInterval(() => { index = (index + 1) % words.length; scrambleTo(words[index]); }, 3200);
    setTimeout(glitch, 900);
    setInterval(glitch, 5500);
  }
})();

/* ---------- reveal + counters ---------- */
(() => {
  document.querySelectorAll(".flow, .methods, .modes, .stats, .bench, .videos").forEach((group) => {
    [...group.querySelectorAll(".reveal")].forEach((el, i) => el.style.setProperty("--d", `${i * 0.08}s`));
  });

  const countUp = (el) => {
    const target = Number(el.dataset.count);
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 1400);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("in");
      entry.target.querySelectorAll("[data-count]").forEach(countUp);
      if (entry.target.matches("[data-count]")) countUp(entry.target);
      io.unobserve(entry.target);
    }
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  if (reduceMotion) document.querySelectorAll("[data-count]").forEach((el) => { el.textContent = el.dataset.count; });
})();

/* ---------- card spotlight + tilt ---------- */
(() => {
  document.querySelectorAll(".glow-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      card.style.setProperty("--mx", `${x}px`);
      card.style.setProperty("--my", `${y}px`);
      if (!reduceMotion && card.classList.contains("method")) {
        const rx = ((y / r.height) - 0.5) * -10;
        const ry = ((x / r.width) - 0.5) * 10;
        card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
      }
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });
})();

/* ---------- top bar ---------- */
(() => {
  const bar = document.querySelector(".topbar");
  const links = [...document.querySelectorAll(".topnav a")];
  const sections = links.map((a) => document.querySelector(a.hash));

  function update() {
    bar.classList.toggle("scrolled", scrollY > 30);
    let current = -1;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * 0.35) current = i; });
    links.forEach((a, i) => a.classList.toggle("active", i === current));
  }
  addEventListener("scroll", update, { passive: true });
  update();
})();

/* ---------- keyframe timeline ---------- */
(() => {
  const frames = {
    start: { file: "align-start.webp", step: 0, pos: 0, alt: "Three unaligned pink blocks and a ruler sit between two grippers.", description: "At step 0, three blocks sit in front of the ruler before the robot moves." },
    push: { file: "align-push.webp", step: 81, pos: 60, alt: "The robot uses a ruler to push three pink blocks into a line.", description: "At step 81, the robot uses a ruler to push three blocks into alignment." },
    finish: { file: "align-finish.webp", step: 135, pos: 100, alt: "Three pink blocks sit in a line as the robot returns to its initial pose.", description: "At step 135, the benchmark reports task success and a score of 100." },
  };

  const img = document.getElementById("run-frame");
  const label = document.getElementById("camera-label");
  const note = document.getElementById("run-note");
  const fill = document.getElementById("timeline-fill");
  const buttons = [...document.querySelectorAll(".timeline button")];
  const dir = new URL("./assets/", location.href);

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const f = frames[button.dataset.frame];
      img.classList.add("swap");
      setTimeout(() => {
        img.onload = () => img.classList.remove("swap");
        img.src = new URL(f.file, dir).href;
        img.alt = f.alt;
      }, 180);
      label.textContent = `HEAD CAM · STEP ${String(f.step).padStart(3, "0")}`;
      note.textContent = f.description;
      fill.style.width = `${f.pos}%`;
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    });
  });
})();

/* ---------- terminal ---------- */
(() => {
  const code = document.getElementById("setup-command");
  const source = code.textContent;
  const lines = source.split("\n");
  const copy = document.querySelector(".copy");
  const status = document.getElementById("copy-status");
  let reset;

  copy.addEventListener("click", async () => {
    clearTimeout(reset);
    try {
      await navigator.clipboard.writeText(source);
      copy.textContent = "Copied ✓";
      status.textContent = "Commands copied to the clipboard.";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      copy.textContent = "Selected";
      status.textContent = "Use the browser's copy command to copy the selected text.";
    }
    reset = setTimeout(() => { copy.textContent = "Copy"; status.textContent = ""; }, 2200);
  });

  const render = (typed, partial) => {
    code.innerHTML = "";
    typed.forEach((line, i) => {
      const span = document.createElement("span");
      span.className = "ln" + (line === "" ? " blank" : "");
      span.textContent = i === typed.length - 1 && partial != null ? partial : line;
      code.appendChild(span);
    });
    const caret = document.createElement("span");
    caret.className = "caret";
    (code.lastChild || code).appendChild(caret);
  };

  if (reduceMotion) { render(lines); return; }

  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    let li = 0, ci = 0;
    const type = () => {
      if (li >= lines.length) return render(lines);
      const line = lines[li];
      ci++;
      render(lines.slice(0, li + 1), line.slice(0, ci));
      if (ci >= line.length) { li++; ci = 0; setTimeout(type, line === "" ? 120 : 260); }
      else setTimeout(type, 14 + Math.random() * 26);
    };
    type();
  }, { threshold: 0.4 });

  render([""]);
  io.observe(code);
})();
