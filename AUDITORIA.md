# Auditoria AMEVURI v5.4

## Resultado e limite da entrega

O pacote original continha 93 arquivos. Foram revisados os arquivos de aplicação, páginas, estilos, configurações, documentação e recursos visuais. As correções estão no novo ZIP; o original foi preservado. O inventário relaciona cada arquivo recebido e seu hash, permitindo identificar alterações.

A revisão corrige os problemas identificados e inclui testes reproduzíveis. Não é uma garantia de ausência de qualquer defeito nem de funcionamento das contas em produção. O pacote não continha credenciais válidas. Não foram feitas cobranças, postagens, mensagens reais, publicação no GitHub ou implantação no Cloudflare.

## Conteúdo e loja

| Problema | Correção |
| --- | --- |
| Velas anunciadas como 120g | Nomes, tamanhos, textos e catálogo passam a 130g |
| Wax Melts anunciados como 60g | Nomes, tamanhos, textos e catálogo passam a 80g |
| CEP de origem e informação técnica no checkout | Conteúdo removido da interface e origem omitida da resposta de cotação |
| Travessões e hífens em textos | Textos revisados, incluindo rótulos, legendas, emails e contatos. Identificadores, URLs e sintaxe técnica preservados |
| Promessa de PIX, parcelamento e retorno automático | Texto informa opções disponibilizadas pela SumUp e botão de retorno após o pagamento |
| Estoque inicial apresentado como disponibilidade real | Interface usa estoque consultado; textos fixos de estoque inicial removidos |
| Formato selecionado sem atualizar fotografia | Imagem, legenda, tamanho, preço e disponibilidade acompanham a seleção |
| Difusor na galeria de três formatos à venda | Retirada a apresentação individual do difusor nessa galeria |
| Declaração específica WELLMOTION e teste do fornecedor sem documento no pacote | Substituída por descrição sensorial sem essa comprovação atribuída |
| Wax Melts descritos universalmente como sem chama | Texto orienta uso em aquecedor apropriado, conforme o aparelho |
| Orientações de fim da vela e limpeza | Reserva de aproximadamente 1,3cm, observando limite maior no rótulo; retirada a instrução universal de colocar o recipiente no freezer |
| Página recebida implicava pagamento já aprovado | Preparação condicionada à aprovação |
| Sacola fechada com elementos fora da tela | Painéis fechados ocultos e área visual contida |
| Conteúdo salvo no navegador usado como HTML | Seleção validada e texto escapado |

A orientação de interrupção da queima foi conferida na [National Candle Association](https://candles.org/candle-safety-tips/). Informações de formulação, fabricação, notas olfativas e testes próprios da marca não podem ser certificadas apenas pelo código. Pesos líquidos vieram da instrução do usuário; preços, saldo inicial e medidas brutas foram herdados do pacote.

## Melhor Envio

O cálculo enviava o valor segurado multiplicado pela quantidade. A API já multiplica o valor unitário pela quantidade, de modo que havia duplicação desse fator. O envio foi corrigido para valor unitário. [Contrato de cotação](https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos).

Também foram corrigidos: seleção baseada no nome dos Correios que excluía outras transportadoras; tratamento de preços vazios e respostas inesperadas; ausência do escopo de rastreio; renovação concorrente do token; consumo não atômico do estado OAuth; diagnóstico que considerava HTTP 404 como pronto; prazo sem indicar que conta após postagem; resposta de cotação antiga após mudança do CEP.

A verificação de disponibilidade usa o endpoint documentado de [transportadoras](https://docs.melhorenvio.com.br/reference/listar-transportadoras). A compra confere novamente o frete e recusa continuar se o preço mudou. Os [escopos OAuth](https://docs.melhorenvio.com.br/reference/fluxo-de-autoriza%C3%A7%C3%A3o) agora incluem rastreamento.

## SumUp e estoque

Cada tentativa tem identificador persistido no navegador. A reserva e a criação do registro do pedido ocorrem juntas, de forma transacional. Repetições não criam outra reserva. Se a resposta da criação do pagamento se perder, o servidor consulta a referência existente antes de devolver o link.

A confirmação confere referência, checkout, valor, BRL e recebedor. A devolução de estoque na expiração é atômica e ocorre uma vez. Pagamentos confirmados não regridem com uma notificação atrasada. Uma tentativa recusada não libera o estoque enquanto o checkout ainda puder ser pago. Pagamento tardio após devolução de unidades gera sinalização para conferência do estoque.

Foi corrigido o uso de resposta HTTP 204 com corpo. A consulta pública de confirmação retorna apenas identificador e estado; detalhes do acompanhamento exigem o email da compra. O cadastro valida CPF, CEP, telefone, UF, quantidades e produtos duplicados. As APIs usam preços do servidor.

As decisões de confirmação e recuperação usam os contratos de [checkouts da SumUp](https://developer.sumup.com/api/checkouts), não os valores enviados pelo navegador.

## Resend, rastreio e administração

Emails ficam em fila persistente com conteúdo estável, controle de envio concorrente, tentativas posteriores e chave de idempotência. Falhas aparecem na gestão do pedido. Um reenvio de mensagem ainda pendente reaproveita a mesma tarefa. O domínio e a aceitação real ainda precisam ser verificados no Resend.

A rotina de manutenção percorre os pedidos em lotes, superando o problema de consultar sempre os primeiros cem. Entregas concluídas não regridem por evento atrasado. Links de rastreio aceitam HTTPS. O painel exige a chave privada, impede confirmação de compra não paga e recusa pedido de email de rastreio sem rastreio cadastrado.

## AMEVURI Privé

A página `/prive` apresenta funcionamento, benefícios, conversão, validade e
regulamento resumido. O formulário valida nome, email, telefone opcional e os
aceites obrigatórios, separando o consentimento opcional para comunicações.
Cadastros repetidos atualizam o mesmo membro pelo email, sem zerar o saldo.

Após a confirmação do pagamento, o programa credita um ponto por real inteiro
do subtotal dos produtos. Frete não pontua. Cada pedido possui um único registro
de pontuação, impedindo crédito duplicado em callbacks ou consultas repetidas.
O aceite do regulamento e da política é armazenado com data e versão. O primeiro
cadastro recebe email de boas vindas quando o Resend está configurado.

## Verificações realizadas

1. 26 testes automatizados aprovados com armazenamento e provedores simulados, exercitando o código de aplicação e o AMEVURI Privé.
2. 79 arquivos públicos e 494 referências verificadas, incluindo JavaScript embutido, JSON das páginas, pesos, textos e consistência entre catálogo do navegador e do servidor.
3. 52 imagens raster decodificadas, dois SVGs e sitemap analisados como XML.
4. Compilação do Worker com o executável esbuild concluída, bundle final de aproximadamente 60,2KB.
5. Navegador: catálogo, inclusão na sacola, cotação simulada, total, invalidação por troca de CEP, seleção de Wax Melts com imagem e preço, checkout em celular e navegação do quiz.
6. Código formatado para leitura e manutenção. Arquivo de dependências incluído.

A execução integral de `wrangler deploy --dry-run` foi impedida por `spawn EPERM`, restrição do ambiente ao iniciar subprocessos. O bundle foi gerado diretamente com esbuild. O teste local não executa o Durable Object em infraestrutura Cloudflare real. A implantação e os testes com contas reais continuam pendentes.

## Antes de abrir vendas

Valide credenciais e recebedor SumUp, autorização Melhor Envio com os novos escopos, domínio remetente e entrega Resend, URL definitiva, callbacks e webhooks. Confirme estoque físico, peso bruto e dimensões das embalagens. A vinculação da etiqueta permanece uma tarefa administrativa. O guia `CLOUDFLARE_SETUP.md` detalha os passos.

O arquivo TESTES.txt inclui falhas provocadas deliberadamente para verificar as proteções. Essas linhas de log fazem parte dos cenários negativos; o resultado final foi 26 de 26 testes aprovados.
