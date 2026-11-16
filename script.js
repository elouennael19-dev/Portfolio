// Année dans le footer
document.getElementById("year").textContent = new Date().getFullYear();

// Menu mobile
const toggle = document.querySelector(".nav__toggle");
const menu = document.getElementById("nav-menu");

toggle.addEventListener("click", () => {
  const open = menu.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", open);
  toggle.textContent = open ? "[ close ]" : "[ menu ]";
});

menu.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => {
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", false);
    toggle.textContent = "[ menu ]";
  })
);

// Apparition des sections au scroll
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));


// Globe des études (d3, projection orthographique)
(function initGlobe() {
  const svgEl = document.getElementById("globe");
  if (!svgEl || !window.d3 || !window.topojson) return;

  const size = 600;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const buttons = [...document.querySelectorAll(".study")];
  const places = buttons.map((b) => ({
    btn: b,
    name: b.querySelector(".study__name").textContent,
    coords: "online" in b.dataset ? null : [+b.dataset.lon, +b.dataset.lat],
    flag: b.dataset.flag,
  }));

  const projection = d3.geoOrthographic()
    .scale(size / 2 - 12)
    .translate([size / 2, size / 2])
    .clipAngle(90)
    .rotate([4.49, -30]);
  const path = d3.geoPath(projection);
  const svg = d3.select(svgEl);

  // dégradé radial pour un effet de volume
  const grad = svg.append("defs").append("radialGradient")
    .attr("id", "globe-shade").attr("cx", "38%").attr("cy", "32%").attr("r", "70%");
  grad.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff");
  grad.append("stop").attr("offset", "70%").attr("stop-color", "#f1f3f6");
  grad.append("stop").attr("offset", "100%").attr("stop-color", "#e2e6eb");

  svg.append("path").datum({ type: "Sphere" }).attr("class", "globe__sphere");
  svg.append("path").datum(d3.geoGraticule10()).attr("class", "globe__grat");
  const land = svg.append("g");
  svg.append("path").datum({ type: "Sphere" }).attr("class", "globe__outline");

  const pins = svg.append("g").selectAll("g").data(places.filter((p) => p.coords)).join("g")
    .attr("class", "pin")
    .on("click", (_, d) => select(d));
  pins.append("circle").attr("class", "pin__pulse").attr("r", 6);
  pins.append("circle").attr("class", "pin__dot").attr("r", 2.5);
  // petit drapeau planté sur le lieu : mât + drapeau 16×11
  pins.append("line").attr("class", "pin__pole").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", -19);
  const flag = pins.append("g").attr("class", "pin__flag").attr("transform", "translate(0.5,-19)");
  flag.each(function (d) { drawFlag(d3.select(this), d.flag); });
  flag.append("rect").attr("class", "pin__flag-edge").attr("width", 16).attr("height", 11);
  pins.append("text").attr("class", "pin__label").attr("x", 20).attr("y", -11).text((d) => d.name);

  function drawFlag(g, code) {
    const r = (x, y, w, h, fill) => g.append("rect").attr("x", x).attr("y", y).attr("width", w).attr("height", h).attr("fill", fill);
    if (code === "fr") {
      r(0, 0, 5.34, 11, "#0055a4"); r(5.33, 0, 5.34, 11, "#fff"); r(10.66, 0, 5.34, 11, "#ef4135");
    } else if (code === "sg") {
      r(0, 0, 16, 5.5, "#ef3340"); r(0, 5.5, 16, 5.5, "#fff");
      g.append("circle").attr("cx", 3.6).attr("cy", 2.75).attr("r", 1.9).attr("fill", "#fff");
      g.append("circle").attr("cx", 4.3).attr("cy", 2.75).attr("r", 1.7).attr("fill", "#ef3340");
    } else if (code === "us") {
      r(0, 0, 16, 11, "#fff");
      for (let i = 0; i < 7; i += 2) r(0, i * (11 / 7), 16, 11 / 7, "#b22234");
      r(0, 0, 7, 11 * 4 / 7, "#3c3b6e");
    }
  }

  function render() {
    svg.selectAll(".globe__sphere, .globe__grat, .globe__outline").attr("d", path);
    land.selectAll("path").attr("d", path);
    const r = projection.rotate();
    const center = [-r[0], -r[1]];
    pins
      .attr("transform", (d) => `translate(${projection(d.coords)})`)
      .style("display", (d) => (d3.geoDistance(d.coords, center) > Math.PI / 2 ? "none" : null));
  }

  let auto = !reduceMotion;
  let tween = null;

  function select(place) {
    auto = false;
    buttons.forEach((b) => {
      const on = b === place.btn;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on);
    });
    pins.classed("is-active", (d) => d === place);
    // cours en ligne : pas de lieu, le globe reprend sa rotation lente
    if (!place.coords) { if (tween) tween.stop(); auto = !reduceMotion; return; }
    const from = projection.rotate();
    const to = [-place.coords[0], -place.coords[1] * 0.8];
    const interp = d3.interpolate(from, to);
    if (tween) tween.stop();
    if (reduceMotion) { projection.rotate(to); render(); return; }
    tween = d3.timer((t) => {
      const k = Math.min(1, t / 1200);
      projection.rotate(interp(d3.easeCubicInOut(k)));
      render();
      if (k === 1) tween.stop();
    });
  }

  buttons.forEach((b, i) => b.addEventListener("click", () => select(places[i])));

  // rotation à la souris / au doigt
  svg.call(d3.drag().on("start", () => { auto = false; if (tween) tween.stop(); })
    .on("drag", (e) => {
      const r = projection.rotate();
      const k = 75 / projection.scale();
      projection.rotate([r[0] + e.dx * k, Math.max(-80, Math.min(80, r[1] - e.dy * k))]);
      render();
    }));

  // rotation lente tant que personne n'a touché au globe (seulement quand visible)
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(svgEl);
  d3.timer(() => {
    if (!auto || !visible) return;
    const r = projection.rotate();
    projection.rotate([r[0] + 0.08, r[1]]);
    render();
  });

  d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json").then((world) => {
    const features = topojson.feature(world, world.objects.countries).features;
    land.selectAll("path")
      .data(features)
      .join("path")
      .attr("class", "globe__land");
    render();
  });

  pins.classed("is-active", (d) => d === places[0]);
  render();
})();

// Projets : vue Board (Kanban) ou vues galerie filtrées par thème
(function projectViews() {
  const tabs = document.querySelectorAll(".notion__views [data-view]");
  const board = document.getElementById("view-board");
  const gallery = document.getElementById("view-gallery");
  tabs.forEach((tab) => tab.addEventListener("click", () => {
    const v = tab.dataset.view;
    tabs.forEach((t) => {
      t.classList.toggle("is-active", t === tab);
      t.setAttribute("aria-selected", t === tab);
    });
    board.hidden = v !== "board";
    gallery.hidden = v === "board";
    gallery.querySelectorAll(".gcard").forEach((c) => c.classList.toggle("is-filtered", !c.dataset.themes.split(" ").includes(v)));
  }));
})();

// Projets : clic sur une carte (ou une ligne du tableau) → fenêtre de détail, fond flouté
(function projectModal() {
  const modal = document.querySelector(".pmodal");
  if (!modal) return;
  const slot = (n) => modal.querySelector(`[data-slot="${n}"]`);
  const cards = [...document.querySelectorAll(".ticket")];

  function open(card) {
    const col = card.closest(".kanban__col");
    slot("id").textContent = card.dataset.id;
    slot("title").textContent = card.querySelector(".ticket__title").textContent;
    slot("status").innerHTML = col.querySelector(".status").outerHTML;
    slot("tags").innerHTML = card.querySelector(".ticket__tags").outerHTML;
    const links = card.querySelector(".ticket__links");
    slot("links-row").hidden = !links;
    slot("links").innerHTML = links ? links.innerHTML : "";
    const detail = card.querySelector(".ticket__detail").cloneNode(true);
    detail.hidden = false;
    slot("detail").replaceChildren(...detail.children);
    modal.showModal();
  }

  cards.forEach((card) => {
    card.addEventListener("click", (e) => { if (!e.target.closest("a")) open(card); });
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(card); } });
  });
  // cartes de la galerie : ouvrent la fiche du même projet
  document.querySelectorAll(".gcard").forEach((g) => {
    const go = () => {
      const card = cards.find((c) => c.querySelector(".ticket__title").textContent === g.dataset.project);
      if (card) open(card);
    };
    g.addEventListener("click", (e) => { if (!e.target.closest("a")) go(); });
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  modal.querySelector(".pmodal__close").addEventListener("click", () => modal.close());
  // lien interne (ex. #contact) : on ferme la fiche pour laisser défiler la page
  modal.addEventListener("click", (e) => { const a = e.target.closest('a[href^="#"]'); if (a) modal.close(); });
  // clic en dehors de la carte = fermeture
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
})();

// Vidéos NAEL CREATION : clic sur une vignette → vidéo en grand, fond flouté
(function videoModal() {
  const modal = document.querySelector(".vmodal");
  if (!modal) return;
  const frame = modal.querySelector("iframe");
  document.querySelectorAll(".vthumb").forEach((btn) => btn.addEventListener("click", () => {
    frame.src = btn.dataset.video;
    modal.showModal();
  }));
  const close = () => modal.close();
  modal.querySelector(".vmodal__close").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  // on vide l'iframe à la fermeture pour couper le son
  modal.addEventListener("close", () => { frame.src = "about:blank"; });
})();

// Curseur de terminal : bloc clignotant + commande au survol des éléments cliquables
(function terminalCursor() {
  const ok = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  const cur = document.querySelector(".tcursor");
  if (!cur || !ok.matches) return;
  const cmd = cur.querySelector(".tcursor__cmd");
  document.documentElement.classList.add("has-tcursor");

  // commande affichée selon l'élément survolé (le premier qui correspond gagne)
  const rules = [
    [".vthumb", () => "> play"],
    [".ticket, .gcard", () => "> open"],
    [".notion__views button", () => "> view"],
    ["#globe", () => "> drag"],
    [".study[data-online]", () => "> open"],
    [".study", () => "> locate"],
    ['a[href^="mailto:"]', () => "> mail"],
    ['a[href^="#"]', (el) => "> cd " + el.getAttribute("href")],
    ['a[target="_blank"]', () => "> open ↗"],
    ["a, button", () => "> run"],
  ];

  let x = -100, y = -100, raf = 0, idle;
  const draw = () => { cur.style.transform = `translate3d(${x}px, ${y}px, 0)`; raf = 0; };

  addEventListener("mousemove", (e) => {
    x = e.clientX; y = e.clientY;
    if (!raf) raf = requestAnimationFrame(draw);
    cur.classList.remove("is-hidden");
    cur.classList.add("is-moving");
    clearTimeout(idle);
    idle = setTimeout(() => cur.classList.remove("is-moving"), 400);
  }, { passive: true });

  addEventListener("mouseover", (e) => {
    let label = "";
    for (const [sel, fn] of rules) {
      const el = e.target.closest(sel);
      if (el) { label = fn(el); break; }
    }
    cmd.textContent = label;
    cur.classList.toggle("has-cmd", !!label);
  });

  document.addEventListener("mouseleave", () => cur.classList.add("is-hidden"));
  // les vidéos et cartes externes (iframes) captent la souris : on masque le curseur dessus
  document.querySelectorAll("iframe").forEach((f) => {
    f.addEventListener("mouseenter", () => cur.classList.add("is-hidden"));
  });

  // fenêtres (projet, vidéo) : on rend le curseur normal tant qu'elles sont ouvertes
  const sync = () => document.documentElement.classList.toggle("modal-open", !!document.querySelector("dialog[open]"));
  new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
})();

// Écran d'accueil : < 30s → version courte ; « I have time » → site complet
(function intro() {
  const root = document.documentElement;
  const remember = () => { try { localStorage.setItem("intro-seen", "1"); } catch (e) {} };

  function leave(cls, sel, then) {
    const el = document.querySelector(sel);
    el.classList.add("is-leaving");
    setTimeout(() => { root.classList.remove(cls); el.classList.remove("is-leaving"); if (then) then(); }, 450);
  }

  document.querySelectorAll("[data-intro]").forEach((btn) => btn.addEventListener("click", () => {
    remember();
    if (btn.dataset.intro === "quick") {
      root.classList.add("show-quick");
      root.classList.remove("show-intro");
      history.replaceState(null, "", "#30s");
    } else {
      const from = root.classList.contains("show-quick") ? ["show-quick", ".quick"] : ["show-intro", ".intro"];
      leave(from[0], from[1], () => { history.replaceState(null, "", location.pathname); scrollTo(0, 0); });
    }
  }));
})();

