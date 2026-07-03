// Service worker mínimo do Hub (BullQ).
// Objetivo: tornar o app INSTALÁVEL (PWA) e servir de base para push no futuro.
// NÃO faz cache do app — o conteúdo é autenticado/dinâmico, então cachear
// serviria página velha ou de outra sessão. O handler de 'fetch' existe só
// porque o Chrome exige um para considerar o app instalável; ele apenas repassa.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  /* passthrough — sem cache (necessário para instalabilidade) */
});
