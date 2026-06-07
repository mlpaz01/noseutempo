/* ============================================================
   NoSeuTempo — payment.js (Checkout Pro + conta do aluno)
   ------------------------------------------------------------
   Exige estar logado. Cria o pagamento ligado à conta e
   redireciona para a tela segura do Mercado Pago.
   ============================================================ */
(function () {
  "use strict";

  const PLANOS = {
    mensal:    { name: "Mensal",    price: "R$ 39/mês" },
    anual:     { name: "Anual",     price: "R$ 297" },
    vitalicio: { name: "Vitalício", price: "R$ 597" },
  };

  document.addEventListener("DOMContentLoaded", async function () {
    const btn = document.getElementById("btn-pagar");
    if (!btn) return;

    const plano = new URLSearchParams(location.search).get("plano") || "anual";
    if (PLANOS[plano]) {
      const n = document.getElementById("plan-name");
      const p = document.getElementById("plan-price");
      if (n) n.textContent = PLANOS[plano].name;
      if (p) p.textContent = PLANOS[plano].price;
    }

    // Precisa estar logado — senão manda criar conta (guardando o plano)
    const me = await NST.me();
    if (!me) { location.href = "cadastro.html?plano=" + plano; return; }

    // Se já pagou, vai direto pra plataforma
    if (me.paid) { location.href = "plataforma.html"; return; }

    // Mostra o nome do aluno e libera a tela
    const ola = document.getElementById("ola-aluno");
    if (ola) ola.textContent = "Olá, " + me.nome + "! Falta só o pagamento. 💙";

    if (new URLSearchParams(location.search).get("status") === "falhou") {
      const aviso = document.getElementById("aviso-falha");
      if (aviso) aviso.classList.remove("hidden");
    }

    btn.addEventListener("click", async function () {
      btn.disabled = true;
      btn.textContent = "Abrindo pagamento seguro…";
      try {
        const r = await NST.api("/api/criar-pagamento", {
          method: "POST",
          body: JSON.stringify({ plano: plano }),
        });
        const data = await r.json();
        if (data.init_point) {
          window.location.href = data.init_point;
        } else {
          throw new Error(data.error || "sem init_point");
        }
      } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.textContent = "Pagar com Mercado Pago";
        const aviso = document.getElementById("aviso-falha");
        if (aviso) {
          aviso.textContent = "Não conseguimos abrir o pagamento agora. Tente novamente em instantes. 💙";
          aviso.classList.remove("hidden");
        }
      }
    });
  });
})();
