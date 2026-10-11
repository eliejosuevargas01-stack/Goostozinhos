# Visão geral

## Problema

A Goostozinhos envia cartas físicas com QR Code para clientes. Sem um destino digital à altura, esse carinho se perdia: formulário genérico quebra a sensação de presente e gera abandono no celular.

## Solução

Uma landing mobile-first em 3 passos com raspadinha digital dourada:

1. Cliente declara o @ do Instagram e confirma que segue a confeitaria.
2. Cliente declara que avaliou o pedido no Pedidos10.
3. Cliente informa nome e WhatsApp, e raspa o cartão para revelar o cupom.

O cupom chega na tela e por WhatsApp, enviado pela automação. A loja importa o estoque de cupons por webhook protegido.

## Resultado

- Jornada curta: uma pergunta por tela, botão principal sempre visível, progresso em 0/33/66/100%.
- Momento memorável: raspadinha tátil com botão alternativo acessível.
- Operação segura: um cupom por cliente, idempotência por telefone, testes automatizados de contrato e concorrência.
- Documentação verificável: cada afirmação técnica desta doc reflete o código em `public/` e os fluxos exportados em `workflows/`.

## Para quem é esta documentação

- **Operação da loja:** importe cupons e acompanhe resgates ([Operação](07-operacao.md)).
- **Manutenção técnica:** entenda fluxos, API e dados ([Arquitetura](03-arquitetura.md), [Referência de API](05-referencia-api.md), [Modelo de dados](06-modelo-de-dados.md)).
- **Avaliação do case:** veja decisões e qualidade ([Decisões técnicas](09-decisoes-tecnicas.md), [Qualidade e segurança](08-qualidade-seguranca.md)).
