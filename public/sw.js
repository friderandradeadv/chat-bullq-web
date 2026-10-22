// Service worker mínimo do Hub (BullQ).
// Objetivo: tornar o app INSTALÁVEL (PWA) e receber Web Push.
// NÃO faz cache do app — o conteúdo é autenticado/dinâmico, então cachear
// serviria página velha ou de outra sessão.
// SEM handler de 'fetch' (22/10/2026): o passthrough vazio interceptava todo
// pedido e, no atalho da tela de início do iPhone, o JS do app nunca rodava
// (tela "carregando" com código sem-js), enquanto no Chrome abria normal. O
// Chrome já não exige handler de fetch para instalar; o push não depende dele.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// ── Web Push ──────────────────────────────────────────────────────────
// Recebe o payload JSON do backend e mostra a notificação nativa.
self.addEventListener('push', (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch {
    p = { title: 'Hub | Frider Andrade', body: event.data ? event.data.text() : '' };
  }
  const title = p.title || 'Hub | Frider Andrade';
  const options = {
    body: p.body || '',
    icon: '/icon-192.png?v=4',
    badge: '/icon-192.png?v=4',
    tag: p.tag || undefined,
    renotify: !!p.tag,
    data: p.data || {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Ao clicar: foca uma aba existente (navegando pro alvo) ou abre uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const url =
    d.url ||
    (d.conversationId ? `/inbox?conversationId=${d.conversationId}` : null) ||
    (d.caseId ? `/processos/${d.caseId}` : null) ||
    '/inicio';
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of wins) {
        if ('focus' in c) {
          try {
            await c.navigate(url);
          } catch {
            /* navigate pode falhar em cross-origin; foca mesmo assim */
          }
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
