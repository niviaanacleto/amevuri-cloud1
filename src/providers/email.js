import { providerFetch, safeHttpsUrl } from "../lib/provider-http.js";
const escapeHtml = (v) =>
  String(v ?? "").replace(
    /[&<>'"]/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        ch
      ],
  );
const money = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(n) || 0,
  );
export const emailConfigured = (env) =>
  Boolean(
    String(env.RESEND_API_KEY || "").trim() &&
    String(env.AMEVURI_EMAIL_FROM || "").trim(),
  );
const siteUrl = (env, origin) =>
  String(env.AMEVURI_SITE_URL || origin || "").replace(/\/$/, "");
async function send(env, { to, subject, html }, key) {
  if (!emailConfigured(env)) {
    const e = new Error("Email transacional ainda não configurado.");
    e.code = "EMAIL_NOT_CONFIGURED";
    throw e;
  }
  const payload = {
    from: String(env.AMEVURI_EMAIL_FROM).trim(),
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (env.AMEVURI_REPLY_TO)
    payload.reply_to = String(env.AMEVURI_REPLY_TO).trim();
  const r = await providerFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(payload),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(
      d?.message || d?.error || `Falha ao enviar email (${r.status}).`,
    );
    e.status = r.status;
    throw e;
  }
  if (!d.id) throw new Error("Resposta inválida do Resend.");
  return d;
}
const copy = {
  payment_confirmed: [
    "Seu pedido está confirmado.",
    "O pagamento foi aprovado. Agora começa uma parte que acontece longe da tela: preparar cada detalhe para que sua escolha chegue à casa com o mesmo cuidado com que foi criada.",
  ],
  preparing: [
    "Seu ritual está sendo preparado.",
    "Seu pedido entrou em preparação no atelier AMEVURI. Assim que ele seguir viagem, você receberá o código de rastreio por email.",
  ],
  shipped: [
    "Seu pedido está a caminho.",
    "A atmosfera que você escolheu já iniciou o percurso até sua casa.",
  ],
  delivered: [
    "Seu pedido chegou.",
    "A entrega foi registrada como concluída. Esperamos que o primeiro encontro com a AMEVURI comece antes mesmo da chama, no gesto de abrir a caixa.",
  ],
  delivery_issue: [
    "Há uma atualização sobre sua entrega.",
    "A transportadora registrou uma ocorrência no percurso. Consulte o rastreio e, se precisar, fale conosco.",
  ],
  cancelled: [
    "Atualização do seu pedido.",
    "O envio foi marcado como cancelado. Se isso não era esperado, fale conosco para verificarmos os próximos passos.",
  ],
};
function subject(type, o) {
  return type === "payment_confirmed"
    ? `Pedido confirmado · ${o.id} · AMEVURI`
    : type === "preparing"
      ? `Seu pedido está sendo preparado · ${o.id}`
      : type === "shipped"
        ? `Seu pedido AMEVURI está a caminho · ${o.id}`
        : type === "delivered"
          ? `Seu pedido AMEVURI chegou · ${o.id}`
          : `Atualização do pedido · ${o.id} · AMEVURI`;
}
function body(env, origin, o, type) {
  o = { ...o, trackingUrl: safeHttpsUrl(o.trackingUrl) };
  const [title, intro] = copy[type] || copy.payment_confirmed;
  const track = `${siteUrl(env, origin)}/acompanhar-pedido?order=${encodeURIComponent(o.id)}`;
  const rows = (o.items || [])
    .map(
      (i) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #ece4d9">${escapeHtml(i.name)} · ${escapeHtml(i.size)}<br><span style="color:#6f7772">${escapeHtml(i.fragrance)} × ${Number(i.quantity) || 1}</span></td><td style="padding:10px 0;border-bottom:1px solid #ece4d9;text-align:right">${money((Number(i.price) || 0) * (Number(i.quantity) || 1))}</td></tr>`,
    )
    .join("");
  const tracking =
    o.trackingCode || o.trackingUrl
      ? `<div style="margin:24px 0;padding:18px;border:1px solid #d8c9b6"><strong>Rastreio</strong><br>${escapeHtml(o.trackingCode || "")}${o.trackingUrl ? `<br><a href="${escapeHtml(o.trackingUrl)}">Acompanhar entrega →</a>` : ""}</div>`
      : "";
  return `<!doctype html><html><body style="margin:0;background:#f4efe7;color:#27332e;font-family:Arial,sans-serif"><table width="100%"><tr><td align="center" style="padding:32px 14px"><table width="100%" style="max-width:640px;background:#fbf8f2;border:1px solid #e3d9ca"><tr><td style="padding:34px 38px;text-align:center;border-bottom:1px solid #e8dfd3"><div style="font:500 21px Georgia,serif;letter-spacing:.22em;color:#173f33">AMEVURI</div><div style="margin-top:8px;font-size:10px;letter-spacing:.18em;color:#b68a43">PERFUME, MATÉRIA E MEMÓRIA.</div></td></tr><tr><td style="padding:38px"><div style="font-size:11px;letter-spacing:.15em;color:#b68a43">PEDIDO ${escapeHtml(o.id)}</div><h1 style="font:400 38px Georgia,serif;color:#173f33">${escapeHtml(title)}</h1><p style="line-height:1.75;color:#66716b">${escapeHtml(intro)}</p>${tracking}<table width="100%" style="border-collapse:collapse">${rows}</table><p style="margin-top:18px">Total: <strong>${money(o.total)}</strong></p><p style="text-align:center;margin-top:30px"><a href="${escapeHtml(track)}" style="display:inline-block;background:#173f33;color:white;text-decoration:none;padding:14px 22px">Acompanhar meu pedido</a></p><p style="font-size:12px;color:#7a827e">Fale conosco: <a href="https://wa.me/5521971133616">(21) 97113 3616</a>.</p></td></tr></table></td></tr></table></body></html>`;
}
async function deliver(env, store, key, entry) {
  if (entry.state === "sent" || !(await store.claimNotification(key)))
    return { skipped: true };
  try {
    const result = await send(env, entry.payload, key);
    await store.completeNotification(key, { providerId: result.id });
    return { ok: true };
  } catch (error) {
    await store.releaseNotificationClaim(key, error.message);
    throw error;
  }
}
export async function notifyOrder(
  env,
  store,
  origin,
  order,
  type,
  { force = false } = {},
) {
  if (!order?.customer?.email) throw new Error("Pedido sem email de destino.");
  if (type === "payment_confirmed" && order.status !== "paid")
    throw new Error("O pagamento ainda não foi confirmado.");
  const suffix =
    type === "shipped"
      ? order.melhorEnvioOrderId || order.trackingCode || "shipment"
      : "event";
  let key = `${order.id}:${type}:${suffix}`;
  const payload = {
    to: order.customer.email,
    subject: subject(type, order),
    html: body(env, origin, order, type),
  };
  let entry = await store.enqueueEmail(key, payload);
  if (force && entry.state === "sent") {
    key += ":" + crypto.randomUUID();
    entry = await store.enqueueEmail(key, payload);
  }
  return deliver(env, store, key, entry);
}
export async function notifyAdminPaid(env, store, origin, order) {
  if (!env.AMEVURI_ORDER_EMAIL) return { skipped: true };
  const key = `${order.id}:admin-paid`;
  const entry = await store.enqueueEmail(key, {
    to: String(env.AMEVURI_ORDER_EMAIL).trim(),
    subject: `Nova compra AMEVURI · ${order.id} · ${money(order.total)}`,
    html: `<h2>Nova compra confirmada</h2><p>${escapeHtml(order.id)}</p><p>${escapeHtml(order.customer?.name)}</p><p>Total: ${money(order.total)}</p><p><a href="${escapeHtml(siteUrl(env, origin))}/admin-pedidos?order=${encodeURIComponent(order.id)}">Abrir gestão do pedido</a></p>`,
  });
  return deliver(env, store, key, entry);
}
export async function notifyPriveWelcome(env, store, origin, member) {
  if (!member?.email) throw new Error("Cadastro Privé sem email.");
  const key = `prive:${member.id}:welcome`;
  const entry = await store.enqueueEmail(key, {
    to: member.email,
    subject: "Bem-vinda ao AMEVURI Privé",
    html: `<!doctype html><html><body style="margin:0;background:#f4efe7;color:#27332e;font-family:Arial,sans-serif"><table width="100%"><tr><td align="center" style="padding:32px 14px"><table width="100%" style="max-width:640px;background:#fbf8f2;border:1px solid #e3d9ca"><tr><td style="padding:34px 38px;text-align:center;border-bottom:1px solid #e8dfd3"><div style="font:500 21px Georgia,serif;letter-spacing:.22em;color:#173f33">AMEVURI PRIVÉ</div></td></tr><tr><td style="padding:38px"><div style="font-size:11px;letter-spacing:.15em;color:#b68a43">SUA RELAÇÃO COM A FRAGRÂNCIA CONTINUA</div><h1 style="font:400 38px Georgia,serif;color:#173f33">Seu cadastro está confirmado.</h1><p style="line-height:1.75;color:#66716b">Olá, ${escapeHtml(member.name)}. A partir de agora, compras elegíveis realizadas com este mesmo email poderão acumular pontos AMEVURI.</p><div style="margin:24px 0;padding:18px;border:1px solid #d8c9b6"><strong>R$1 em produtos elegíveis = 1 ponto</strong><br><span style="color:#6f7772">100 pontos = R$5 em crédito AMEVURI</span></div><p style="text-align:center;margin-top:30px"><a href="${escapeHtml(siteUrl(env, origin))}/prive" style="display:inline-block;background:#173f33;color:white;text-decoration:none;padding:14px 22px">Conhecer o AMEVURI Privé</a></p><p style="font-size:12px;color:#7a827e">Fale conosco: <a href="https://wa.me/5521971133616">(21) 97113 3616</a>.</p></td></tr></table></td></tr></table></body></html>`,
  });
  return deliver(env, store, key, entry);
}
export async function retryEmails(env, store) {
  for (const entry of await store.pendingEmails())
    try {
      await deliver(env, store, entry.key, entry);
    } catch (error) {
      console.error("Email pendente", entry.key, error.code || "SEND_FAILED");
    }
}
