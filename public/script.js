const header = document.querySelector(".site-header");
const menuBtn = document.querySelector(".menu-btn");
const nav = document.querySelector(".nav");
let menuOverlay = document.querySelector(".menu-overlay");
if (!menuOverlay && menuBtn && nav) {
  menuOverlay = document.createElement("div");
  menuOverlay.className = "menu-overlay";
  menuOverlay.setAttribute("aria-hidden", "true");
  document.body.appendChild(menuOverlay);
}
if (menuBtn && nav) {
  const setMenu = (open) => {
    nav.classList.toggle("open", open);
    if (menuOverlay) menuOverlay.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    document.body.classList.toggle("menu-open", open);
  };
  menuBtn.addEventListener("click", () =>
    setMenu(!nav.classList.contains("open")),
  );
  if (menuOverlay) menuOverlay.addEventListener("click", () => setMenu(false));
  nav
    .querySelectorAll("a")
    .forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) setMenu(false);
  });
}

// Product filtering
document.querySelectorAll(".filter").forEach((btn) =>
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const filter = btn.dataset.filter;
    document.querySelectorAll(".shop-card").forEach((card) => {
      const tags = (card.dataset.tags || "").split(" ");
      card.classList.toggle(
        "hidden",
        filter !== "all" && !tags.includes(filter),
      );
    });
  }),
);

// Curated selection / localStorage
const STORAGE_KEY = "amevuri-selection-v1";
const drawer = document.querySelector(".selection-drawer");
const itemsBox = document.querySelector("[data-selection-items]");
const emptyBox = document.querySelector("[data-selection-empty]");
const sendBtn = document.querySelector("[data-selection-send]");
const countEls = document.querySelectorAll("[data-selection-count]");
const safeSelectionText = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const selection = () => {
  try {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(items)
      ? items
          .filter(
            (i) =>
              i &&
              typeof i.product === "string" &&
              typeof i.format === "string",
          )
          .slice(0, 30)
      : [];
  } catch (e) {
    return [];
  }
};
const saveSelection = (items) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

function renderSelection() {
  if (!itemsBox) return;
  const items = selection();
  itemsBox.innerHTML = "";
  emptyBox.style.display = items.length ? "none" : "block";
  countEls.forEach((el) => (el.textContent = items.length));
  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "selection-item";
    row.innerHTML = `<div><strong>${safeSelectionText(item.product)}</strong><br><span>${safeSelectionText(item.format)}</span></div><button type="button" aria-label="Remover ${safeSelectionText(item.product)}">Remover</button>`;
    row.querySelector("button").addEventListener("click", () => {
      const next = selection();
      next.splice(idx, 1);
      saveSelection(next);
      renderSelection();
    });
    itemsBox.appendChild(row);
  });
  if (sendBtn) {
    const lines = items.map((i) => `• ${i.product}, ${i.format}`).join("\n");
    const msg = items.length
      ? `Olá, vim pelo site da AMEVURI e gostaria de uma curadoria para esta seleção:\n${lines}\n\nMeu ambiente é: `
      : `Olá, vim pelo site da AMEVURI e gostaria de uma curadoria de fragrância.`;
    sendBtn.href = `https://wa.me/5521971133616?text=${encodeURIComponent(msg)}`;
  }
}
function openSelection() {
  if (drawer) {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("selection-open");
    renderSelection();
  }
}
function closeSelection() {
  if (drawer) {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("selection-open");
  }
}
document
  .querySelectorAll("[data-selection-open]")
  .forEach((b) => b.addEventListener("click", openSelection));
document
  .querySelectorAll("[data-selection-close]")
  .forEach((b) => b.addEventListener("click", closeSelection));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSelection();
});
document.querySelectorAll(".add-selection").forEach((btn) =>
  btn.addEventListener("click", () => {
    let format = btn.dataset.format || "";
    if (btn.dataset.formatSource) {
      const checked = document.querySelector(
        `input[name="${btn.dataset.formatSource}"]:checked`,
      );
      format = checked ? checked.value : "";
    }
    const item = {
      product: btn.dataset.product,
      format: format || "Criação AMEVURI",
    };
    const items = selection();
    const exists = items.some(
      (i) => i.product === item.product && i.format === item.format,
    );
    if (!exists) {
      items.push(item);
      saveSelection(items);
    }
    openSelection();
  }),
);
renderSelection();

// Quiz
const quiz = document.querySelector("[data-quiz]");
if (quiz) {
  let step = 1;
  const answers = [];
  const progress = quiz.querySelector("[data-quiz-progress]");
  const steps = [...quiz.querySelectorAll(".quiz-step")];
  const result = quiz.querySelector("[data-result]");
  const configs = {
    refugio: {
      title: "Refúgio",
      copy: "Você procura uma atmosfera que reduza o ruído do dia e devolva intimidade ao espaço. Perfumes macios, envolventes e próximos tendem a fazer sentido para você.",
      product: "Cumaru & Sândalo",
      notes: "Madeiras quentes · cremosidade · presença serena",
      link: "/produto-cumaru-sandalo",
    },
    presenca: {
      title: "Presença",
      copy: "Você gosta quando a casa tem assinatura. Procura fragrâncias com personalidade, profundidade e uma memória que permaneça depois do primeiro instante.",
      product: "Cumaru & Sândalo",
      notes: "Cumaru · sândalo · madeiras envolventes",
      link: "/produto-cumaru-sandalo",
    },
    leveza: {
      title: "Leveza",
      copy: "Você se aproxima de atmosferas luminosas, delicadas e arejadas. Prefere uma fragrância que acompanhe o ambiente com suavidade.",
      product: "Árvore de Sakura & Musk",
      notes: "Flores luminosas · frutas suaves · musk",
      link: "/produto-sakura-musk",
    },
    aconchego: {
      title: "Aconchego",
      copy: "Para você, o perfume da casa deve aproximar: trazer calor, conforto e a sensação de que o tempo pode desacelerar um pouco.",
      product: "Cumaru & Sândalo",
      notes: "Madeiras macias · calor · conforto",
      link: "/produto-cumaru-sandalo",
    },
  };
  function showStep(n) {
    steps.forEach((s) =>
      s.classList.toggle("active", Number(s.dataset.step) === n),
    );
    if (progress) progress.style.width = `${Math.min(n, 4) * 25}%`;
  }
  quiz.querySelectorAll("[data-answer]").forEach((btn) =>
    btn.addEventListener("click", () => {
      answers.push(btn.dataset.answer);
      if (step < 4) {
        step++;
        showStep(step);
      } else {
        steps.forEach((s) => s.classList.remove("active"));
        const counts = answers.reduce(
          (a, v) => ((a[v] = (a[v] || 0) + 1), a),
          {},
        );
        const winner =
          Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] ||
          "refugio";
        const c = configs[winner];
        result.classList.add("active");
        if (progress) progress.style.width = "100%";
        quiz.querySelector("[data-result-title]").textContent = c.title;
        quiz.querySelector("[data-result-copy]").textContent = c.copy;
        quiz.querySelector("[data-result-product]").textContent = c.product;
        quiz.querySelector("[data-result-notes]").textContent = c.notes;
        quiz.querySelector("[data-result-link]").href = c.link;
        const quizMsg = `Olá, fiz a curadoria AMEVURI e minha atmosfera foi ${c.title}. Quero ajuda para escolher uma fragrância.`;
        quiz.querySelector("[data-result-whatsapp]").href =
          `https://wa.me/5521971133616?text=${encodeURIComponent(quizMsg)}`;
        result.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }),
  );
  const reset = quiz.querySelector("[data-quiz-reset]");
  if (reset)
    reset.addEventListener("click", () => {
      answers.length = 0;
      step = 1;
      result.classList.remove("active");
      showStep(1);
      quiz.scrollIntoView({ behavior: "smooth" });
    });
  // optional preselection from URL
  const mood = new URLSearchParams(location.search).get("mood");
  if (mood && configs[mood]) {
    answers.push(mood);
  }
}

// v3.3 stability guard: content must remain visible even if IntersectionObserver is unavailable.
document
  .querySelectorAll(".reveal")
  .forEach((el) => el.classList.add("visible"));

// AMEVURI v4.1, voltar com contexto; mantém fallback seguro para acesso direto.
document.querySelectorAll("[data-smart-back]").forEach((link) => {
  link.addEventListener("click", (event) => {
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.origin === location.origin && history.length > 1) {
        event.preventDefault();
        history.back();
      }
    } catch (_e) {}
  });
});

// AMEVURI v4.3, nunca exibe o ícone quebrado do navegador.
document.querySelectorAll("img").forEach((img) => {
  const markFailure = () => {
    img.classList.add("img-failed");
    const holder = img.closest("[data-image-fallback]");
    if (holder) holder.classList.add("image-missing");
  };
  if (img.complete && img.naturalWidth === 0) markFailure();
  else img.addEventListener("error", markFailure, { once: true });
});
