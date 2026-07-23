# Agente local de impressão — FlowDeskIA

Este programa roda no computador onde a impressora térmica está ligada
**por USB**. Ele busca os cupons de pedido gerados pelo FlowDeskIA e manda
imprimir na impressora local, sem precisar de IP de rede.

## Pré-requisitos

1. **Node.js 20 ou mais novo** instalado no computador
   ([nodejs.org](https://nodejs.org)).
2. A impressora **já instalada normalmente no sistema operacional** (com o
   driver do fabricante), aparecendo em "Impressoras e scanners"
   (Windows) ou "Impressoras e Scanners" (macOS).
3. **No Windows**, a impressora precisa estar **compartilhada**:
   Painel de Controle → Dispositivos e Impressoras → botão direito na
   impressora → Propriedades da impressora → aba Compartilhamento →
   marcar "Compartilhar esta impressora" (anote o nome do compartilhamento).
4. Um **código de pareamento**, gerado no painel do FlowDeskIA em
   *Pedidos → Impressão automática → USB (agente local) → Gerar código de
   pareamento*.

## Instalação

1. Copie esta pasta (`print-agent`) para o computador da impressora.
2. Copie `.env.example` para `.env` e preencha:
   - `FLOWDESK_API_BASE_URL`: endereço do backend do FlowDeskIA.
   - `FLOWDESK_BUSINESS_ID`: ID do negócio (aparece na URL do painel).
   - `FLOWDESK_AGENT_TOKEN`: o código de pareamento gerado no painel.
3. Abra um terminal nesta pasta e rode:
   ```
   npm start
   ```

O terminal precisa ficar aberto enquanto o agente estiver rodando — feche
para parar de imprimir automaticamente. Para rodar em segundo plano de
forma permanente, use uma ferramenta como o
[pm2](https://pm2.keymetrics.io/) ou o Agendador de Tarefas do Windows.

## Escolhendo a impressora

Ao iniciar, o agente detecta as impressoras instaladas no sistema e as
reporta para o painel. Volte ao painel (Pedidos → Impressão automática) e
selecione a impressora correta na lista — a partir daí, os cupons chegam
já indicando essa impressora. Se preferir, também é possível fixar a
impressora direto no `.env` com `FLOWDESK_PRINTER_NAME`.

## Solução de problemas

- **"Nenhuma impressora detectada"**: confirme que a impressora aparece
  nas impressoras do sistema operacional antes de rodar o agente.
- **Erro ao imprimir no Windows**: confira se a impressora está
  compartilhada (passo 3 acima) e se o nome usado é o nome do
  compartilhamento, não o nome de exibição.
- **Agente aparece como "Offline" no painel**: verifique se o terminal
  com `npm start` continua aberto e se o computador tem acesso à
  internet.
