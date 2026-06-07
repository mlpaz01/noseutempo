/* ============================================================
   NoSeuTempo — config.js
   Endereço do backend de pagamento. Se um dia mudar o domínio
   da API, troque só aqui.
   ============================================================ */
window.NST_API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? location.origin
  : "https://api.noseutempo.app";
