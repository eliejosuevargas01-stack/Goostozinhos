# Modelo de dados

Duas tabelas nativas da automação. Nomes de coluna exatamente como o fluxo usa.

## Tabela `cupons`

Um cupom por linha. A campanha ativa usa a primeira linha com estado `novo`.

| Coluna | Tipo | Papel |
|---|---|---|
| `campaignId` | texto | Campanha dona do cupom (ex.: campanha atual). |
| `code` | texto | Código em maiúsculas `A-Z0-9-`, 3–50 caracteres. |
| `status` | texto | `novo` na importação; o resgate lê por esse estado. |
| `discount_value` | texto | Desconto `NN%` exibido na tela. |
| `expiration_date` | texto | Validade `AAAA-MM-DD`, até 23h59 de Brasília. |
| `min_order_value` | texto | Pedido mínimo `NN.NN` exibido na tela. |
| `valid` | booleano | `true` na importação. |
| `disponivel` | booleano | `false` desliga o cupom sem consumi-lo; ausente na importação vale `true`. |
| `allocatedTo` | texto | Telefone contemplado (preenchido pelo fluxo em cenários de alocação). [verificar: coluna existe no esquema; preenchimento pelo resgate atual não confirmado] |
| `deliveredAt` | texto | Data/hora de entrega (cenários de alocação). [verificar: idem] |

Regras:

- Código e campanha passam por consulta de duplicata e ocupação antes de inserir.
- Desconto e pedido mínimo fora do formato não quebram a resposta: a tela apenas omite o campo.
- Data ausente ou malformada conta como vencida na decisão.

## Tabela `clientes`

Um cliente por linha, chaveado por campanha + telefone.

| Coluna | Tipo | Papel |
|---|---|---|
| `campaignId` | texto | Campanha do resgate. |
| `phoneNumber` | texto | WhatsApp normalizado `55DDDNÚMERO`. |
| `name` | texto | Nome informado, 2–80 caracteres. |
| `handleIg` | texto | @ como informado (com ou sem `@` aceito, salvo sem o prefixo), sem validação. |
| `status` | texto | `com_cupom` no registro criado pelo resgate; demais estados conforme operação. [verificar: valores `sem_cupom`/`entregue` aparecem em simulações, não confirmados no fluxo atual] |
| `couponCode` | texto | Código atribuído. |
| `deliveredAt` | texto | Carimbo de entrega. |
| `mensagemEnviada` | booleano, nunca nulo | `false` no registro; `true` após reivindicar o envio. Revertida para `false` se o WhatsApp falhar. |

## Estados de um resgate

| Estado | HTTP | Quando acontece | Próximo estado possível |
|---|---|---|---|
| `entregue` | 200 | Telefone novo, cupom ativo e WhatsApp enviado | — |
| `pendente` | 200 | Cupom garantido, mas o WhatsApp falhou | `entregue` na próxima tentativa |
| `ja_resgatado` | 200 | Telefone já recebeu a mensagem antes | — |
| `indisponivel` | 409 | Sem cupom ativo ou cupom desligado | — |
| `cupom_vencido` | 409 | Cupom fora da validade | — |
| `erro_temporario` | 503 | Falha ao ler ou gravar nas tabelas | Qualquer um, ao tentar de novo |

A trava de concorrência é a atualização condicional: marcar `mensagemEnviada=true` só quando ainda é `false`, para campanha + telefone. Perder a disputa encerra a execução sem resposta própria.
