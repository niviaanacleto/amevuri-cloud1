// Local contract tests only. No network requests or real messages/payments.
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function harness() {
  const state = {
    calls: [],
    checkouts: new Map(),
    quotePrice: 12.5,
    emailFail: false,
    ambiguous: false,
    quoteDelay: 0,
  };
  const clone = (v) => (v === undefined ? undefined : structuredClone(v));
  const memory = new Map();
  let queue = Promise.resolve();
  const ops = {
    get: async (k) => clone(memory.get(k)),
    put: async (k, v) => {
      memory.set(k, clone(v));
    },
    delete: async (k) => memory.delete(k),
    list: async ({ prefix = "", limit = Infinity, startAfter = "" } = {}) =>
      new Map(
        [...memory]
          .filter(([k]) => k.startsWith(prefix) && k > startAfter)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(0, limit)
          .map(([k, v]) => [k, clone(v)]),
      ),
  };
  const storage = {
    ...ops,
    transaction: (fn) => {
      const pending = queue.then(async () => {
        const before = clone(memory);
        try {
          return await fn(ops);
        } catch (e) {
          memory.clear();
          for (const [k, v] of before) memory.set(k, v);
          throw e;
        }
      });
      queue = pending.catch(() => {});
      return pending;
    },
  };
  const mockFetch = async (url, opt = {}) => {
    const u = new URL(url),
      method = opt.method || "GET",
      body = typeof opt.body === "string" ? JSON.parse(opt.body) : opt.body;
    state.calls.push({ url: String(url), method, body, headers: opt.headers });
    if (u.hostname === "api.resend.com")
      return Response.json(
        state.emailFail
          ? { message: "temporarily unavailable" }
          : { id: "email-" + state.calls.length },
        { status: state.emailFail ? 503 : 200 },
      );
    if (u.hostname.includes("melhorenvio.com.br")) {
      if (u.pathname === "/oauth/token")
        return Response.json({
          access_token: "new-token",
          refresh_token: "new-refresh",
          expires_in: 2592000,
        });
      if (u.pathname.endsWith("/calculate")) {
        if (state.quoteDelay)
          await new Promise((r) => setTimeout(r, state.quoteDelay));
        return Response.json([
          {
            id: 1,
            name: "PAC",
            company: { name: "Correios" },
            price: state.quotePrice,
            delivery_time: 5,
          },
        ]);
      }
      if (u.pathname.endsWith("/tracking"))
        return Response.json({
          [body.orders[0]]: {
            status: "posted",
            tracking: "BR123456789",
            tracking_url:
              "https://www.melhorrastreio.com.br/rastreio/BR123456789",
          },
        });
      return Response.json({});
    }
    if (u.hostname === "api.sumup.com") {
      if (method === "DELETE") {
        const c = state.checkouts.get(u.pathname.split("/").at(-1));
        if (c.status !== "PAID") c.status = "EXPIRED";
        return Response.json(c);
      }
      if (u.pathname.endsWith("/payment-methods"))
        return Response.json({
          available_payment_methods: [{ id: "card" }, { id: "pix" }],
        });
      if (method === "POST") {
        const c = {
          ...body,
          id: "checkout-" + (state.checkouts.size + 1),
          status: "PENDING",
          hosted_checkout_url: "https://checkout.sumup.com/pay/local-test",
        };
        state.checkouts.set(c.id, c);
        if (state.ambiguous) {
          state.ambiguous = false;
          throw new Error("response lost");
        }
        return Response.json(c);
      }
      if (u.pathname === "/v0.1/checkouts")
        return Response.json(
          [...state.checkouts.values()].filter(
            (c) =>
              c.checkout_reference === u.searchParams.get("checkout_reference"),
          ),
        );
      return Response.json(
        state.checkouts.get(decodeURIComponent(u.pathname.split("/").at(-1))) ||
          {},
        {
          status: state.checkouts.has(
            decodeURIComponent(u.pathname.split("/").at(-1)),
          )
            ? 200
            : 404,
        },
      );
    }
    throw new Error("Unexpected external request " + url);
  };
  const context = vm.createContext({
    console,
    URL,
    URLSearchParams,
    Request,
    Response,
    Headers,
    TextEncoder,
    TextDecoder,
    AbortSignal,
    crypto: webcrypto,
    setTimeout,
    clearTimeout,
    fetch: mockFetch,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  });
  const modules = new Map();
  async function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    if (filename === "cloudflare:workers") {
      const m = new vm.SyntheticModule(
        ["DurableObject"],
        function () {
          this.setExport("DurableObject", class {});
        },
        { context, identifier: filename },
      );
      modules.set(filename, m);
      return m;
    }
    const mod = new vm.SourceTextModule(fs.readFileSync(filename, "utf8"), {
      context,
      identifier: filename,
    });
    modules.set(filename, mod);
    return mod;
  }
  const main = await load(path.join(root, "src/index.js"));
  await main.link((spec, ref) =>
    load(
      spec === "cloudflare:workers"
        ? spec
        : path.resolve(path.dirname(ref.identifier), spec),
    ),
  );
  await main.evaluate();
  const env = {
    SUMUP_API_KEY: "test",
    SUMUP_MERCHANT_CODE: "MTEST",
    MELHOR_ENVIO_TOKEN: "test-token",
    MELHOR_ENVIO_CLIENT_SECRET: "test-secret",
    AMEVURI_SETUP_KEY: "test-admin",
    RESEND_API_KEY: "test",
    AMEVURI_EMAIL_FROM: "AMEVURI <test@example.com>",
    AMEVURI_ORDER_EMAIL: "admin@example.com",
  };
  const store = new main.namespace.AmevuriStore({ storage }, env);
  env.AMEVURI_STORE = { getByName: () => store };
  const pending = [];
  const ctx = { waitUntil: (p) => pending.push(p) };
  const api = async (
    route,
    body,
    headers = {},
    method = body === undefined ? "GET" : "POST",
  ) => {
    const res = await main.namespace.default.fetch(
      new Request("http://localhost" + route, {
        method,
        headers: { "content-type": "application/json", ...headers },
        ...(body === undefined
          ? {}
          : { body: typeof body === "string" ? body : JSON.stringify(body) }),
      }),
      env,
      ctx,
    );
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data };
  };
  return {
    state,
    store,
    env,
    api,
    memory,
    worker: main.namespace.default,
    ctx,
    modules,
    async drain() {
      await Promise.all(pending.splice(0));
    },
  };
}
export const customer = {
  name: "Cliente de Teste",
  email: "cliente@example.com",
  phone: "21999999999",
  cpf: "52998224725",
  postalCode: "01001000",
  street: "Rua de Teste",
  number: "1",
  neighborhood: "Centro",
  city: "São Paulo",
  state: "SP",
};
export const cart = [
  { id: "vela-cumaru-120", quantity: 2 },
  { id: "wax-sakura-60", quantity: 1 },
];
export const payload = () => ({
  requestId: webcrypto.randomUUID(),
  items: cart,
  customer,
  shipping: { id: "1", price: 12.5 },
});
