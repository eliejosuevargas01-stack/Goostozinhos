# Funcionalidades

## Landing

- **Boas-vindas.** Título, convite e botão “Quero meu presente”. Define o tom artesanal.
- **Barra de progresso.** Mostra passo atual e percentual (0/33/66/100%), com papel acessível de barra de progresso.
- **Passo 1 com trava dupla.** Continuar exige abrir o perfil no Instagram e digitar @ válido. Antes do clique, o botão explica o que falta em vez de ficar mudo.
- **Passo 2 com confirmação declarada.** Abrir o Pedidos10 e confirmar avaliação. Cena de agradecimento com coração fecha sozinha ou por toque, Esc ou botão.
- **Passo 3 com máscara brasileira.** Nome e WhatsApp com formatação ao digitar, colar e autocompletar. Normaliza para `55DDDNÚMERO`.
- **Tela de espera.** Fatia de bolo animada após 0,3 s de espera, mensagem alternativa aos 15 s, tempo mínimo visível para não piscar.
- **Raspadinha dourada.** Canvas com textura metálica, brilho que segue dedo, mouse ou inclinação do aparelho. Revela aos 40% raspados. Botão “Revelar sem raspar” para teclado e leitor de tela. Redimensionar a tela preserva a área já raspada.
- **Cartão de cupom.** Código, desconto, pedido mínimo, validade e estado. Valores fora do formato somem da tela em vez de exibir texto estranho.
- **Copiar código.** Usa área de transferência moderna com alternativa antiga; se impossível, seleciona o texto e orienta a copiar pelo menu do aparelho. Feedback expira em 2,5 s.
- **Como usar.** Instruções em 3 gestos com o código repetido e botão de voltar.
- **Progresso salvo.** Etapa, @, nome e telefone persistem 24 h no navegador. Cupom nunca persiste. Dados corrompidos ou expirados limpam o salvamento.
- **Vídeo ambiente.** Prévia leve no celular; vídeo completo só em desktop, pausado com aba oculta ou preferência de movimento reduzido.

## Resgate e entrega

- **Validação de entrada.** Nome 2–80 caracteres, @ no formato do Instagram, telefone brasileiro válido com DDD, confirmação de avaliação marcada, campanha informada (padrão da campanha atual).
- **Um cupom por cliente.** Telefone que já recebeu mensagem reexibe o código (estado já resgatado), sem novo envio.
- **Cupom compartilhado.** Todos os clientes novos da campanha recebem o mesmo código ativo. [verificar: confirmado pela lógica de decisão e pelos testes; validar volume em produção]
- **Entrega dupla.** Código na tela mais mensagem de WhatsApp com saudação, nome e código.
- **Campanhas de teste.** Códigos de campanha começados por `test-` recebem resposta de entregue sem disparar WhatsApp.
- **Falha tratada.** Gateway fora do ar gera resposta pendente com o código e instrução de nova tentativa. Reivindicação de envio é revertida para liberar a próxima tentativa.
- **Sem vazamento.** Corpos de erro não incluem dados pessoais.

## Importação de cupons

- **Um cupom por chamada.** Envie exatamente um objeto de cupom por requisição.
- **Validação estrita.** Código em maiúsculas `A-Z0-9-` (3–50), desconto `NN%`, validade `AAAA-MM-DD` futura (vale até 23h59 de Brasília), pedido mínimo `NN.NN`, estado `novo`, válido `true`, disponibilidade booleana (ausente vale `true`).
- **Proteções.** Webhook exige autenticação por header; duplicata de código responde 409; campanha que já tem cupom ativo responde 409.
- **Respostas.** Sucesso 200, inválido 400, duplicado ou campanha ocupada 409.

## Instagram

Estado real: o @ é persistido como informado, sem validação no resgate. A checagem de seguidores existe como fluxo separado (normaliza @, consulta lista de seguidores, responde se encontrou), hoje fora do caminho do resgate. A consulta tolera retorno vazio marcando como seguidor para não barrar o cliente [verificar: comportamento de contingência lido no fluxo exportado; confirmar se desejado em produção].
