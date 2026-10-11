# Referência de API

Endereços abaixo usam o placeholder `https://<n8n>`. Substitua pelo host da sua automação. Todos os webhooks usam `POST` com corpo JSON.

## Resgatar presente

`POST https://<n8n>/webhook/resgatar-presente`

### Pedido

```json
{
  "campaignId": "campanha-goostozinhos-v1",
  "handleIg": "cliente_ig",
  "name": "Maria Silva",
  "phoneNumber": "5541999990001",
  "reviewDeclared": true
}
```

| Campo | Regra |
|---|---|
| `campaignId` | Texto. Ausente usa a campanha padrão. |
| `handleIg` | Obrigatório. Aceita com ou sem `@`; válido com `A-Za-z0-9._`, 1–30 caracteres. Persistido sem validação. |
| `name` | Obrigatório, 2–80 caracteres após aparar espaços. |
| `phoneNumber` | Obrigatório. Dígitos com DDD brasileiro válido; `55` inicial opcional. Servidor normaliza para `55DDDNÚMERO`. |
| `reviewDeclared` | Obrigatório `true` (confirmação declarada da avaliação). |

### Respostas

| HTTP | `status` | Quando | Corpo (campos principais) |
|---|---|---|---|
| 200 | `entregue` | Novo resgate com WhatsApp enviado, ou campanha de teste (com `whatsapp: ignorado_teste`) | `couponCode`, `code`, `validade`, `desconto`, `pedidoMinimo`, `whatsapp` |
| 200 | `pendente` | Cupom garantido, WhatsApp falhou | Iguais + `whatsapp: falhou`, `whatsappError.code`, mensagem de nova tentativa |
| 200 | `ja_resgatado` | Telefone já recebeu mensagem antes | `couponCode`, `code`, `validade`, `disponivel`, `vencido`, `desconto`, `pedidoMinimo` |
| 400 | `invalid_request` | Nome, @, telefone ou confirmação inválidos | `error` amigável, sem dados pessoais |
| 409 | `indisponivel` | Sem cupom ativo ou cupom desligado (telefone novo) | `error: Cupom indisponível` |
| 409 | `cupom_vencido` | Cupom passou da validade (telefone novo) | `error: Cupom vencido` |
| 503 | `erro_temporario` | Falha de leitura/escrita nas tabelas | `code: upstream_unavailable`, mensagem de nova tentativa |

Exemplo de entregue:

```json
{
  "status": "entregue",
  "couponCode": "GOOSTO10",
  "code": "GOOSTO10",
  "validade": "2026-11-30",
  "desconto": "10%",
  "pedidoMinimo": "30.00",
  "whatsapp": "enviado"
}
```

Notas:

- Validade usa `AAAA-MM-DD` e vale até 23h59 de Brasília (UTC−3).
- Respostas 200 de já resgatado refletem o estado atual do cupom (`disponivel`, `vencido`); a tela mostra aviso quando indisponível.
- Chamada simultânea duplicada com o mesmo telefone: uma vence; a perdedora encerra sem resposta própria [verificar: comportamento de borda observado nos testes; não inferir timeout do cliente a partir disso].
- Tempo-limite do navegador: 45 s. Tempo-limite de execução no servidor: consulte a Operação.

## Importar cupom

`POST https://<n8n>/webhook/importar-cupons`

Cabeçalho de autenticação via credencial configurada no webhook (`headerAuth`; o nome exato do header vive na credencial, não no export). Guarde o segredo em variável de ambiente, nunca no código.

### Pedido (exatamente um cupom)

```json
{
  "cupons": [
    {
      "code": "GOOSTO-AMOR10",
      "campaignId": "campanha-goostozinhos-v1",
      "status": "novo",
      "discount_value": "10%",
      "expiration_date": "2026-11-30",
      "min_order_value": "30.00",
      "valid": true,
      "disponivel": true
    }
  ]
}
```

Aceita também a chave `coupons` ou o objeto direto. O código é convertido para maiúsculas. `disponivel` ausente vale `true`; qualquer valor não booleano rejeita.

### Respostas

| HTTP | `status` | Quando |
|---|---|---|
| 200 | `success` | Cupom inserido (`total: 1`) |
| 400 | `invalid` | Formato inválido, data passada ou mais/menos de um cupom |
| 401/403 | — | Segredo ausente ou errado [verificar: códigos exatos dependem do gerenciador de credenciais] |
| 409 | `duplicate` | Código já cadastrado |
| 409 | `campanha_com_cupom_ativo` | Campanha já tem cupom ativo |

## Checagem de Instagram (fora do resgate)

`POST https://<n8n>/webhook/validar-instagram`

Pedido: `handleIg` (ou `handle`) e `campaignId` opcional. Resposta 200 com `is_follower`, `handleIg` normalizado e mensagem; 400 quando o @ é inválido ou ausente. Este webhook não é chamado pela landing hoje.
