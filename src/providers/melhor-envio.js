import { providerFetch } from "../lib/provider-http.js";
const digits = (v) => String(v || "").replace(/\D/g, "");
const safe = (v) =>
  String(v || "")
    .replace(/<[^>]*>/g, "")
    .slice(0, 220);
export const base = (env) =>
  (env.MELHOR_ENVIO_ENV || "production") === "sandbox"
    ? "https://sandbox.melhorenvio.com.br"
    : "https://melhorenvio.com.br";
export const clientId = (env) =>
  String(env.MELHOR_ENVIO_CLIENT_ID || "29241").trim();
export const userAgent = (env) =>
  String(env.MELHOR_ENVIO_USER_AGENT || "AMEVURI (contato@amevuri.com.br)");
export const redirectUri = (env, origin) =>
  String(
    env.MELHOR_ENVIO_REDIRECT_URI ||
      `${origin}/api/melhor-envio/oauth-callback`,
  ).trim();
export async function saveState(store, state) {
  await store.putAuth(`oauth-state:${state}`, { state, createdAt: Date.now() });
}
export const consumeState = (store, state) => store.consumeOAuthState(state);
export async function saveTokens(store, p) {
  const expires = Number(p.expires_in || 2592000);
  const rec = {
    access_token: p.access_token,
    refresh_token: p.refresh_token,
    token_type: p.token_type || "Bearer",
    expires_in: expires,
    expires_at: Date.now() + expires * 1000,
    updated_at: new Date().toISOString(),
  };
  if (!rec.access_token || !rec.refresh_token)
    throw new Error("O Melhor Envio não retornou os tokens esperados.");
  await store.putAuth("oauth-token", rec);
  return rec;
}
async function tokenRequest(env, body, origin) {
  if (!env.MELHOR_ENVIO_CLIENT_SECRET)
    throw new Error("MELHOR_ENVIO_CLIENT_SECRET não configurado.");
  const form = new URLSearchParams();
  Object.entries(body).forEach(([k, v]) => v != null && form.set(k, String(v)));
  const r = await providerFetch(`${base(env)}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(env),
    },
    body: form,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(
      d.message ||
        d.error_description ||
        "Não foi possível autenticar com o Melhor Envio.",
    );
    e.status = r.status;
    e.details = d;
    throw e;
  }
  return d;
}
export const exchangeCode = (env, code, origin) =>
  tokenRequest(
    env,
    {
      grant_type: "authorization_code",
      client_id: Number(clientId(env)),
      client_secret: env.MELHOR_ENVIO_CLIENT_SECRET,
      redirect_uri: redirectUri(env, origin),
      code,
    },
    origin,
  );
export const refreshTokens = (env, refreshToken, origin) =>
  tokenRequest(
    env,
    {
      grant_type: "refresh_token",
      client_id: Number(clientId(env)),
      client_secret: env.MELHOR_ENVIO_CLIENT_SECRET,
      refresh_token: refreshToken,
    },
    origin,
  );
export async function validToken(env, store, origin) {
  if (env.MELHOR_ENVIO_TOKEN) return String(env.MELHOR_ENVIO_TOKEN).trim();
  let rec = await store.getAuth("oauth-token");
  if (!rec?.access_token) {
    const e = new Error("O Melhor Envio ainda não foi autorizado.");
    e.code = "MELHOR_ENVIO_NOT_AUTHORIZED";
    throw e;
  }
  if (Date.now() >= Number(rec.expires_at || 0) - 86400000) {
    rec = await store.refreshMelhorEnvio(origin);
  }
  return rec.access_token;
}
export async function api(env, store, origin, path, options = {}) {
  const token = await validToken(env, store, origin);
  const r = await providerFetch(`${base(env)}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": userAgent(env),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await r.text();
  let d = {};
  try {
    d = text ? JSON.parse(text) : {};
  } catch {
    d = { message: text };
  }
  if (!r.ok) {
    const e = new Error(
      d.message || d.error || `Melhor Envio respondeu ${r.status}.`,
    );
    e.status = r.status;
    e.details = d;
    throw e;
  }
  return d;
}
export async function shippingQuote(env, store, origin, { postalCode, items }) {
  const destination = digits(postalCode);
  if (destination.length !== 8) {
    const e = new Error("Informe um CEP válido.");
    e.code = "INVALID_POSTAL_CODE";
    e.status = 400;
    throw e;
  }
  const from = digits(env.AMEVURI_ORIGIN_CEP || "24358080");
  if (from.length !== 8) {
    const e = new Error("CEP de origem não configurado.");
    e.code = "SHIPPING_NOT_CONFIGURED";
    e.status = 503;
    throw e;
  }
  let token;
  try {
    token = await validToken(env, store, origin);
  } catch (c) {
    const e = new Error(
      "O Melhor Envio ainda precisa ser autorizado pela AMEVURI.",
    );
    e.code = "SHIPPING_NOT_AUTHORIZED";
    e.status = 503;
    throw e;
  }
  const products = items.map((p) => ({
    id: p.id,
    width: Number(p.shipping.widthCm),
    height: Number(p.shipping.heightCm),
    length: Number(p.shipping.lengthCm),
    weight: Number(p.shipping.weightKg),
    insurance_value: Number(p.price.toFixed(2)),
    quantity: p.quantity,
  }));
  const r = await providerFetch(`${base(env)}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": userAgent(env),
    },
    body: JSON.stringify({
      from: { postal_code: from },
      to: { postal_code: destination },
      products,
      options: { receipt: false, own_hand: false },
    }),
  });
  const text = await r.text();
  let d = {};
  try {
    d = text ? JSON.parse(text) : {};
  } catch {
    d = { message: safe(text) };
  }
  if (!r.ok) {
    const e = new Error(
      safe(d?.message || d?.error || "Não foi possível calcular o frete."),
    );
    e.status = r.status;
    e.code =
      r.status === 401
        ? "SHIPPING_TOKEN_INVALID"
        : r.status === 403
          ? "SHIPPING_PERMISSION_DENIED"
          : r.status === 422
            ? "SHIPPING_PROVIDER_VALIDATION"
            : "SHIPPING_PROVIDER_ERROR";
    throw e;
  }
  if (!Array.isArray(d)) {
    const e = new Error("Resposta inesperada do Melhor Envio.");
    e.code = "SHIPPING_PROVIDER_ERROR";
    e.status = 502;
    throw e;
  }
  const valid = d.filter(
    (s) =>
      !s?.error &&
      (s?.custom_price ?? s?.price) != null &&
      (s?.custom_price ?? s?.price) !== "" &&
      Number.isFinite(Number(s?.custom_price ?? s?.price)),
  );
  if (!valid.length) {
    const reasons = [
      ...new Set(d.map((s) => safe(s?.error)).filter(Boolean)),
    ].slice(0, 3);
    const e = new Error(reasons[0] || "Nenhum serviço de entrega disponível.");
    e.code = "SHIPPING_SERVICES_UNAVAILABLE";
    e.status = 422;
    e.reasons = reasons;
    throw e;
  }
  const quotes = valid
    .map((s) => ({
      id: String(s.id),
      service: String(s.name || "Entrega"),
      company: String(s.company?.name || "Transportadora"),
      price: Number(s.custom_price ?? s.price),
      deliveryTime:
        (s.custom_delivery_time ?? s.delivery_time) == null
          ? null
          : Number(s.custom_delivery_time ?? s.delivery_time),
    }))
    .filter((q) => Number.isFinite(q.price) && q.price >= 0)
    .sort((a, b) => a.price - b.price)
    .slice(0, 5);
  if (!quotes.length) {
    const e = new Error("Nenhum serviço de entrega disponível.");
    e.code = "SHIPPING_SERVICES_UNAVAILABLE";
    e.status = 422;
    throw e;
  }
  return { postalCode: destination, quotes };
}
export async function tracking(env, store, origin, id) {
  const raw = await api(env, store, origin, "/api/v2/me/shipment/tracking", {
    method: "POST",
    body: JSON.stringify({ orders: [String(id)] }),
  });
  let item = null;
  if (Array.isArray(raw)) item = raw[0] || null;
  else if (raw && typeof raw === "object") {
    item =
      raw[String(id)] || raw.data?.[String(id)] || raw.data || raw.order || raw;
    if (Array.isArray(item)) item = item[0] || null;
  }
  return { raw, item: item && typeof item === "object" ? item : {} };
}
