# Glossário

| Termo | Significado |
|---|---|
| Campanha | Rodada de distribuição de cupom, identificada por texto (ex.: `campanha-goostozinhos-v1`). |
| Cupom ativo | Linha com estado `novo` e disponibilidade `true`, dentro da validade. |
| Cupom compartilhado | Mesmo código entregue a todos os clientes novos da campanha. |
| `disponivel=false` | Desliga o cupom sem consumir a linha; cliente novo recebe esgotado, cliente antigo vê o código com aviso. |
| E.164 | Formato internacional de telefone; aqui `55` + DDD + número. |
| Estado `entregue` | Resgate com WhatsApp confirmado. |
| Estado `pendente` | Cupom garantido na tela, WhatsApp falhou; trava revertida para nova tentativa. |
| Estado `ja_resgatado` | Telefone já recebeu mensagem antes; código reexibido sem novo envio. |
| Estado `indisponivel` | Sem cupom ativo/desligado para telefone novo. |
| Estado `cupom_vencido` | Validade expirada para telefone novo. |
| Estado `erro_temporario` | Falha de tabela; cliente tenta em instantes. |
| Fluxo | Automação no n8n; aqui: resgate, importação e checagem de Instagram. |
| Idempotência | Mesma ação repetida produz o mesmo resultado; aqui, um envio por telefone. |
| Jitter | Pausa aleatória curta antes de reivindicar, reduzindo colisões. |
| Pedidos10 | Plataforma de pedidos da loja, onde o cupom é usado e a avaliação acontece. |
| Raspadinha | Cartão dourado em canvas; revela o código aos 40% raspados ou pelo botão. |
| Reivindicação | Atualização condicional que marca o envio como feito só se ainda não estava. |
| Reversão | Desfaz a reivindicação quando o WhatsApp falha, liberando nova tentativa. |
| Trava condicional | Atualização que exige o estado anterior esperado (CAS). |
| Webhook | Endereço HTTP que dispara um fluxo da automação. |
