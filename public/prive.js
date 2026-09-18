(() => {
  const form = document.querySelector("[data-prive-form]");
  if (!form) return;
  const message = form.querySelector("[data-prive-message]");
  const submit = form.querySelector("[data-prive-submit]");
  const setMessage = (text, state = "") => {
    message.textContent = text;
    message.dataset.state = state;
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    setMessage("Confirmando seu cadastro…", "loading");
    const data = Object.fromEntries(new FormData(form).entries());
    const body = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      acceptTerms: data.acceptTerms === "on",
      acceptPrivacy: data.acceptPrivacy === "on",
      marketingConsent: data.marketingConsent === "on",
    };
    try {
      const response = await fetch("/api/prive/register", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Não foi possível concluir o cadastro.");
      if (result.created) {
        form.reset();
        setMessage("Seu cadastro no AMEVURI Privé foi confirmado. Enviamos uma mensagem de boas vindas para o seu email.", "success");
      } else {
        setMessage("Seu cadastro AMEVURI Privé já existia e seus dados foram atualizados.", "success");
      }
    } catch (error) {
      setMessage(error.message || "Não foi possível concluir o cadastro agora. Tente novamente.", "error");
    } finally {
      submit.disabled = false;
    }
  });
})();
