(() => {
  const CART_KEY = "amevuri-cart-v3";
  const ORDER_KEY = "amevuri-last-order-v3";
  const money = (n) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(n) || 0);
  const PRODUCTS = {
    "vela-cumaru-120": {
      id: "vela-cumaru-120",
      name: "Vela Aromática",
      size: "130g",
      fragrance: "Cumaru & Sândalo",
      price: 69.99,
    },
    "vela-sakura-120": {
      id: "vela-sakura-120",
      name: "Vela Aromática",
      size: "130g",
      fragrance: "Árvore de Sakura & Musk",
      price: 69.99,
    },
    "home-cumaru-250": {
      id: "home-cumaru-250",
      name: "Home Parfum",
      size: "250ml",
      fragrance: "Cumaru & Sândalo",
      price: 39.99,
    },
    "home-sakura-250": {
      id: "home-sakura-250",
      name: "Home Parfum",
      size: "250ml",
      fragrance: "Árvore de Sakura & Musk",
      price: 39.99,
    },
    "wax-cumaru-60": {
      id: "wax-cumaru-60",
      name: "Wax Melts",
      size: "80g",
      fragrance: "Cumaru & Sândalo",
      price: 39.99,
    },
    "wax-sakura-60": {
      id: "wax-sakura-60",
      name: "Wax Melts",
      size: "80g",
      fragrance: "Árvore de Sakura & Musk",
      price: 39.99,
    },
  };
  const escapeHtml = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  let liveStock = {};

  const getCart = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      const grouped = {};
      for (const i of raw) {
        if (
          i &&
          Object.hasOwn(PRODUCTS, i.id) &&
          Number.isInteger(i.quantity) &&
          i.quantity > 0
        )
          grouped[i.id] = Math.min(10, (grouped[i.id] || 0) + i.quantity);
      }
      return Object.entries(grouped).map(([id, quantity]) => ({
        id,
        quantity,
      }));
    } catch {
      return [];
    }
  };
  const saveCart = (items) => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    renderCart();
  };
  const cartCount = () => getCart().reduce((a, i) => a + i.quantity, 0);
  const cartSubtotal = () =>
    getCart().reduce(
      (a, i) => a + (PRODUCTS[i.id]?.price || 0) * i.quantity,
      0,
    );

  function addItem(id, quantity = 1) {
    const p = PRODUCTS[id];
    if (!p) return;
    const cart = getCart();
    const found = cart.find((i) => i.id === id);
    const max = Math.max(0, Math.min(10, Number(liveStock[id] ?? 10)));
    const nextQty = Math.min(max, (found?.quantity || 0) + quantity);
    if (found) found.quantity = nextQty;
    else if (nextQty > 0) cart.push({ id, quantity: nextQty });
    saveCart(cart);
    openCart();
  }
  function setQty(id, quantity) {
    const cart = getCart();
    const item = cart.find((i) => i.id === id);
    if (!item) return;
    const max = Math.max(0, Math.min(10, Number(liveStock[id] ?? 10)));
    item.quantity = Math.max(0, Math.min(max, quantity));
    saveCart(cart.filter((i) => i.quantity > 0));
  }
  function removeItem(id) {
    saveCart(getCart().filter((i) => i.id !== id));
  }

  function injectCartUI() {
    const nav = document.querySelector(".nav");
    if (nav && !nav.querySelector("[data-cart-open]")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "selection-btn cart-nav-btn";
      btn.setAttribute("data-cart-open", "");
      btn.innerHTML = "Sacola <span data-cart-count>0</span>";
      const cta = nav.querySelector(".nav-cta");
      if (cta) nav.insertBefore(btn, cta);
      else nav.appendChild(btn);
    }
    if (!document.querySelector(".cart-drawer")) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `<aside class="cart-drawer" aria-hidden="true" aria-label="Sacola AMEVURI">
        <div class="cart-backdrop" data-cart-close></div>
        <div class="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
          <button class="cart-close" aria-label="Fechar sacola" data-cart-close>×</button>
          <p class="eyebrow">Sua escolha</p><h2 id="cart-title">Sacola AMEVURI</h2>
          <p class="cart-intro">Escolhas para a atmosfera da sua casa, reunidas em um só lugar.</p>
          <div class="cart-items" data-cart-items></div><div class="cart-empty" data-cart-empty>Sua sacola ainda está vazia.</div>
          <div class="cart-summary"><span>Subtotal</span><strong data-cart-subtotal>R$ 0,00</strong></div>
          <p class="cart-shipping-note">Frete calculado no checkout.</p>
          <a class="btn btn-primary cart-checkout" href="/checkout" data-cart-checkout>Continuar para entrega</a>
        </div></aside>`,
      );
    }
    document
      .querySelectorAll("[data-cart-open]")
      .forEach((b) => b.addEventListener("click", openCart));
    document
      .querySelectorAll("[data-cart-close]")
      .forEach((b) => b.addEventListener("click", closeCart));
  }
  function openCart() {
    const d = document.querySelector(".cart-drawer");
    if (d) {
      d.classList.add("open");
      d.setAttribute("aria-hidden", "false");
      document.body.classList.add("cart-open");
      renderCart();
    }
  }
  function closeCart() {
    const d = document.querySelector(".cart-drawer");
    if (d) {
      d.classList.remove("open");
      d.setAttribute("aria-hidden", "true");
      document.body.classList.remove("cart-open");
    }
  }
  function renderCart() {
    document
      .querySelectorAll("[data-cart-count]")
      .forEach((e) => (e.textContent = cartCount()));
    const box = document.querySelector("[data-cart-items]");
    if (!box) return;
    const cart = getCart();
    box.innerHTML = "";
    const empty = document.querySelector("[data-cart-empty]");
    if (empty) empty.style.display = cart.length ? "none" : "block";
    cart.forEach((item) => {
      const p = PRODUCTS[item.id];
      if (!p) return;
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `<div class="cart-item-copy"><strong>${p.name} <small>${p.size}</small></strong><span>${p.fragrance}</span><em>${money(p.price)}</em></div>
        <div class="cart-qty"><button type="button" aria-label="Diminuir">−</button><span>${item.quantity}</span><button type="button" aria-label="Aumentar">+</button></div>
        <button class="cart-remove" type="button">Remover</button>`;
      const q = row.querySelectorAll(".cart-qty button");
      q[0].onclick = () => setQty(item.id, item.quantity - 1);
      q[1].onclick = () => setQty(item.id, item.quantity + 1);
      row.querySelector(".cart-remove").onclick = () => removeItem(item.id);
      box.appendChild(row);
    });
    const sub = document.querySelector("[data-cart-subtotal]");
    if (sub) sub.textContent = money(cartSubtotal());
    const checkout = document.querySelector("[data-cart-checkout]");
    if (checkout) checkout.classList.toggle("disabled", cart.length === 0);
  }

  async function loadStock() {
    try {
      const r = await fetch("/api/inventory", {
        headers: { accept: "application/json" },
      });
      if (!r.ok) return;
      const data = await r.json();
      if (!data.ok) return;
      liveStock = Object.fromEntries(data.products.map((p) => [p.id, p.stock]));
      document.querySelectorAll("[data-stock-sku]").forEach((el) => {
        const n = liveStock[el.dataset.stockSku];
        if (Number.isFinite(n))
          el.textContent =
            n > 0
              ? n <= 3
                ? `Últimas ${n} unidades`
                : "Disponível"
              : "Esgotado";
      });
      document.querySelectorAll("[data-sku]").forEach((btn) => {
        const n = liveStock[btn.dataset.sku];
        if (n <= 0) {
          btn.disabled = true;
          btn.textContent = "Esgotado";
        }
      });
      [
        ...new Set(
          [...document.querySelectorAll("[data-format-price]")].map(
            (i) => i.name,
          ),
        ),
      ].forEach(updateProductFormat);
    } catch {}
  }

  function bindBuyButtons() {
    document
      .querySelectorAll("[data-add-cart]")
      .forEach((btn) =>
        btn.addEventListener("click", () => addItem(btn.dataset.sku)),
      );
    document.querySelectorAll("[data-add-cart-radio]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const name = btn.dataset.addCartRadio;
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        if (checked) addItem(checked.value);
      }),
    );
    document
      .querySelectorAll("[data-format-price]")
      .forEach((input) =>
        input.addEventListener("change", () => updateProductFormat(input.name)),
      );
    const names = [
      ...new Set(
        [...document.querySelectorAll("[data-format-price]")].map(
          (i) => i.name,
        ),
      ),
    ];
    names.forEach(updateProductFormat);
  }
  function updateProductFormat(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    if (!checked) return;
    const p = PRODUCTS[checked.value];
    if (!p) return;
    const scent = p.id.includes("cumaru") ? "cumaru" : "sakura";
    const format = p.id.startsWith("vela-")
      ? "vela"
      : p.id.startsWith("wax-")
        ? "wax-melts"
        : "home";
    const photo = document.querySelector(".real-product-main");
    if (photo) {
      photo.src =
        format === "home"
          ? scent === "cumaru"
            ? "/assets/cumaru/cumaru-home-parfum.webp"
            : "/assets/catalog-v2/sakura-home-parfum.webp"
          : `/assets/catalog-v2/${scent}-${format}.webp`;
      photo.alt = `${p.name} ${p.size} ${p.fragrance} AMEVURI`;
      photo.classList.remove("img-failed");
      const caption = photo.closest("figure")?.querySelector("figcaption");
      if (caption)
        caption.textContent = `${p.name} · ${p.size} · ${p.fragrance}`;
    }
    document
      .querySelectorAll(`[data-add-cart-radio="${name}"]`)
      .forEach((btn) => {
        btn.disabled = liveStock[p.id] <= 0;
        btn.textContent = btn.disabled ? "Esgotado" : "Adicionar à sacola";
      });
    document
      .querySelectorAll(`[data-price-for="${name}"]`)
      .forEach((el) => (el.textContent = money(p.price)));
    document.querySelectorAll(`[data-stock-for="${name}"]`).forEach((el) => {
      const n = liveStock[p.id];
      el.textContent = Number.isFinite(n)
        ? n > 0
          ? n <= 3
            ? `Últimas ${n} unidades`
            : "Disponível"
          : "Esgotado"
        : "Consulte a disponibilidade";
    });
  }

  function checkoutPage() {
    const root = document.querySelector("[data-checkout]");
    if (!root) return;
    const cart = getCart();
    if (!cart.length) {
      root.querySelector("[data-checkout-empty]").hidden = false;
      root.querySelector("[data-checkout-body]").hidden = true;
      return;
    }
    const itemsBox = root.querySelector("[data-checkout-items]");
    cart.forEach((i) => {
      const p = PRODUCTS[i.id];
      if (!p) return;
      const row = document.createElement("div");
      row.className = "checkout-item";
      row.innerHTML = `<div><strong>${p.name} · ${p.size}</strong><span>${p.fragrance} × ${i.quantity}</span></div><b>${money(p.price * i.quantity)}</b>`;
      itemsBox.appendChild(row);
    });
    root.querySelector("[data-checkout-subtotal]").textContent =
      money(cartSubtotal());
    root.querySelector("[data-checkout-total]").textContent =
      money(cartSubtotal());

    let selectedShipping = null;
    const form = root.querySelector("[data-customer-form]");
    const quoteBtn = root.querySelector("[data-shipping-calc]");
    const quoteBox = root.querySelector("[data-shipping-quotes]");
    const shippingStatus = root.querySelector("[data-shipping-status]");
    const shippingValue = root.querySelector("[data-checkout-shipping]");
    const totalValue = root.querySelector("[data-checkout-total]");
    const payBtn = root.querySelector("[data-go-payment]");
    const status = root.querySelector("[data-checkout-status]");
    const postalInput = form?.elements?.namedItem("postalCode");

    const setStatus = (message, type = "") => {
      if (!status) return;
      status.textContent = message;
      status.className = `checkout-status ${type}`;
    };
    const setShippingStatus = (message, type = "notice", html = false) => {
      if (!shippingStatus) return;
      if (html) shippingStatus.innerHTML = message;
      else shippingStatus.textContent = message;
      shippingStatus.className = `shipping-status ${type}`;
    };

    const fetchJson = async (url, options = {}, timeoutMs = 15000) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const r = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: { accept: "application/json", ...(options.headers || {}) },
        });
        const text = await r.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {
            ok: false,
            error:
              text?.slice(0, 240) ||
              `Resposta inválida do servidor (${r.status}).`,
          };
        }
        return { r, data };
      } finally {
        clearTimeout(timer);
      }
    };

    const resetShipping = () => {
      selectedShipping = null;
      quoteBox.innerHTML = "";
      shippingValue.textContent = "A consultar";
      totalValue.textContent = money(cartSubtotal());
    };

    const explainShippingError = (data, statusCode) => {
      if (data?.code === "INVALID_POSTAL_CODE")
        return ["Informe um CEP válido com 8 números.", "error"];
      if (data?.code === "SHIPPING_SERVICES_UNAVAILABLE")
        return [
          "Não há modalidade de entrega disponível para este CEP. Fale conosco para consultar alternativas.",
          "notice",
        ];
      return [
        "Não foi possível calcular o frete agora. Tente novamente em instantes ou fale conosco.",
        "error",
      ];
    };
    let quoteVersion = 0;
    postalInput?.addEventListener("input", () => {
      quoteVersion++;
      resetShipping();
      setShippingStatus("Calcule o frete para o CEP informado.");
      const digits = String(postalInput.value || "")
        .replace(/\D/g, "")
        .slice(0, 8);
      postalInput.value = digits;
    });

    quoteBtn?.addEventListener("click", async () => {
      const cep = String(postalInput?.value || "").replace(/\D/g, "");
      if (cep.length !== 8) {
        setShippingStatus("Informe um CEP válido com 8 números.", "error");
        postalInput?.focus();
        return;
      }
      const version = ++quoteVersion;
      quoteBtn.disabled = true;
      quoteBtn.textContent = "Calculando…";
      resetShipping();
      setShippingStatus("Consultando transportadoras e prazos…", "notice");
      try {
        const { r, data } = await fetchJson(
          "/api/shipping-quote",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ postalCode: cep, items: cart }),
          },
          20000,
        );
        if (
          version !== quoteVersion ||
          String(postalInput.value).replace(/\D/g, "") !== cep
        )
          return;
        if (!r.ok || !data.ok) {
          const [msg, type] = explainShippingError(data, r.status);
          setShippingStatus(msg, type);
          return;
        }
        if (!Array.isArray(data.quotes) || !data.quotes.length) {
          setShippingStatus(
            "Nenhuma modalidade de entrega está disponível para este CEP.",
            "notice",
          );
          return;
        }
        setShippingStatus(
          `${data.quotes.length} ${data.quotes.length === 1 ? "opção encontrada" : "opções encontradas"}. Escolha a entrega desejada.`,
          "success",
        );
        data.quotes.forEach((q, idx) => {
          const label = document.createElement("label");
          label.className = "shipping-option";
          const deadline =
            q.deliveryTime != null && Number.isFinite(Number(q.deliveryTime))
              ? `até ${q.deliveryTime} dias úteis após a postagem`
              : "prazo informado pela transportadora";
          label.innerHTML = `<input type="radio" name="shipping" ${idx === 0 ? "checked" : ""}><span><strong>${escapeHtml(q.company)} · ${escapeHtml(q.service)}</strong><small>${deadline}</small></span><b>${money(q.price)}</b>`;
          const choose = () => {
            quoteBox
              .querySelectorAll(".shipping-option")
              .forEach((el) => el.classList.remove("is-selected"));
            label.classList.add("is-selected");
            selectedShipping = q;
            shippingValue.textContent = money(q.price);
            totalValue.textContent = money(cartSubtotal() + q.price);
          };
          label.querySelector("input").addEventListener("change", choose);
          quoteBox.appendChild(label);
          if (idx === 0) choose();
        });
      } catch (e) {
        if (e?.name === "AbortError")
          setShippingStatus(
            "A consulta de frete excedeu o tempo de resposta. Tente novamente.",
            "error",
          );
        else
          setShippingStatus(
            "Não foi possível alcançar o servidor de frete. Tente novamente em instantes.",
            "error",
          );
      } finally {
        quoteBtn.disabled = false;
        quoteBtn.textContent = "Calcular frete";
      }
    });

    payBtn?.addEventListener("click", async () => {
      if (!form.reportValidity()) return;
      if (!selectedShipping) {
        setShippingStatus(
          "Calcule e selecione o frete antes de continuar.",
          "error",
        );
        return;
      }
      if (JSON.stringify(cart) !== JSON.stringify(getCart())) {
        location.reload();
        return;
      }
      const customer = Object.fromEntries(new FormData(form).entries());
      payBtn.disabled = true;
      payBtn.textContent = "Abrindo pagamento seguro…";
      setStatus("Validando pedido, frete e disponibilidade…");
      try {
        const payload = {
          items: cart,
          customer,
          shipping: { id: selectedShipping.id, price: selectedShipping.price },
        };
        const hash = [
          ...new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(JSON.stringify(payload)),
            ),
          ),
        ]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
        const key = "amevuri-attempt-" + hash;
        let requestId = sessionStorage.getItem(key);
        if (!requestId) {
          requestId = crypto.randomUUID();
          sessionStorage.setItem(key, requestId);
        }
        const { r, data: d } = await fetchJson(
          "/api/create-checkout",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...payload, requestId }),
          },
          45000,
        );
        if (!r.ok || !d.ok) {
          if (d.code === "CHECKOUT_CLOSED") {
            sessionStorage.removeItem(key);
            setStatus(d.error, "notice");
          } else if (d.code === "SUMUP_NOT_CONFIGURED")
            setStatus(
              "O pagamento está temporariamente indisponível. Tente novamente mais tarde.",
              "notice",
            );
          else if (d.code === "SHIPPING_SELECTION_EXPIRED") {
            setStatus(
              "O frete mudou ou expirou. Calcule novamente antes de pagar.",
              "notice",
            );
            resetShipping();
          } else if (d.code === "SHIPPING_NOT_AUTHORIZED")
            setStatus(
              "O frete está temporariamente indisponível. Tente novamente em instantes.",
              "notice",
            );
          else
            setStatus(
              d.error || "Não foi possível iniciar o pagamento.",
              "error",
            );
          return;
        }
        let paymentUrl;
        try {
          paymentUrl = new URL(d.paymentUrl);
          if (
            paymentUrl.protocol !== "https:" ||
            !(
              paymentUrl.hostname === "sumup.com" ||
              paymentUrl.hostname.endsWith(".sumup.com")
            )
          )
            throw new Error();
        } catch {
          setStatus(
            "A página segura de pagamento não foi disponibilizada pela SumUp. Tente novamente.",
            "error",
          );
          return;
        }
        try {
          localStorage.setItem(
            ORDER_KEY,
            JSON.stringify({
              orderId: d.orderId,
              checkoutId: d.checkoutId,
              expiresAt: d.expiresAt,
              items: cart,
            }),
          );
        } catch {}
        setStatus(
          `Pedido ${d.orderId} reservado por até 30 minutos. Redirecionando para o ambiente seguro da SumUp…`,
          "success",
        );
        payBtn.textContent = "Redirecionando…";
        location.assign(paymentUrl.toString());
      } catch (e) {
        setStatus(
          e?.name === "AbortError"
            ? "O servidor de pagamento demorou para responder. Tente novamente."
            : "Não foi possível iniciar o pagamento agora. Tente novamente em instantes.",
          "error",
        );
      } finally {
        payBtn.disabled = false;
        if (document.contains(payBtn))
          payBtn.textContent = "Continuar para pagamento seguro";
      }
    });
  }

  function orderConfirmation() {
    const box = document.querySelector("[data-order-confirmation]");
    if (!box) return;
    const id = new URLSearchParams(location.search).get("order");
    const orderEl = box.querySelector("[data-order-id]");
    const statusEl = box.querySelector("[data-order-status]");
    if (!id) {
      if (orderEl) orderEl.textContent = "Não informado";
      if (statusEl) statusEl.textContent = "Informe o pedido para consultar";
      return;
    }
    if (orderEl) orderEl.textContent = id;
    const trackLink = box.querySelector("[data-order-track-link]");
    if (trackLink)
      trackLink.href = `/acompanhar-pedido?order=${encodeURIComponent(id)}`;

    let attempts = 0;
    const check = async () => {
      attempts++;
      try {
        const r = await fetch(
          `/api/verify-checkout?orderId=${encodeURIComponent(id)}`,
          { headers: { accept: "application/json" } },
        );
        const d = await r.json();
        if (!d.ok) {
          if (statusEl) statusEl.textContent = "Aguardando confirmação";
          return attempts < 8;
        }
        if (d.order.status === "paid") {
          if (statusEl) statusEl.textContent = "Pagamento confirmado";
          try {
            const last = JSON.parse(localStorage.getItem(ORDER_KEY) || "{}");
            if (
              last.orderId === id &&
              JSON.stringify(last.items) === JSON.stringify(getCart())
            )
              localStorage.removeItem(CART_KEY);
          } catch {}
          renderCart();
          return false;
        }
        if (["failed", "expired", "cancelled"].includes(d.order.status)) {
          if (statusEl) statusEl.textContent = "Pedido não concluído";
          return false;
        }
        if (statusEl) statusEl.textContent = "Pagamento em confirmação";
        return attempts < 8;
      } catch {
        if (statusEl) statusEl.textContent = "Aguardando confirmação";
        return attempts < 8;
      }
    };
    (async () => {
      while (await check()) await new Promise((r) => setTimeout(r, 2500));
    })();
  }

  injectCartUI();
  renderCart();
  bindBuyButtons();
  loadStock().then(() => {
    document
      .querySelectorAll("[data-format-price]:checked")
      .forEach((i) => updateProductFormat(i.name));
  });
  checkoutPage();
  orderConfirmation();
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCart();
  });
  window.AMEVURI_CART = { addItem, getCart, PRODUCTS, money };
})();
