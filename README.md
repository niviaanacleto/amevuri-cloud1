# AMEVURI v5.4.0

Esta versão adiciona a página `/prive`, cadastro funcional do programa
AMEVURI Privé, registro versionado de consentimentos e crédito automático de
pontos após a confirmação de compras elegíveis. O cálculo considera somente o
subtotal dos produtos e exclui o frete.

Loja em Cloudflare Workers com catálogo corrigido: velas aromáticas de **130g** e Wax Melts de **80g**. Home Parfum permanece com 250ml e os preços recebidos foram preservados.

## Executar e verificar

Use Node.js 22 ou superior e instale as versões do arquivo de dependências:

```sh
npm ci
npm run check
npm test
npm run dev
```

O comando `check` verifica referências locais, sintaxe de JavaScript externo e embutido, JSON das páginas, consistência dos dois catálogos, pesos, textos e configuração. Os testes de integração usam serviços simulados, sem compras nem emails reais.

O servidor `scripts/preview-test.mjs` é exclusivo para testes locais com respostas simuladas. Ele não deve ser usado em produção.

## Publicação

As páginas são servidas por Static Assets. O Worker recebe primeiro as rotas `/api/*` e os aliases legados `/.netlify/functions/*`. A política de URLs é `drop-trailing-slash`. Não é necessário criar regras que acrescentem ou removam `.html`.

No Cloudflare Workers Builds, use Node.js 22, `npm run check && npm test` como comando de build e `npx wrangler deploy` como comando de publicação. Consulte `CLOUDFLARE_SETUP.md` para as credenciais.

## Operação

1. O cliente escolhe produtos e consulta o frete.
2. O servidor valida cadastro, estoque, preços e a cotação atual antes de reservar o pedido.
3. A SumUp recebe o pagamento em sua página hospedada.
4. A confirmação consultada na API atualiza o pedido e solicita as mensagens pelo Resend.
5. A administração vincula a etiqueta do Melhor Envio em `/admin-pedidos`.
6. O webhook e a rotina a cada cinco minutos acompanham pagamentos, rastreio e mensagens pendentes. Os pedidos são percorridos em lotes.

A integração não compra ou imprime etiquetas automaticamente. A vinculação da etiqueta e a postagem continuam sendo etapas operacionais da loja.

## Compatibilidade

Os identificadores internos com sufixos `120` e `60` foram preservados para manter estoque e sacolas existentes. São chaves históricas, não pesos de venda. Nomes, tamanhos e textos públicos usam 130g e 80g. Pedidos anteriores não são reescritos.

Veja `AUDITORIA.md`, `INVENTARIO_AUDITORIA.json` e `TESTES.txt` para o escopo e as evidências. Esta entrega não publica alterações no GitHub ou Cloudflare.
