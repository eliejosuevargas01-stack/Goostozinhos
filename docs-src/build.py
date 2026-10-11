#!/usr/bin/env python3
"""Gera public/docs a partir de docs-src/content/*.md. Só stdlib.
Uso: python3 docs-src/build.py
ponytail: parser markdown mínimo (títulos, listas planas, tabelas, código, inline). Trocar por lib se o conteúdo crescer.
"""
import html, re, shutil
from pathlib import Path

SRC = Path(__file__).parent
OUT = SRC.parent / "public" / "docs"
CONTENT = SRC / "content"

NAV = [
    ("Começar", ["visao-geral", "como-funciona"]),
    ("Sistema", ["arquitetura", "funcionalidades", "modelo-de-dados"]),
    ("Referência", ["referencia-api", "glossario"]),
    ("Operar", ["operacao", "qualidade-seguranca"]),
    ("Contexto", ["decisoes-tecnicas", "changelog"]),
]
DESC = {
    "visao-geral": "Problema, solução e resultado do projeto.",
    "como-funciona": "A jornada do cliente, passo a passo.",
    "arquitetura": "Componentes, fluxos de dados e diagramas.",
    "funcionalidades": "O que o sistema faz hoje.",
    "modelo-de-dados": "Tabelas, colunas e estados de um resgate.",
    "referencia-api": "Webhooks: pedido, respostas e erros.",
    "glossario": "Termos usados no projeto.",
    "operacao": "Importar cupons, testar, publicar e resolver problemas.",
    "qualidade-seguranca": "Idempotência, testes, segurança e acessibilidade.",
    "decisoes-tecnicas": "Por que o sistema é do jeito que é.",
    "changelog": "Marcos da evolução do projeto.",
}
ICON = {  # Lucide (MIT), paths inline
    "visao-geral": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    "como-funciona": '<path d="M5 12h14M12 5l7 7-7 7"/>',
    "arquitetura": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4M17.5 10v4"/>',
    "funcionalidades": '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    "modelo-de-dados": '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>',
    "referencia-api": '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    "glossario": '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    "operacao": '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    "qualidade-seguranca": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    "decisoes-tecnicas": '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
    "changelog": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
}


def svg(name, cls="i"):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{ICON[name]}</svg>'


def slugify(t):
    t = re.sub(r"<[^>]+>", "", t).lower()
    t = t.translate(str.maketrans("áàâãéêíóôõúç", "aaaaeeiooouc"))
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def inline(s):
    codes = []
    s = re.sub(r"`([^`]+)`", lambda m: codes.append(m.group(1)) or f"\0{len(codes)-1}\0", s)
    s = html.escape(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\[verificar(?::\s*([^\]]+))?\]",
               lambda m: f'<span class="pill pill-amber" title="{m.group(1) or "Afirmação pendente de confirmação"}">a confirmar</span>', s)
    s = re.sub(r"\[([^\]]+)\]\((?:\d+-)?([a-z0-9-]+)\.md(#[^)]*)?\)", r'<a href="\2.html\3">\1</a>', s)
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<a href="\2" rel="noopener">\1</a>', s)
    return re.sub("\0(\\d+)\0", lambda m: f"<code>{html.escape(codes[int(m.group(1))])}</code>", s)


def callout_or_p(text):
    m = re.fullmatch(r"`(GET|POST|PUT|PATCH|DELETE) ([^`]+)`", text.strip())
    if m:
        return f'<p class="endpoint"><span class="method">{m.group(1)}</span><code>{html.escape(m.group(2))}</code></p>'
    return f"<p>{inline(text)}</p>"


def render(md):
    lines, out, toc, i = md.splitlines(), [], [], 0
    seen = {}
    title = ""
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("```"):
            lang = ln[3:].strip()
            buf = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                buf.append(lines[i]); i += 1
            i += 1
            code = html.escape("\n".join(buf), quote=False)
            if lang == "mermaid":
                out.append(f'<figure class="diagram"><pre class="mermaid">{code}</pre></figure>')
            else:
                if lang == "json":
                    code = re.sub(r'("[^"\n]*")(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)',
                                  lambda m: f'<span class="k">{m.group(1)}</span>{m.group(2)}' if m.group(2)
                                  else f'<span class="s">{m.group(1)}</span>' if m.group(1)
                                  else f'<span class="b">{m.group(0)}</span>', code)
                label = {"bash": "Terminal", "json": "JSON"}.get(lang, lang or "Código")
                out.append(f'<div class="code"><div class="code-head"><span>{label}</span>'
                           f'<button type="button" class="copy">Copiar</button></div><pre><code>{code}</code></pre></div>')
            continue
        m = re.match(r"(#{1,3}) (.+)", ln)
        if m:
            lvl, txt = len(m.group(1)), m.group(2)
            if lvl == 1:
                title = txt
            else:
                sid = slugify(txt)
                if lvl == 3 and toc:  # h3 repetidos (Pedido/Respostas) herdam o h2
                    sid = f"{[t for t in toc if t[0] == 2][-1][1]}-{sid}" if any(t[0] == 2 for t in toc) else sid
                seen[sid] = seen.get(sid, 0) + 1
                sid = sid if seen[sid] == 1 else f"{sid}-{seen[sid]}"
                toc.append((lvl, sid, txt))
                out.append(f'<h{lvl} id="{sid}"><a class="anchor" href="#{sid}">{inline(txt)}</a></h{lvl}>')
            i += 1; continue
        if ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            head, body = rows[0], [r for r in rows[1:] if not set("".join(r)) <= set("-: ")]
            t = "<thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>"
            t += "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body)
            out.append(f'<div class="table"><table>{t}</tbody></table></div>')
            continue
        lm = re.match(r"(\d+\.|-) ", ln)
        if lm:
            tag = "ol" if lm.group(1)[0].isdigit() else "ul"
            items = []
            while i < len(lines) and re.match(r"(\d+\.|-) ", lines[i]):
                items.append(re.sub(r"^(\d+\.|-) ", "", lines[i])); i += 1
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>")
            continue
        if ln.strip():
            buf = [ln]; i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r"(#|```|\||\d+\. |- )", lines[i]):
                buf.append(lines[i]); i += 1
            out.append(callout_or_p(" ".join(buf)))
            continue
        i += 1
    return title, "\n".join(out), toc


def shell(slug, title, body, toc, pages, depth_mermaid=False):
    homecur = ' aria-current="page"' if not slug else ""
    nav = [f'<ul><li><a href="index.html"{homecur}><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>Início</a></li></ul>']
    for group, slugs in NAV:
        nav.append(f'<p class="nav-label">{group}</p><ul>')
        for s in slugs:
            cur = ' aria-current="page"' if s == slug else ""
            nav.append(f'<li><a href="{s}.html"{cur}>{svg(s)}{html.escape(pages[s]["title"])}</a></li>')
        nav.append("</ul>")
    order = [s for _, g in NAV for s in g]
    pn = ""
    if slug in order:
        k = order.index(slug)
        prev = order[k - 1] if k else None
        nxt = order[k + 1] if k + 1 < len(order) else None
        pn = '<nav class="pager" aria-label="Paginação">'
        pn += f'<a class="prev" href="{prev}.html"><small>Anterior</small>{pages[prev]["title"]}</a>' if prev else "<span></span>"
        pn += f'<a class="next" href="{nxt}.html"><small>Próxima</small>{pages[nxt]["title"]}</a>' if nxt else "<span></span>"
        pn += "</nav>"
    group = next((g for g, s in NAV if slug in s), "")
    crumbs = f'<nav class="crumbs" aria-label="Trilha"><a href="index.html">Docs</a><span>/</span>{group}<span>/</span><span aria-current="page">{html.escape(title)}</span></nav>' if group else ""
    tochtml = ""
    if toc:
        tochtml = '<aside class="toc" aria-label="Nesta página"><p class="nav-label">Nesta página</p><ul>' + "".join(
            f'<li class="l{l}"><a href="#{i}">{inline(t)}</a></li>' for l, i, t in toc) + "</ul></aside>"
    mer = ('<script src="assets/mermaid.min.js" defer></script>' if depth_mermaid else "")
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} · Docs Goostozinhos</title>
<meta name="description" content="{html.escape(DESC.get(slug, 'Documentação do sistema de resgate de cupons da Goostozinhos Confeitaria.'))}">
<link rel="icon" href="assets/logo.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="assets/docs.css">
{mer}<script src="assets/docs.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Pular para o conteúdo</a>
<header class="top">
  <button type="button" class="menu" aria-controls="side" aria-expanded="false" aria-label="Abrir menu"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
  <a class="brand" href="index.html"><img src="assets/logo.jpg" alt="" width="32" height="32"><span>Goostozinhos <b>Docs</b></span></a>
  <span class="pill pill-green"><i class="dot"></i>Em produção</span>
  <a class="top-link" href="../">Ver a landing</a>
</header>
<div class="layout">
<nav id="side" class="side" aria-label="Documentação">{''.join(nav)}</nav>
<main id="main" class="main" tabindex="-1">
<article class="doc">
{crumbs}
{body}
{pn}
</article>
{tochtml}
</main>
</div>
</body>
</html>
"""


def home(pages):
    cards = "".join(
        f'<a class="card" href="{s}.html"><span class="tile tile-{c}">{svg(s)}</span><strong>{pages[s]["title"]}</strong><span>{DESC[s]}</span></a>'
        for s, c in [("visao-geral", "violet"), ("como-funciona", "indigo"), ("arquitetura", "violet"),
                     ("referencia-api", "green"), ("operacao", "amber"), ("decisoes-tecnicas", "indigo")])
    groups = "".join(
        f'<div class="idx"><p class="nav-label">{g}</p><ul>' +
        "".join(f'<li><a href="{s}.html">{pages[s]["title"]}</a><span>{DESC[s]}</span></li>' for s in ss) + "</ul></div>"
        for g, ss in NAV)
    body = f"""
<section class="hero">
  <p class="eyebrow">Documentação técnica</p>
  <h1>Resgate de cupons da Goostozinhos</h1>
  <p class="lead">Uma landing em três passos com raspadinha digital, um fluxo n8n que entrega o cupom por WhatsApp e um webhook protegido para importar cupons. Esta documentação explica como tudo funciona, como operar e por que foi construído assim.</p>
  <div class="actions"><a class="btn" href="visao-geral.html">Começar pela visão geral</a><a class="btn btn-ghost" href="referencia-api.html">Referência de API</a></div>
</section>
<section class="kpis" aria-label="Números do sistema">
  <div class="kpi"><span class="tile tile-violet">{svg('como-funciona')}</span><p class="nav-label">Passos na jornada</p><strong>3</strong></div>
  <div class="kpi"><span class="tile tile-green">{svg('referencia-api')}</span><p class="nav-label">Webhooks</p><strong>3</strong></div>
  <div class="kpi"><span class="tile tile-indigo">{svg('modelo-de-dados')}</span><p class="nav-label">Tabelas de dados</p><strong>2</strong></div>
  <div class="kpi"><span class="tile tile-amber">{svg('qualidade-seguranca')}</span><p class="nav-label">Arquivos de teste</p><strong>13</strong></div>
</section>
<h2 id="explorar">Explorar</h2>
<div class="cards">{cards}</div>
<h2 id="indice">Índice completo</h2>
<div class="index">{groups}</div>
"""
    return shell("", "Início", body, [], pages)


def main():
    pages = {}
    for f in sorted(CONTENT.glob("*.md")):
        slug = re.sub(r"^\d+-", "", f.stem)
        md = f.read_text(encoding="utf-8")
        title, body, toc = render(md)
        pages[slug] = dict(title=title, body=body, toc=toc, mermaid="```mermaid" in md)
    assert set(pages) == {s for _, g in NAV for s in g}, set(pages) ^ {s for _, g in NAV for s in g}
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "assets").mkdir(parents=True)
    for a in (SRC / "assets").iterdir():
        shutil.copy(a, OUT / "assets" / a.name)
    for slug, p in pages.items():
        lead = f'<p class="lead">{DESC[slug]}</p>'
        body = f'<h1>{inline(p["title"])}</h1>{lead}{p["body"]}'
        (OUT / f"{slug}.html").write_text(shell(slug, p["title"], body, p["toc"], pages, p["mermaid"]), encoding="utf-8")
    (OUT / "index.html").write_text(home(pages), encoding="utf-8")
    # Barreira de vazamento: doc pública não cita artefatos internos nem IDs/hosts reais.
    leak = re.compile(r"_reversa|\.reversa/|\.impeccable|actions\.md|requirements\.md|roadmap\.md|myn8n\.|dominuslabs\.online|Pr4qWYm3|C8hUZFf", re.I)
    hits = [f.name for f in OUT.glob("*.html") if leak.search(f.read_text(encoding="utf-8"))]
    assert not hits, f"conteúdo interno vazou em: {hits}"
    print(f"{len(pages) + 1} páginas em {OUT}")


if __name__ == "__main__":
    main()
