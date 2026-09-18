import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { harness, payload, cart, customer } from "./harness.mjs";
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
test("Cadastro Privé valida consentimentos e evita duplicidade", async () => {
  const h = await harness();
  const member = {
    name: "Nivia Anacleto",
    email: "nivia@example.com",
    phone: "21971133616",
    acceptTerms: true,
    acceptPrivacy: true,
    marketingConsent: true,
  };
  assert.equal(
    (await h.api("/api/prive/register", { ...member, acceptTerms: false }))
      .status,
    400,
  );
  const first = await h.api("/api/prive/register", member);
  const second = await h.api("/api/prive/register", {
    ...member,
    name: "Nivia A.",
  });
  assert.equal(first.status, 201);
  assert.equal(first.data.created, true);
  assert.equal(second.status, 200);
  assert.equal(second.data.created, false);
  assert.equal(second.data.member.pointsBalance, 0);
  await h.drain();
  assert.equal(
    h.state.calls.filter((c) => c.url === "https://api.resend.com/emails")
      .length,
    1,
  );
});
test("Compra paga credita pontos Privé uma única vez e exclui o frete", async () => {
  const h = await harness();
  await h.api("/api/prive/register", {
    name: "Cliente Privé",
    email: customer.email,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  await h.drain();
  const { data } = await h.api("/api/create-checkout", payload());
  h.state.checkouts.get(data.checkoutId).status = "PAID";
  await Promise.all([
    h.api("/api/verify-checkout?orderId=" + data.orderId),
    h.api("/api/verify-checkout?orderId=" + data.orderId),
  ]);
  const member = h.memory.get(`prive-member:${customer.email.toLowerCase()}`);
  assert.equal(member.pointsBalance, 179);
  assert.equal(member.lifetimePoints, 179);
  assert.equal(h.memory.get(`prive-ledger:${data.orderId}`).eligibleValue, 179.97);
});
test("Pesos oficiais e identificadores compatíveis", async () => {
  const h = await harness();
  const r = await h.api("/api/inventory");
  assert.equal(r.status, 200);
  assert.deepEqual(
    r.data.products
      .filter((p) => p.format === "Vela aromática")
      .map((p) => p.size),
    ["130g", "130g"],
  );
  assert.deepEqual(
    r.data.products.filter((p) => p.format === "Wax Melts").map((p) => p.size),
    ["80g", "80g"],
  );
});
test("Frete envia seguro unitário e não revela origem", async () => {
  const h = await harness();
  const r = await h.api("/api/shipping-quote", {
    postalCode: "01001000",
    items: cart,
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.origin, undefined);
  const call = h.state.calls.find((c) => c.url.endsWith("/calculate"));
  assert.equal(call.body.products[0].insurance_value, 69.99);
  assert.equal(call.body.products[0].quantity, 2);
  assert.equal(call.body.from.postal_code, "24358080");
});
test("Entradas inválidas, duplicações e quantidades são recusadas", async () => {
  const h = await harness();
  for (const items of [
    [null],
    [{ id: "toString", quantity: 1 }],
    [
      { id: cart[0].id, quantity: 6 },
      { id: cart[0].id, quantity: 6 },
    ],
    [{ id: cart[0].id, quantity: 0 }],
  ])
    assert.equal(
      (await h.api("/api/shipping-quote", { postalCode: "01001000", items }))
        .status,
      400,
    );
  assert.equal((await h.api("/api/create-checkout", "null")).status, 400);
  assert.equal((await h.api("/api/create-checkout", "{")).status, 400);
});
test("CPF, UF e telefone são validados antes de cobrar", async () => {
  for (const patch of [
    { cpf: "11111111111" },
    { state: "XX" },
    { phone: "1" },
  ]) {
    const h = await harness(),
      p = payload();
    p.customer = { ...customer, ...patch };
    assert.equal((await h.api("/api/create-checkout", p)).status, 400);
    assert.equal(h.state.checkouts.size, 0);
  }
});
test("Frete alterado exige confirmação do novo preço", async () => {
  const h = await harness();
  h.state.quotePrice = 25;
  assert.equal((await h.api("/api/create-checkout", payload())).status, 409);
  assert.equal(h.state.checkouts.size, 0);
  assert.equal((await h.store.getInventory())[cart[0].id], 10);
});
test("Checkout usa preços do catálogo e reserva uma vez", async () => {
  const h = await harness(),
    p = payload();
  p.items = p.items.map((i) => ({ ...i, price: 0.01 }));
  const a = await h.api("/api/create-checkout", p),
    b = await h.api("/api/create-checkout", p);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.data.orderId, b.data.orderId);
  assert.equal(a.data.total, 192.47);
  assert.equal(h.state.checkouts.size, 1);
  assert.equal((await h.store.getInventory())[cart[0].id], 8);
});
test("Requisições simultâneas não duplicam a reserva", async () => {
  const h = await harness(),
    p = payload();
  const results = await Promise.all([
    h.api("/api/create-checkout", p),
    h.api("/api/create-checkout", p),
  ]);
  assert(results.some((r) => r.status === 200));
  assert.equal(h.state.checkouts.size, 1);
  assert.equal((await h.store.getInventory())[cart[0].id], 8);
});
test("Resposta perdida é recuperada sem criar nova cobrança", async () => {
  const h = await harness(),
    p = payload();
  h.state.ambiguous = true;
  assert.equal((await h.api("/api/create-checkout", p)).status, 503);
  const r = await h.api("/api/create-checkout", p);
  assert.equal(r.status, 200);
  assert.equal(h.state.checkouts.size, 1);
  assert.equal((await h.store.getInventory())[cart[0].id], 8);
});
test("Expiração repetida devolve estoque uma única vez", async () => {
  const h = await harness(),
    p = payload();
  const { data } = await h.api("/api/create-checkout", p);
  h.state.checkouts.get(data.checkoutId).status = "EXPIRED";
  await Promise.all([
    h.api("/api/verify-checkout?orderId=" + data.orderId),
    h.api("/api/verify-checkout?orderId=" + data.orderId),
  ]);
  assert.equal((await h.store.getInventory())[cart[0].id], 10);
});
test("Webhook valida valor, moeda, referência e recebedor", async () => {
  for (const bad of [
    { amount: 0.01 },
    { currency: "USD" },
    { merchant_code: "OTHER" },
  ]) {
    const h = await harness();
    const { data } = await h.api("/api/create-checkout", payload());
    Object.assign(
      h.state.checkouts.get(data.checkoutId),
      { status: "PAID" },
      bad,
    );
    const r = await h.api("/api/sumup/webhook", {
      event_type: "CHECKOUT_STATUS_CHANGED",
      id: data.checkoutId,
    });
    assert.equal(r.status, 502);
    assert.equal((await h.store.getOrder(data.orderId)).status, "reserved");
  }
});
test("Pagamento confirmado não regride nem duplica emails", async () => {
  const h = await harness();
  const { data } = await h.api("/api/create-checkout", payload());
  const c = h.state.checkouts.get(data.checkoutId);
  c.status = "PAID";
  const body = { event_type: "CHECKOUT_STATUS_CHANGED", id: data.checkoutId };
  await Promise.all([
    h.api("/api/sumup/webhook", body),
    h.api("/api/sumup/webhook", body),
  ]);
  assert.equal(
    h.state.calls.filter((c) => c.url === "https://api.resend.com/emails")
      .length,
    2,
  );
  c.status = "EXPIRED";
  await h.api("/api/sumup/webhook", body);
  assert.equal((await h.store.getOrder(data.orderId)).status, "paid");
  assert.equal((await h.store.getInventory())[cart[0].id], 8);
});
test("Falha de email fica persistida e pode ser reenviada", async () => {
  const h = await harness();
  const { data } = await h.api("/api/create-checkout", payload());
  h.state.emailFail = true;
  h.state.checkouts.get(data.checkoutId).status = "PAID";
  await h.api("/api/sumup/webhook", {
    event_type: "CHECKOUT_STATUS_CHANGED",
    id: data.checkoutId,
  });
  assert.equal((await h.store.getOrder(data.orderId)).status, "paid");
  const keys = [...h.memory].filter(
    ([k, v]) => k.startsWith("notify:") && v.state === "pending",
  );
  assert.equal(keys.length, 2);
  h.state.emailFail = false;
  for (const [k, v] of keys) h.memory.set(k, { ...v, nextAttemptAt: 0 });
  await h.worker.scheduled({}, h.env, h.ctx);
  await h.drain();
  assert(keys.every(([k]) => h.memory.get(k).state === "sent"));
  const calls = h.state.calls.filter(
    (c) => c.url === "https://api.resend.com/emails",
  );
  const retry = calls
    .slice(2)
    .find(
      (c) =>
        c.headers["Idempotency-Key"] === calls[0].headers["Idempotency-Key"],
    );
  assert(retry);
  assert.deepEqual(calls[0].body, retry.body);
});
test("API pública não expõe cliente ou rastreio sem email", async () => {
  const h = await harness();
  const { data } = await h.api("/api/create-checkout", payload());
  const r = await h.api("/api/verify-checkout?orderId=" + data.orderId);
  assert.deepEqual(Object.keys(r.data.order).sort(), ["id", "status"]);
  assert.equal(
    (
      await h.api("/api/order-status", {
        orderId: data.orderId,
        email: "outro@example.com",
      })
    ).status,
    404,
  );
});
test("Admin requer chave e não confirma pedido sem pagamento", async () => {
  const h = await harness();
  const { data } = await h.api("/api/create-checkout", payload());
  assert.equal(
    (await h.api("/api/admin-order", { orderId: data.orderId })).status,
    401,
  );
  assert.equal(
    (
      await h.api(
        "/api/admin-order",
        { orderId: data.orderId, sendConfirmationEmail: true },
        { "x-amevuri-setup-key": "test-admin" },
      )
    ).status,
    409,
  );
});
test("Webhook Melhor Envio recusa assinatura inválida", async () => {
  const h = await harness();
  assert.equal(
    (
      await h.api("/api/melhor-envio/webhook", {
        event: "order.posted",
        data: { id: "x" },
      })
    ).status,
    401,
  );
});
test("Webhook Melhor Envio assinado atualiza rastreio", async () => {
  const h = await harness();
  const { data } = await h.api("/api/create-checkout", payload());
  h.state.checkouts.get(data.checkoutId).status = "PAID";
  await h.api("/api/verify-checkout?orderId=" + data.orderId);
  await h.store.updateOrder(data.orderId, { melhorEnvioOrderId: "label-1" });
  const body = JSON.stringify({
    event: "order.posted",
    data: {
      id: "label-1",
      tracking: "BR123",
      tracking_url: "https://www.melhorrastreio.com.br/rastreio/BR123",
    },
  });
  const signature = createHmac("sha256", "test-secret")
    .update(body)
    .digest("base64");
  assert.equal(
    (
      await h.api("/api/melhor-envio/webhook", body, {
        "x-me-signature": signature,
      })
    ).status,
    204,
  );
  assert.equal(
    (await h.store.getOrder(data.orderId)).fulfillmentStatus,
    "posted",
  );
});
test("OAuth state é consumido uma vez mesmo em concorrência", async () => {
  const h = await harness();
  await h.store.putAuth("oauth-state:nonce", { createdAt: Date.now() });
  const results = await Promise.all([
    h.store.consumeOAuthState("nonce"),
    h.store.consumeOAuthState("nonce"),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
});
test("Renovação concorrente compartilha um único refresh", async () => {
  const h = await harness();
  delete h.env.MELHOR_ENVIO_TOKEN;
  await h.store.putAuth("oauth-token", {
    access_token: "old",
    refresh_token: "refresh",
    expires_at: Date.now() - 100,
  });
  await Promise.all([
    h.store.refreshMelhorEnvio("http://localhost"),
    h.store.refreshMelhorEnvio("http://localhost"),
  ]);
  assert.equal(
    h.state.calls.filter((c) => c.url.endsWith("/oauth/token")).length,
    1,
  );
});
test("Falha de uma tentativa não libera estoque enquanto checkout pode ser pago", async () => {
  const h = await harness(),
    p = payload();
  const { data } = await h.api("/api/create-checkout", p);
  h.state.checkouts.get(data.checkoutId).status = "FAILED";
  await h.api("/api/verify-checkout?orderId=" + data.orderId);
  assert.equal((await h.store.getInventory())[cart[0].id], 8);
  assert.equal((await h.store.getOrder(data.orderId)).status, "reserved");
});
test("Entrega confirmada não regride com webhook atrasado", async () => {
  const h = await harness();
  const { data } = await h.api("/api/create-checkout", payload());
  h.state.checkouts.get(data.checkoutId).status = "PAID";
  await h.api("/api/verify-checkout?orderId=" + data.orderId);
  await h.store.updateFulfillment(data.orderId, "delivered");
  await h.store.updateFulfillment(data.orderId, "posted");
  assert.equal(
    (await h.store.getOrder(data.orderId)).fulfillmentStatus,
    "delivered",
  );
});
test("Painel mostra falhas de email e recusa URL insegura", async () => {
  const h = await harness();
  const { data } = await h.api("/api/create-checkout", payload());
  h.state.emailFail = true;
  h.state.checkouts.get(data.checkoutId).status = "PAID";
  await h.api("/api/verify-checkout?orderId=" + data.orderId);
  const headers = { "x-amevuri-setup-key": "test-admin" };
  const r = await h.api(
    "/api/admin-order?orderId=" + data.orderId,
    undefined,
    headers,
  );
  assert.equal(r.status, 200);
  assert.equal(
    r.data.order.notifications.filter((n) => n.state === "pending").length,
    2,
  );
  assert.equal(
    (
      await h.api(
        "/api/admin-order",
        { orderId: data.orderId, trackingUrl: "javascript:alert(1)" },
        headers,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await h.api(
        "/api/admin-order",
        { orderId: data.orderId, sendTrackingEmail: true },
        headers,
      )
    ).status,
    400,
  );
});
test("Pedidos após os primeiros cem também entram na manutenção", async () => {
  const h = await harness();
  for (let i = 0; i < 125; i++)
    h.memory.set("order:" + String(i).padStart(3, "0"), { id: String(i) });
  const seen = new Set();
  for (let i = 0; i < 13; i++)
    for (const o of await h.store.orderPage(10)) seen.add(o.id);
  assert.equal(seen.size, 125);
});
test("Checkout vencido ainda pendente é desativado antes de liberar estoque", async () => {
  const h = await harness();
  const { data } = await h.api("/api/create-checkout", payload());
  h.state.checkouts.get(data.checkoutId).valid_until = new Date(
    Date.now() - 120000,
  ).toISOString();
  const r = await h.api("/api/verify-checkout?orderId=" + data.orderId);
  assert.equal(r.data.order.status, "expired");
  assert.equal((await h.store.getInventory())[cart[0].id], 10);
  assert.equal(h.state.calls.filter((c) => c.method === "DELETE").length, 1);
});
test("Transação pendente mantém reserva mesmo após vencimento da sessão", async () => {
  const h = await harness();
  const { data } = await h.api("/api/create-checkout", payload());
  Object.assign(h.state.checkouts.get(data.checkoutId), {
    valid_until: new Date(Date.now() - 120000).toISOString(),
    transactions: [{ status: "PENDING" }],
  });
  await h.api("/api/verify-checkout?orderId=" + data.orderId);
  await h.api("/api/verify-checkout?orderId=" + data.orderId);
  assert.equal((await h.store.getOrder(data.orderId)).status, "reserved");
  assert.equal((await h.store.getInventory())[cart[0].id], 8);
});
let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log("PASS " + name);
    passed++;
  } catch (e) {
    console.error("FAIL " + name, e);
    process.exitCode = 1;
  }
}
console.log(`${passed}/${tests.length} testes aprovados.`);
