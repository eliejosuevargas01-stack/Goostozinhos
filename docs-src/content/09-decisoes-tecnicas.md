# Decisões técnicas

Resumo próprio das escolhas que moldam o sistema. Nenhuma sigla ou nome de documento interno aparece aqui.

## Cupom compartilhado por campanha

Todos os clientes novos recebem o mesmo código ativo. Motivo: operação simples para a loja (um código por rodada, criado no painel do parceiro) e decisão centralizada no fluxo. Custo: sem cotas individuais; controle de fraude fica no telefone único por campanha.

## Idempotência por telefone, não por sessão

O telefone normalizado decide repetição. Motivo: cliente troca de aparelho ou limpa o navegador; o número continua o mesmo. Efeito: segunda chamada reexibe o código sem reenviar WhatsApp.

## Falha de WhatsApp vira pendência, não erro

Se o gateway falha, a resposta traz o código com estado pendente e a trava é revertida. Motivo: o bem escasso é o cupom, não a mensagem. Cliente sai com o código na tela e tenta o envio de novo.

## Validade até o fim do dia em Brasília

Data `AAAA-MM-DD` vale até 23h59 de UTC−3, fixo o ano todo. Motivo: regra compreensível para loja e cliente, sem fuso do navegador. Data malformada conta como vencida: falha fechada, nunca aberta.

## Um cupom por chamada na importação

Lote de um item. Motivo: validação e erro ficam triviais (sucesso, inválido, duplicado, campanha ocupada). Custo: importar vários exige várias chamadas.

## Uma campanha, um cupom ativo

Importação recusa segunda ativação. Motivo: decisão de resgate lê “o cupom novo da campanha” sem ambiguidade. Troca exige desligar o anterior.

## Instagram declarado, não verificado

O @ é salvo em boa-fé. Motivo: verificação automática de seguidores é frágil (cota, lista parcial, conta privada) e barraria clientes legítimos. A checagem existe separada para consulta manual. Risco assumido: @ pode ser fictício [verificar: decisão de produto; confirmar com a loja].

## Frontend sem build

HTML, CSS e dois scripts puros, sem dependências. Motivo: hospedagem estática barata, auditoria direta do código, testes com biblioteca padrão. Custo: lógica duplicada entre cliente e servidor nos formatos (telefone, @, desconto).

## Raspadinha em canvas com alternativa real

Três camadas (máscara, textura, brilho) com limiar de 40% e botão de revelação. Motivo: momento tátil memorável sem excluir teclado e leitor de tela. Brilho é cosmético e pode falhar sem quebrar a raspagem.

## Espera de 45 segundos com tela gentil

O envio de WhatsApp domina a latência. Motivo: timeout curto demais geraria reenvios e duplicatas percebidas; a tela de espera com mensagens progressivas segura o cliente. Em timeout, a mensagem tranquiliza que o presente pode chegar mesmo assim.

## Testes sem dependências e ponta a ponta isolado

Contrato e concorrência rodam com Python e Node puros. Ponta a ponta real exige autorização, prefixo de teste, limpeza total e barreira antiapagamento. Motivo: provar sem risco de tocar produção ou disparar mensagens.
