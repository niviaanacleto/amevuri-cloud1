import { providerFetch } from "../lib/provider-http.js";
const API = "https://api.sumup.com";
export const sumupConfigured = (env) =>
  Boolean(
    String(env.SUMUP_API_KEY || "").trim() &&
    String(env.SUMUP_MERCHANT_CODE || "").trim(),
  );
async function request(env, path, options = {}) {
  if (!sumupConfigured(env)) {
    const e = new Error("SUMUP_NOT_CONFIGURED");
    e.code = "SUMUP_NOT_CONFIGURED";
    throw e;
  }
  const r = await providerFetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${String(env.SUMUP_API_KEY).trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await r.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    const e = new Error(
      data.details ||
        data.detail ||
        data.message ||
        data.error_message ||
        `SumUp respondeu ${r.status}`,
    );
    e.status = r.status;
    e.data = data;
    throw e;
  }
  return data;
}
export function validateHostedUrl(value) {
  const u = new URL(String(value || ""));
  if (
    u.protocol !== "https:" ||
    !(u.hostname === "sumup.com" || u.hostname.endsWith(".sumup.com"))
  )
    throw new Error("A SumUp não retornou uma URL de pagamento válida.");
  return u.toString();
}
export async function createCheckout(
  env,
  { orderId, amount, description, origin },
) {
  const payload = {
    checkout_reference: orderId,
    amount,
    currency: "BRL",
    merchant_code: String(env.SUMUP_MERCHANT_CODE).trim(),
    description: String(description || "").slice(0, 255),
    valid_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    return_url: `${origin}/api/sumup/webhook`,
    redirect_url: `${origin}/pedido-recebido?order=${encodeURIComponent(orderId)}`,
    hosted_checkout: { enabled: true },
  };
  const out = await request(env, "/v0.1/checkouts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return {
    ...out,
    hosted_checkout_url: validateHostedUrl(out.hosted_checkout_url),
  };
}
export const getCheckout = (env, id) =>
  request(env, `/v0.1/checkouts/${encodeURIComponent(id)}`, { method: "GET" });
export const deactivateCheckout = (env, id) =>
  request(env, `/v0.1/checkouts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
export async function paymentMethods(env, amount = 10) {
  const m = encodeURIComponent(env.SUMUP_MERCHANT_CODE || "");
  const q = new URLSearchParams({ amount: String(amount), currency: "BRL" });
  return request(env, `/v0.1/merchants/${m}/payment-methods?${q}`, {
    method: "GET",
  });
}

export async function findCheckout(env, reference) {
  const list = await request(
    env,
    `/v0.1/checkouts?checkout_reference=${encodeURIComponent(reference)}`,
  );
  if (!Array.isArray(list)) throw new Error("Resposta inválida da SumUp.");
  return list.find((c) => c.checkout_reference === reference) || null;
}
