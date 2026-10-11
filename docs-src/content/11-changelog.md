# Changelog

Marcos derivados do histórico do próprio código e dos fluxos exportados, sem identificadores internos.

- **v1 — Fundação.** Landing em 3 passos, raspadinha, webhook de resgate, tabelas de cupons e clientes, importação protegida por segredo, checagem de Instagram por consulta de seguidores.
- **Endurecimento da importação.** Lote substituído por um cupom por chamada; validação estrita de formato e data; recusa de duplicata e de campanha já ativa.
- **Contrato único de resgate.** Estados consolidados (`entregue`, `pendente`, `ja_resgatado`, `indisponivel`, `cupom_vencido`, `erro_temporario`); falhas de tabela passaram a responder 503 sem dados pessoais.
- **Cupom compartilhado.** Decisão migrada para núcleo puro testável, embutido no fluxo com verificação contra divergência; todos os clientes novos da campanha recebem o mesmo código ativo.
- **Concorrência.** Jitter antes da reivindicação, revertação em falha de WhatsApp, encerramento silencioso do perdedor da disputa.
- **Ambiente de teste seguro.** Campanhas `test-` não disparam WhatsApp real; harness com prefixo obrigatório, autorização explícita e limpeza com barreira.
- **Instagram declarado.** Resgate passou a persistir o @ sem consulta; checagem de seguidores virou fluxo separado, fora do caminho da landing.
- **Maturidade do frontend.** Progresso com validade de 24 h, máscara de telefone com desambiguação de DDD 55, tela de espera com mensagens progressivas, cópia com alternativa para aparelho sem área de transferência moderna, botão de revelação sem raspar, cena de agradecimento, preferência de movimento reduzido respeitada em todas as animações.
- **Publicação atual (out/2026).** Resgate e importação ativos no servidor; checagem de Instagram desativada na instância [verificar: estado de ativação lido na sincronização local]; exports sincronizados com manifesto e soma de verificação.
