# Configuração da AMEVURI v5.4

## Cloudflare

Mantenha o nome do Worker e a associação ao Durable Object existente. Não exclua o armazenamento, não reinicie a migração `v1` e não troque o nome `global` do objeto. Isso preserva os pedidos e o estoque já gravados.

Use Node.js 22 ou superior, instale com `npm ci` e execute `npm run check` e `npm test`. O arquivo `package-lock.json` fixa as dependências usadas nesta revisão. A publicação normal usa `npx wrangler deploy`.

## Variáveis protegidas

| Variável | Finalidade |
| --- | --- |
| SUMUP_API_KEY | Chave da conta SumUp com acesso aos checkouts |
| SUMUP_MERCHANT_CODE | Identificador do recebedor correto |
| MELHOR_ENVIO_CLIENT_SECRET | Segredo do aplicativo Melhor Envio |
| AMEVURI_SETUP_KEY | Chave forte de acesso à administração e à conexão OAuth |
| RESEND_API_KEY | Chave de envio do Resend |
| AMEVURI_EMAIL_FROM | Remetente em domínio verificado no Resend |
| AMEVURI_SITE_URL | URL HTTPS definitiva da loja, sem barra final |
| MELHOR_ENVIO_REDIRECT_URI | URL exata do retorno OAuth cadastrado no Melhor Envio |
| AMEVURI_REPLY_TO | Endereço opcional para respostas |
| AMEVURI_ORDER_EMAIL | Destino opcional das notificações internas de compra |

O exemplo `.dev.vars.example` contém nomes e valores ilustrativos. Não coloque credenciais em `public/`, no GitHub ou no ZIP de distribuição.

## Melhor Envio

O pacote preserva `MELHOR_ENVIO_CLIENT_ID=29241`, ambiente `production`, CEP de origem `24358080` e o User Agent da AMEVURI. Confira se esses valores correspondem à conta e à operação reais.

Configure o retorno como `https://SEU-DOMINIO/api/melhor-envio/oauth-callback` tanto na variável quanto no aplicativo. Abra `/melhor-envio-conectar` e autorize com a chave privada. A nova autorização solicita `shipping-calculate`, `shipping-companies` e `shipping-tracking`. Tokens antigos podem precisar de nova autorização para conceder rastreamento.

A variável opcional `MELHOR_ENVIO_TOKEN` aceita token manual e tem prioridade sobre OAuth. Nesse modo, sua renovação é responsabilidade da operação. Para renovação automática, use o fluxo OAuth sem essa variável.

Cadastre `https://SEU-DOMINIO/api/melhor-envio/webhook`. A verificação usa HMAC SHA256 com o segredo do aplicativo. O Melhor Envio limita seus webhooks às etiquetas do próprio aplicativo; etiquetas criadas por outro fluxo exigem conferir a disponibilidade do rastreio consultado pela API. [Documentação de webhooks](https://docs.melhorenvio.com.br/docs/webhooks).

A administração deve associar o ID correto da etiqueta ao pedido. Não há compra, geração ou impressão automática de etiquetas nesta versão.

## SumUp

A conta precisa estar habilitada para receber pagamentos online no Brasil. A criação usa BRL, o valor validado no servidor, `hosted_checkout.enabled`, callback em `/api/sumup/webhook` e retorno em `/pedido-recebido`.

As formas de pagamento dependem da habilitação da conta e da compra. O botão de volta para a loja aparece na página de sucesso quando há `redirect_url`; não é prometido retorno automático. [Hosted Checkout](https://developer.sumup.com/online-payments/checkouts/hosted-checkout).

Confirme a operação com credenciais de teste e, antes da abertura ao público, com uma compra controlada autorizada pelo responsável. Esta revisão não realizou cobranças reais.

## Resend

Verifique o domínio do remetente, os registros DNS exigidos e as restrições da chave. A existência das variáveis não comprova entrega. Confira aceitação, entrega, rejeição e spam em uma caixa de teste autorizada.

Falhas de envio ficam em uma fila persistente e aparecem na gestão do pedido. A rotina tenta novamente. As mensagens usam chave de idempotência e conteúdo persistido para reduzir duplicações. A deduplicação do provedor tem janela de 24 horas; após falhas prolongadas, confira o painel do Resend antes de um reenvio manual. [Idempotência do Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Medidas e estoque

Os 130g e 80g são pesos líquidos. O frete usa peso bruto e dimensões da embalagem. Foram preservados os cadastros recebidos: vela 0,33kg e 10 × 10 × 10cm; Wax Melts 0,10kg e 10 × 5 × 10cm; Home Parfum 0,30kg e 8 × 5 × 21,5cm. É necessário pesar e medir os produtos prontos para envio para confirmar esses valores.

O estoque inicial recebido continua sendo 10 unidades por identificador, aplicado apenas quando ainda não existe estoque armazenado. Confira o saldo físico antes de abrir as vendas.

## Verificação após publicação

Confira `/api/health` com release `5.4.0`; abra as páginas com e sem `.html`; teste o cadastro em `/prive`; consulte uma cotação para um CEP atendido; finalize um pagamento autorizado; confira o pedido, a pontuação Privé e os emails; vincule a etiqueta correta e acompanhe o rastreio. O ZIP e os testes simulados não substituem essa verificação das contas reais.
