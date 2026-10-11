# Operação

## Importar um cupom

Pré-requisito: cupom criado no painel do Parceiro e segredo de importação em mãos (variável de ambiente; nunca no código).

1. Desligue o cupom anterior da campanha, se houver (`disponivel=false` ou remoção conforme seu processo). A importação recusa campanha com cupom ativo.
2. Envie exatamente um cupom por chamada:

```bash
curl -X POST "https://<n8n>/webhook/importar-cupons" \
  -H "Content-Type: application/json" \
  -H "<NOME-DO-HEADER>: $SEGREDO" \
  -d '{
    "cupons": [{
      "code": "GOOSTO-AMOR10",
      "campaignId": "campanha-goostozinhos-v1",
      "status": "novo",
      "discount_value": "10%",
      "expiration_date": "2026-11-30",
      "min_order_value": "30.00",
      "valid": true,
      "disponivel": true
    }]
  }'
```

3. Confira o resultado: `200 success` inseriu; `400 invalid` revise formato/data; `409 duplicate` código já existe; `409 campanha_com_cupom_ativo` desligue o cupom anterior.

Segredos vivem em variáveis de ambiente (`.env` fora de controle de versão). Rotação: cadastre o novo segredo na credencial, confirme chamadas com o novo valor (esperado `400` com corpo propositalmente inválido) e verifique que o antigo falha com `401/403`.

## Rodar a landing localmente

```bash
python3 -m http.server 8000 -d public
```

Abra `http://localhost:8000` e use o modo responsivo do navegador. Para apontar a landing para outro webhook em teste, sobrescreva a configuração global no console antes de interagir (a landing aceita objeto de configuração custom) [verificar: mecanismo de sobrescrita existe no código; documentar forma exata após revisão].

## Rodar os testes

Biblioteca padrão apenas, sem instalação:

```bash
python3 -m unittest tests.test_contracts
python3 -m unittest tests.test_resgate_flow_contract
node tests/frontend-contract.test.js
node tests/frontend-shared-coupon.test.js
node tests/frontend-landing-hardening.test.js
node tests/shared_coupon_check.js
node tests/shared_coupon_workflow.test.js
python3 -m unittest tests.test_n8n_test_guards
```

Testes ponta a ponta contra a automação real são opt-in: por padrão só planejam e não tocam rede. Para executar de verdade, autorize escrita em campanhas de teste, informe o identificador do fluxo e um identificador de execução de 32 dígitos hexadecimais. Eles criam campanhas exclusivamente com o prefixo `test-`, nunca enviam WhatsApp fora do número de teste autorizado e apagam tudo ao final, com verificação de que nada fora do escopo mudou.

## Publicar uma alteração de fluxo

1. Edite o fluxo no editor da automação.
2. Publique/ative a versão no próprio editor.
3. Sincronize o estado do servidor para os arquivos locais com o script de sincronização (remoto para local; nunca o contrário). O manifesto registra versão, data e soma de verificação.
4. Rode os testes de contrato locais.

Arquivos sincronizados do servidor podem conter segredos embutidos: mantenha a pasta restrita e fora de controle de versão sem revisão.

## Resolver problemas

| Sintoma | Causa provável | Ação |
|---|---|---|
| Cliente vê “cupons esgotados” | Campanha sem cupom `novo` ou com `disponivel=false` | Importe um cupom novo ou reative o atual |
| Cliente vê “campanha encerrada” | `expiration_date` passou (vale até 23h59 de Brasília) | Importe cupom com data futura |
| Cupom entregue, mas WhatsApp não chegou | Gateway fora ou lento | Estado `pendente` reverte a trava; cliente pode tentar de novo e ver o código |
| Reenvio de WhatsApp não ocorre ao repetir | Idempotência por design | Novo envio só após falha com reversão; repetição bem-sucedida não reenvia |
| Importação responde `409 campanha_com_cupom_ativo` | Já existe cupom ativo na campanha | Desligue o atual antes |
| Importação responde `400` com data futura | Formato ou data real inválida | Use `AAAA-MM-DD` futuro; desconto `NN%`; mínimo `NN.NN` |
| Landing não envia nada | Tempo esgotado (45 s) ou rede | Mensagem orienta nova tentativa; entrega pode ter ocorrido mesmo assim |
| Progresso sumiu após um dia | Salvamento expira em 24 h | Comportamento esperado; cliente refaz os passos |
