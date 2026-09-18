// Never retry a payment POST automatically: its result may be uncertain.
export async function providerFetch(url, options = {}, timeoutMs = 12000) {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    const error = new Error(
      "O serviço demorou para responder. Tente novamente em instantes.",
    );
    error.code = "PROVIDER_UNAVAILABLE";
    error.status = 503;
    error.cause = cause;
    throw error;
  }
}
export function safeHttpsUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(String(value));
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
