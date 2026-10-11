# Documentação pública (`/docs`)

Fonte da documentação servida em `public/docs/`. Não edite `public/docs/` à mão: o build apaga e regenera a pasta.

```
docs-src/
  content/NN-slug.md   uma página por arquivo; NN define a ordem do arquivo, slug vira slug.html
  assets/              docs.css, docs.js, logo.jpg, mermaid.min.js (v11, local)
  build.py             gerador (só stdlib)
```

Gerar:

```bash
python3 docs-src/build.py
```

- Sidebar, grupos e descrições: `NAV` e `DESC` em `build.py`.
- Markdown suportado: títulos `#`/`##`/`###`, listas planas, tabelas, blocos de código (`json`, `bash`, `mermaid`), `**negrito**`, `` `código` ``, links `[x](NN-slug.md)`.
- `[verificar: motivo]` vira a pill "a confirmar".
- O build falha se o HTML citar artefatos internos (`_reversa*`, `.impeccable`, IDs de tabela, hosts reais).
