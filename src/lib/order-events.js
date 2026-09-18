import { notifyOrder, notifyAdminPaid } from "../providers/email.js";
export async function markPaid(env, store, origin, order, extra = {}) {
  if (!order) return null;
  const updated = await store.finishPayment(order.id, "paid", extra);
  const cur = updated || order;
  await store
    .awardPrivePoints(cur)
    .catch((error) => console.error("AMEVURI Privé", error.message));
  await Promise.allSettled([
    notifyOrder(env, store, origin, cur, "payment_confirmed"),
    notifyAdminPaid(env, store, origin, cur),
  ]);
  return cur;
}
export async function setFulfillment(
  env,
  store,
  origin,
  order,
  status,
  patch = {},
) {
  if (!order) return null;
  if (order.status !== "paid")
    throw new Error("O pagamento ainda não foi confirmado.");
  const updated = await store.updateFulfillment(order.id, status, patch);
  if (!updated) return null;
  status = updated.fulfillmentStatus;
  if (status === "preparing")
    await notifyOrder(env, store, origin, updated, "preparing").catch(() => {});
  if (
    ["shipped", "posted"].includes(status) &&
    (updated.trackingCode || updated.trackingUrl)
  )
    await notifyOrder(env, store, origin, updated, "shipped").catch(() => {});
  if (status === "delivered")
    await notifyOrder(env, store, origin, updated, "delivered").catch(() => {});
  if (["undelivered", "paused", "suspended", "delivery_issue"].includes(status))
    await notifyOrder(env, store, origin, updated, "delivery_issue").catch(
      () => {},
    );
  if (status === "cancelled")
    await notifyOrder(env, store, origin, updated, "cancelled").catch(() => {});
  return updated;
}
