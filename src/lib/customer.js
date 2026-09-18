import { cleanDigits } from "./http.js";
export function validCpf(value) {
  const n = cleanDigits(value);
  if (!/^\d{11}$/.test(n) || /^(\d)\1{10}$/.test(n)) return false;
  for (let size = 9; size <= 10; size++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(n[i]) * (size + 1 - i);
    if (Number(n[size]) !== ((sum * 10) % 11) % 10) return false;
  }
  return true;
}
export function validateCustomer(c) {
  if (!c || typeof c !== "object" || Array.isArray(c))
    throw new Error("Informe os dados de entrega.");
  const labels = {
    name: "nome completo",
    email: "email",
    phone: "telefone",
    cpf: "CPF",
    postalCode: "CEP",
    street: "rua",
    number: "número",
    neighborhood: "bairro",
    city: "cidade",
    state: "UF",
  };
  const out = {};
  for (const [key, label] of Object.entries(labels)) {
    if (typeof c[key] !== "string" || !c[key].trim() || c[key].length > 220)
      throw new Error(`Preencha ${label} corretamente.`);
    out[key] = c[key].trim();
  }
  out.email = out.email.toLowerCase();
  out.state = out.state.toUpperCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))
    throw new Error("Informe um email válido.");
  for (const key of ["phone", "cpf", "postalCode"])
    out[key] = cleanDigits(out[key]);
  if (out.postalCode.length !== 8) throw new Error("Informe um CEP válido.");
  if (!validCpf(out.cpf)) throw new Error("Informe um CPF válido.");
  if (!/^\d{10,11}$/.test(out.phone))
    throw new Error("Informe um telefone válido com DDD.");
  if (
    !"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
      .split(" ")
      .includes(out.state)
  )
    throw new Error("Informe uma UF válida.");
  out.complement =
    typeof c.complement === "string" ? c.complement.trim().slice(0, 220) : "";
  return out;
}
