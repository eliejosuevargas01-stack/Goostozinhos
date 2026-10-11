# Qualidade e segurança

## Idempotência e concorrência

- **Uma entrega por telefone.** Repetir com o mesmo número reexibe o código sem novo WhatsApp.
- **Trava condicional.** A reivindicação de envio atualiza apenas registros ainda marcados como não enviados. Disputas simultâneas têm um vencedor; as demais execuções encerram sem resposta própria.
- **Espera anti-colisão.** Pausa aleatória de 0 a 5 s antes de reivindicar reduz choque entre execuções.
- **Simulações locais.** Testes em memória provam que o segundo a chegar não sobrescreve o cupom do primeiro, nos dois sentidos (cliente e cupom).
- **Carga isolada.** Harness ponta a ponta prevê fase sequencial (telefones únicos no mesmo cupom, todos entregues) e fase concorrente (10 chamadas no mesmo telefone, exatamente uma entregue), com limpeza total ao final.

## Testes existentes e o que cobrem

| Teste | Tipo | Cobre |
|---|---|---|
| `test_contracts.py` | Python, sem rede | Normalização de @ e telefone, trava condicional simulada, exigência de segredo |
| `test_resgate_flow_contract.py` | Python, estrutural do fluxo | Erros de leitura viram 503 sem dados pessoais, WhatsApp precede resposta de entregue, credencial e corpo do gateway, trava de campanha de teste |
| `frontend-contract.test.js` | Node, estático | Tempo de 45 s, ramos reservados, estados pendente/vencido/temporário, trava do passo 1 |
| `frontend-shared-coupon.test.js` | Node, harness real do script | Executa o fluxo de resgate de verdade com fetch simulado |
| `frontend-landing-hardening.test.js` | Node, harness real do script | Telas novas, espera, cupom com desconto, instruções |
| `shared_coupon_check.js` | Node, núcleo de decisão | Desligado, vencido, ausente, formatos de data, tipos de disponibilidade |
| `shared_coupon_workflow.test.js` | Node, fluxos exportados | Importação estrita, grafo íntegro, cenários de decisão, corpos de resposta |
| `test_n8n_test_guards.py` | Python, sem rede | Proteções do harness: prefixo de teste, negação de escrita, limpeza com barreira |

Ponta a ponta real (`e2e_isolado.py`, `e2e_shared_coupon.py`) exige autorização explícita e só toca campanhas `test-`; sem ela, apenas planeja. [verificar: comandos exatos de execução live variam por versão do harness]

## Segurança

- **Segredo fora do código.** Importação exige credencial por header; segredo em `.env` fora de versão. Checagens automatizadas varrem execuções sem jamais imprimir o valor.
- **Cheque de vazamento.** Utilitário conta execuções contendo o segredo; resultado esperado é zero.
- **Sem dados pessoais em erro.** Respostas 4xx/5xx trazem códigos e mensagens genéricas.
- **Testes nunca disparam WhatsApp.** Campanhas `test-` desviam para resposta de teste; o envio real exige prefixo e número autorizados.
- **Exportações com segredos.** Cópias do servidor podem conter credenciais: pasta restrita, fora de versão sem revisão.

## Acessibilidade

- Contraste mínimo 4,5:1, texto quente sobre creme (nunca ouro sobre creme).
- Navegação por teclado completa; botão alternativo revela o cupom sem raspar; foco segue para a próxima ação.
- Barra de progresso com papel acessível; banners com região viva; títulos recebem foco ao trocar de cena.
- `prefers-reduced-motion`: foil parado, sem varredura de brilho; cena de agradecimento curta; vídeo pausado e trocado por imagem.
- Vídeo decorativo sem som, com pôster; nunca bloqueia a leitura.
- Alvos de toque grandes (botões ~56–60 px), botão principal fixo ao pé no celular.

## Privacidade de dados

Progresso local guarda passo, @, nome e telefone por 24 h; cupom nunca é guardado. Limpeza automática em expiração ou corrupção. WhatsApp e tabelas guardam nome, @, telefone e código pelo tempo da operação [verificar: política de retenção e anonimização não definida no código].
