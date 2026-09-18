import { DurableObject } from "cloudflare:workers";
import { CATALOG } from "./lib/catalog.js";
import { refreshTokens, saveTokens } from "./providers/melhor-envio.js";
const seedInventory = () =>
  Object.fromEntries(Object.values(CATALOG).map((p) => [p.id, p.initialStock]));
const now = () => new Date().toISOString();
export class AmevuriStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.refreshPromise = null;
  }
  async getInventory() {
    return this.ctx.storage.transaction(async (t) => {
      let stock = await t.get("inventory");
      if (!stock) {
        stock = seedInventory();
        await t.put("inventory", stock);
      }
      return stock;
    });
  }
  // Stock and order commit together, including deduplication.
  async reserveOrder(order) {
    return this.ctx.storage.transaction(async (t) => {
      const old = await t.get(`order:${order.id}`);
      if (old) {
        if (old.fingerprint !== order.fingerprint) {
          const e = new Error(
            "Esta tentativa de pagamento contém dados diferentes.",
          );
          e.code = "CHECKOUT_CONFLICT";
          throw e;
        }
        return { created: false, order: old };
      }
      const stock = (await t.get("inventory")) || seedInventory();
      for (const i of order.items) {
        if (Number(stock[i.id] || 0) < i.quantity) {
          const e = new Error(
            `Estoque insuficiente para ${CATALOG[i.id]?.name || "este produto"}.`,
          );
          e.code = "OUT_OF_STOCK";
          throw e;
        }
        stock[i.id] -= i.quantity;
      }
      await t.put("inventory", stock);
      await t.put(`order:${order.id}`, order);
      return { created: true, order };
    });
  }
  async getOrder(id) {
    return (await this.ctx.storage.get(`order:${id}`)) || null;
  }
  async registerPriveMember(profile) {
    return this.ctx.storage.transaction(async (t) => {
      const email = String(profile.email || "").trim().toLowerCase();
      const key = `prive-member:${email}`;
      const existing = await t.get(key);
      const member = {
        id: existing?.id || crypto.randomUUID(),
        name: profile.name,
        email,
        phone: profile.phone || "",
        marketingConsent: Boolean(profile.marketingConsent),
        termsVersion: profile.termsVersion,
        privacyVersion: profile.privacyVersion,
        termsAcceptedAt: existing?.termsAcceptedAt || now(),
        privacyAcceptedAt: existing?.privacyAcceptedAt || now(),
        marketingUpdatedAt: now(),
        status: "active",
        pointsBalance: Number(existing?.pointsBalance || 0),
        lifetimePoints: Number(existing?.lifetimePoints || 0),
        createdAt: existing?.createdAt || now(),
        updatedAt: now(),
      };
      await t.put(key, member);
      return { created: !existing, member };
    });
  }
  async awardPrivePoints(order) {
    return this.ctx.storage.transaction(async (t) => {
      const email = String(order?.customer?.email || "").trim().toLowerCase();
      if (!email) return { credited: false, reason: "missing-email" };
      const memberKey = `prive-member:${email}`;
      const member = await t.get(memberKey);
      if (!member || member.status !== "active")
        return { credited: false, reason: "not-enrolled" };
      const ledgerKey = `prive-ledger:${order.id}`;
      const existing = await t.get(ledgerKey);
      if (existing)
        return { credited: false, reason: "already-credited", entry: existing };
      const points = Math.max(0, Math.floor(Number(order.subtotal) || 0));
      if (!points) return { credited: false, reason: "no-eligible-value" };
      const entry = {
        id: crypto.randomUUID(),
        memberId: member.id,
        orderId: order.id,
        type: "purchase",
        points,
        eligibleValue: Number(order.subtotal) || 0,
        createdAt: now(),
      };
      await t.put(ledgerKey, entry);
      await t.put(memberKey, {
        ...member,
        pointsBalance: Number(member.pointsBalance || 0) + points,
        lifetimePoints: Number(member.lifetimePoints || 0) + points,
        updatedAt: now(),
      });
      return { credited: true, entry };
    });
  }
  async updateOrder(id, patch) {
    return this.ctx.storage.transaction(async (t) => {
      const key = `order:${id}`,
        o = await t.get(key);
      if (!o) return null;
      const next = { ...o, ...patch, updatedAt: now() };
      await t.put(key, next);
      return next;
    });
  }
  async updateFulfillment(id, status, patch = {}) {
    return this.ctx.storage.transaction(async (t) => {
      const key = `order:${id}`,
        o = await t.get(key);
      if (!o || o.status !== "paid")
        throw new Error("O pagamento ainda não foi confirmado.");
      const ranks = {
        confirmed: 0,
        preparing: 1,
        generated: 2,
        shipped: 3,
        posted: 3,
        delivered: 4,
      };
      if (o.fulfillmentStatus === "delivered" && status !== "delivered")
        return o;
      if (
        ranks[status] != null &&
        ranks[o.fulfillmentStatus] != null &&
        ranks[status] < ranks[o.fulfillmentStatus]
      )
        return o;
      const next = {
        ...o,
        ...patch,
        fulfillmentStatus: status,
        updatedAt: now(),
      };
      if (["shipped", "posted"].includes(status))
        next.postedAt = o.postedAt || patch.postedAt || now();
      if (status === "delivered")
        next.deliveredAt = o.deliveredAt || patch.deliveredAt || now();
      await t.put(key, next);
      return next;
    });
  }
  async finishPayment(id, status, extra = {}) {
    return this.ctx.storage.transaction(async (t) => {
      const key = `order:${id}`,
        o = await t.get(key);
      if (!o) return null;
      if (o.status === "paid") return o;
      const stock = (await t.get("inventory")) || seedInventory();
      if (status === "paid") {
        if (o.stockReleased) {
          for (const i of o.items)
            stock[i.id] = Number(stock[i.id] || 0) - i.quantity;
          await t.put("inventory", stock);
        }
        const next = {
          ...o,
          ...extra,
          status: "paid",
          stockReleased: false,
          stockAttention: o.items.some((i) => stock[i.id] < 0),
          fulfillmentStatus: o.fulfillmentStatus || "confirmed",
          paidAt: o.paidAt || now(),
          updatedAt: now(),
        };
        await t.put(key, next);
        return next;
      }
      if (!o.stockReleased) {
        for (const i of o.items)
          stock[i.id] = Number(stock[i.id] || 0) + i.quantity;
        await t.put("inventory", stock);
      }
      const next = {
        ...o,
        ...extra,
        status,
        stockReleased: true,
        updatedAt: now(),
      };
      await t.put(key, next);
      return next;
    });
  }
  async listOrders() {
    return [...(await this.ctx.storage.list({ prefix: "order:" })).values()];
  }
  async orderPage(limit = 50) {
    const cursor = await this.ctx.storage.get("maintenance-cursor");
    let entries = await this.ctx.storage.list({
      prefix: "order:",
      limit,
      ...(cursor ? { startAfter: cursor } : {}),
    });
    if (!entries.size && cursor)
      entries = await this.ctx.storage.list({ prefix: "order:", limit });
    await this.ctx.storage.put(
      "maintenance-cursor",
      entries.size === limit ? [...entries.keys()].at(-1) : "",
    );
    return [...entries.values()];
  }
  async findOrderByMelhorEnvioId(id) {
    if (!id) return null;
    return (
      (await this.listOrders()).find(
        (o) => String(o.melhorEnvioOrderId || "") === String(id),
      ) || null
    );
  }
  async getAuth(key) {
    return (await this.ctx.storage.get(`auth:${key}`)) || null;
  }
  async putAuth(key, value) {
    await this.ctx.storage.put(`auth:${key}`, value);
    return true;
  }
  async deleteAuth(key) {
    await this.ctx.storage.delete(`auth:${key}`);
    return true;
  }
  async consumeOAuthState(state) {
    return this.ctx.storage.transaction(async (t) => {
      const key = `auth:oauth-state:${state}`,
        s = await t.get(key);
      if (!s) return false;
      await t.delete(key);
      return (
        Date.now() - s.createdAt >= 0 &&
        Date.now() - s.createdAt <= 20 * 60 * 1000
      );
    });
  }
  async refreshMelhorEnvio(origin) {
    if (!this.refreshPromise)
      this.refreshPromise = (async () => {
        const rec = await this.getAuth("oauth-token");
        if (!rec?.refresh_token)
          throw new Error("Melhor Envio sem autorização.");
        if (Date.now() < rec.expires_at - 86400000) return rec;
        return saveTokens(
          this,
          await refreshTokens(this.env, rec.refresh_token, origin),
        );
      })().finally(() => {
        this.refreshPromise = null;
      });
    return this.refreshPromise;
  }
  async enqueueEmail(key, payload) {
    return this.ctx.storage.transaction(async (t) => {
      const k = `notify:${key}`,
        existing = await t.get(k);
      if (existing?.state === "sent") return existing;
      const queued = existing?.payload
        ? existing
        : { state: "pending", createdAt: now(), payload, attempts: 0 };
      await t.put(k, queued);
      return queued;
    });
  }
  async claimNotification(key) {
    return this.ctx.storage.transaction(async (t) => {
      const k = `notify:${key}`,
        found = await t.get(k);
      if (
        found?.state === "sent" ||
        (found?.state === "sending" &&
          Date.now() - Date.parse(found.claimedAt) < 120000)
      )
        return false;
      await t.put(k, {
        ...found,
        state: "sending",
        claimedAt: now(),
        attempts: Number(found?.attempts || 0) + 1,
      });
      return true;
    });
  }
  async completeNotification(key, meta = {}) {
    await this.ctx.storage.put(`notify:${key}`, {
      state: "sent",
      sentAt: now(),
      ...meta,
    });
    return true;
  }
  async releaseNotificationClaim(key, error = "") {
    return this.ctx.storage.transaction(async (t) => {
      const k = `notify:${key}`,
        found = await t.get(k);
      if (found?.state !== "sent")
        await t.put(k, {
          ...found,
          state: "pending",
          lastError: String(error).slice(0, 240),
          nextAttemptAt:
            Date.now() +
            Math.min(3600000, 60000 * 2 ** Math.min(found?.attempts || 0, 6)),
        });
      return true;
    });
  }
  async pendingEmails(limit = 10) {
    const all = await this.ctx.storage.list({ prefix: "notify:" });
    return [...all]
      .filter(
        ([, v]) =>
          v.payload &&
          v.state !== "sent" &&
          (v.nextAttemptAt || 0) <= Date.now(),
      )
      .slice(0, limit)
      .map(([k, v]) => ({ key: k.slice(7), ...v }));
  }
  async orderNotifications(id) {
    const rows = await this.ctx.storage.list({ prefix: `notify:${id}:` });
    return [...rows].map(([key, v]) => ({
      key: key.slice(7),
      state: v.state,
      attempts: v.attempts || 0,
      lastError: v.lastError || null,
      sentAt: v.sentAt || null,
    }));
  }
}
export function storeStub(env) {
  return env.AMEVURI_STORE.getByName("global");
}
