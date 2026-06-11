# PROGRESSO — Chat BullQ (alinhamento com LíderHub)

> Documento de continuidade entre sessões/máquinas. A **fonte da verdade é este
> repositório no GitHub**, não nenhuma pasta local.
>
> **Branch de trabalho:** `claude/modest-brahmagupta-7wywda`

## 🎯 Objetivo

Deixar o painel do **Chat BullQ** visual e funcionalmente parecido com o
**LíderHub** (`chat.liderhub.ai`), mantendo a marca Chat BullQ.

## 🏗️ Arquitetura

- **Frontend:** Next.js 16 (App Router) + Tailwind v4 + TypeScript.
  Produção: `https://chat.friderandrade.com.br`
- **Backend:** API própria (NestJS) em `https://api.friderandrade.com.br/api/v1`
  (repositório separado: `chat-bullq-api`).
- **Deploy:** Coolify (VPS Hostgator). Faz deploy do branch **`main`** deste
  repositório, via **Dockerfile** (`yarn install --frozen-lockfile`).
  **Para publicar:** merge na `main` + redeploy no Coolify.

## ✅ Feito

1. **Sidebar agrupado** estilo LíderHub — `src/components/layout/app-sidebar.tsx`
   - Dashboard, Conexões
   - **Atendimento:** Conversas, Contatos, Kanban
   - **Automações:** Agentes, Base de Conhecimento, Vozes, Chatbot, Automações, Integrações
   - Tarefas, Configurações
2. **Páginas novas:**
   - `/conexoes` (reaproveita a gestão de canais existente)
   - `/base-conhecimento`, `/vozes`, `/tarefas` (placeholders "em breve")
   - `/settings/integrations` (+ aba em Configurações)
3. **Barra superior** (desktop) — `src/components/layout/top-bar.tsx`
   - Busca global com **paleta de comandos (⌘K)** que filtra e navega entre páginas
   - Sino de **notificações** (popover, placeholder por enquanto)

## 🔜 A fazer (sugestões)

- **Dashboard de métricas** estilo LíderHub: cards de status (Nova Conversa,
  Análise, Qualificado, Proposta, Sucesso, Perdas) + gráfico de evolução temporal.
- **Redesign do login** no formato LíderHub (card centralizado, mostrar/ocultar
  senha, "Esqueceu sua senha?", rodapé) — mantendo a marca Chat BullQ.
- **Conteúdo real** para Base de Conhecimento, Vozes e Tarefas.
- (Opcional) Avaliar mover o seletor de organização para a barra superior,
  como no LíderHub.

## 🔎 Descobertas importantes

- A versão que rodava na VPS já tinha o sidebar avançado, mas esse código
  **nunca foi versionado** (build feito direto, fonte perdida). Foi
  **reconstruído** a partir de screenshots da VPS e do LíderHub.
- O Coolify faz deploy do branch **`main`**. As melhorias estão no branch
  `claude/modest-brahmagupta-7wywda`. Ao fazer **merge + redeploy**, a produção
  finalmente fica alinhada com o código-fonte.
- O build de produção usa **`yarn` com `--frozen-lockfile`**. Não adicione
  dependências sem atualizar o `yarn.lock`, senão o build do Coolify quebra.

## ▶️ Como continuar (qualquer máquina ou conta)

- **Via claude.ai/code (recomendado):** abrir o repositório
  `friderandradeadv/chat-bullq-web` no branch `claude/modest-brahmagupta-7wywda`.
  Não precisa de nada local — tudo roda na nuvem e sincroniza pelo GitHub.
- **Localmente (opcional, para rodar/testar):**
  ```bash
  git clone https://github.com/friderandradeadv/chat-bullq-web.git
  cd chat-bullq-web
  git checkout claude/modest-brahmagupta-7wywda
  yarn install
  yarn dev
  ```
  Sempre faça `git pull` antes de começar e `git push` ao terminar.

## ⚠️ Segurança

- Este repositório é **público**: **nunca** commite senhas, tokens ou arquivos
  `.env`. Configure segredos como variáveis de ambiente no Coolify.
