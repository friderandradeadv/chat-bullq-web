#!/usr/bin/env python3
"""
Monta o vídeo de uma aula da Academia com a identidade do escritório.

POR QUE ISTO EXISTE: o Gemini Notebook gera a narração muito bem, mas escolhe
o visual sozinho — e escolheu rosa, quadriculado de caderno e ícones de rabisco.
Trocar o "estilo visual" dele só troca um genérico de IA por outro, e custa uma
geração inteira da cota diária para descobrir se melhorou.

Então ficamos só com o áudio dele e desenhamos o vídeo aqui: paleta da marca,
Playfair e Inter (as fontes que o próprio hub usa, extraídas do build), e — o que
mais importa num treinamento de sistema — a TELA REAL DO HUB no lugar de ilustração
inventada. Não gasta um único disparo da cota: o áudio já está no mp4 baixado.

A legenda NÃO é queimada na imagem. O player da Academia já serve o .vtt por
<track>, e legenda dobrada é pior que legenda nenhuma.

USO:  python3 montar-video-academia.py <slug>
      (o roteiro visual de cada slug vive em ROTEIROS, no fim do arquivo)

Precisa de: PIL, e ffmpeg — que só existe na VPS, então a montagem final roda lá.
"""
import json
import os
import subprocess
import sys
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
FONTES = os.path.join(AQUI, '..', '.fontes-academia')
SAIDA = '/tmp/academia-frames'

# Paleta da marca, medida do PNG do logo — não é chute de olho.
GRAFITE = '#1F2325'   # fundo
PAPEL = '#F7F5F2'     # texto principal
CINZA = '#8A9095'     # texto secundário
FIO = '#3A4042'       # bordas
VERMELHO = '#CF3B2E'  # o ÚNICO acento de cor da identidade

W, H = 1920, 1080
ESC = W / 1280.0      # os tamanhos abaixo foram pensados em 1280; escalam daqui


def carregar_fontes():
    """Playfair e Inter saem do build do próprio hub (woff2 -> ttf)."""
    from fontTools.ttLib import TTFont
    import glob
    os.makedirs(FONTES, exist_ok=True)
    alvo = {'Playfair Display': 'playfair.ttf', 'Inter': 'inter.ttf'}
    faltam = [n for n, f in alvo.items() if not os.path.exists(os.path.join(FONTES, f))]
    if not faltam:
        return
    # O Next quebra cada fonte em VÁRIOS subsets por faixa unicode, e a maioria
    # traz só os glifos que o hub usa — sem acento alguns deles. Pegar "o primeiro
    # Inter que aparecer" rende texto em tofu. Então escolho, para cada família,
    # o arquivo com melhor cobertura do português.
    ACENTOS = 'abcdefghijklmnopqrstuvwxyzáéíóúãõçâêôàüº°“”—·'
    build = os.path.join(AQUI, '..', '.next', 'static', 'media', '*.woff2')
    melhor = {}
    for w in glob.glob(build):
        try:
            f = TTFont(w)
            nome = f['name'].getDebugName(1)
            cmap = f.getBestCmap()
        except Exception:
            continue
        if nome not in alvo:
            continue
        cobre = sum(1 for c in ACENTOS if ord(c) in cmap)
        if cobre > melhor.get(nome, (-1, None))[0]:
            melhor[nome] = (cobre, w)
    for nome, (cobre, w) in melhor.items():
        if cobre < len(ACENTOS):
            sys.exit(f'o melhor subset de {nome} cobre {cobre}/{len(ACENTOS)} '
                     f'caracteres do portugues — texto sairia em tofu.')
        f = TTFont(w)
        f.flavor = None
        f.save(os.path.join(FONTES, alvo[nome]))
        faltam.remove(nome)
    if faltam:
        sys.exit(f'nao achei as fontes {faltam} no build — rode `npx next build` antes.')


def fonte(familia, tamanho, peso=400):
    from PIL import ImageFont
    f = ImageFont.truetype(os.path.join(FONTES, f'{familia}.ttf'), int(tamanho * ESC))
    try:
        f.set_variation_by_axes([peso])
    except Exception:
        pass
    return f


def largura(d, txt, f):
    return d.textbbox((0, 0), txt, font=f)[2]


def moldura(im, d, secao=None):
    """Barra vermelha à esquerda + etiqueta da seção. Presente em todo slide."""
    d.rectangle([(0, 0), (int(6 * ESC), H)], fill=VERMELHO)
    if secao:
        d.text((96 * ESC, 54 * ESC), secao.upper(), font=fonte('inter', 15, 500), fill=CINZA)


def assinatura(im, d=None, tinta=None, e=0.62):
    """A marca no rodapé — o ARQUIVO REAL da logo, não uma recriação.

    Até 28/08 isto desenhava "FriderAndrade" em Playfair com um quadradinho ao
    lado. Parecia certo e não era: a logo tem proporção, espacejamento e um
    desenho de letra próprios, que tipografia solta não reproduz. Usa-se o
    frider-andrade-logo-dark.png (versão para fundo escuro), com alfa.
    """
    from PIL import Image
    caminho = os.path.join(AQUI, '..', 'public', 'frider-andrade-logo-dark.png')
    logo = Image.open(caminho).convert('RGBA')
    alt = int(46 * e / 0.62 * ESC)            # e=0.62 -> 46px de altura na base 1280
    larg = int(logo.width * alt / logo.height)
    logo = logo.resize((larg, alt), Image.LANCZOS)
    im.paste(logo, (int(96 * ESC), int(H - 52 * ESC - alt)), logo)


def novo():
    from PIL import Image, ImageDraw
    im = Image.new('RGB', (W, H), GRAFITE)
    return im, ImageDraw.Draw(im)


# ---------------------------------------------------------------- tipos de slide

def slide_abertura(dados):
    im, d = novo()
    moldura(im, d)
    d.text((96 * ESC, 340 * ESC), dados['etiqueta'].upper(), font=fonte('inter', 16, 500), fill=CINZA)
    d.text((92 * ESC, 378 * ESC), dados['titulo'], font=fonte('playfair', 86, 500), fill=PAPEL)
    y = 500 * ESC
    for linha in dados.get('sub', []):
        d.text((96 * ESC, y), linha, font=fonte('inter', 25), fill='#B9BEC2')
        y += 34 * ESC
    assinatura(im, e=0.85)
    return im


def slide_frase(dados):
    """Uma frase só, grande. Para os momentos em que a narração vira lema."""
    im, d = novo()
    moldura(im, d, dados.get('secao'))
    corpo = dados.get('corpo', 68)
    f = fonte('playfair', corpo, 500)
    # o passo acompanha o corpo: com passo fixo, uma frase grande (os "10 dias"
    # do vídeo de prazos, a 92pt) encavalava o rodape em cima dela.
    passo = corpo * 1.35 * ESC
    y = (H - len(dados['linhas']) * passo) / 2
    for linha in dados['linhas']:
        d.text(((W - largura(d, linha, f)) / 2, y), linha, font=f, fill=PAPEL)
        y += passo
    if dados.get('rodape'):
        fr = fonte('inter', 24)
        d.text(((W - largura(d, dados['rodape'], fr)) / 2, y + 30 * ESC),
               dados['rodape'], font=fr, fill=CINZA)
    assinatura(im)
    return im


def slide_tela(dados):
    """O print real do hub. É o slide que faz este vídeo valer mais que o do Gemini."""
    from PIL import Image
    im, d = novo()
    moldura(im, d, dados.get('secao'))
    d.text((92 * ESC, 80 * ESC), dados['titulo'], font=fonte('playfair', 44, 500), fill=PAPEL)
    caminho = baixar_print(dados['print'])
    shot = Image.open(caminho).convert('RGB')
    cw = int(1088 * ESC)
    shot = shot.resize((cw, int(shot.height * cw / shot.width)), Image.LANCZOS)
    topo = int(160 * ESC)
    alt = min(shot.height, H - topo - int(150 * ESC))
    shot = shot.crop((0, 0, cw, alt))
    x = int(96 * ESC)
    d.rectangle([(x - 2, topo - 2), (x + cw + 2, topo + alt + 2)], fill=FIO)
    im.paste(shot, (x, topo))
    assinatura(im)
    return im


def slide_passos(dados):
    """Lista numerada que cresce: o passo corrente em branco, os anteriores apagados."""
    im, d = novo()
    moldura(im, d, dados.get('secao'))
    d.text((92 * ESC, 80 * ESC), dados['titulo'], font=fonte('playfair', 44, 500), fill=PAPEL)
    y = 240 * ESC
    fn = fonte('playfair', 38, 500)
    ft = fonte('inter', 32)
    for i, passo in enumerate(dados['passos'], 1):
        vivo = i <= dados['ate']
        d.text((96 * ESC, y), f'{i}', font=fn, fill=VERMELHO if i == dados['ate'] else (FIO if vivo else '#2A2F31'))
        d.text((150 * ESC, y + 6 * ESC), passo, font=ft,
               fill=PAPEL if i == dados['ate'] else (CINZA if vivo else '#3A4042'))
        y += 86 * ESC
    assinatura(im)
    return im


def slide_contraste(dados):
    """Duas colunas: o que parece × o que é. Usa o vermelho para marcar o lado que manda."""
    im, d = novo()
    moldura(im, d, dados.get('secao'))
    meio = W / 2
    d.rectangle([(meio - 1, 250 * ESC), (meio + 1, H - 200 * ESC)], fill=FIO)
    for lado, (col, x0) in enumerate([(dados['esquerda'], 96 * ESC), (dados['direita'], meio + 96 * ESC)]):
        manda = col.get('manda')
        d.text((x0, 250 * ESC), col['rotulo'].upper(), font=fonte('inter', 15, 500),
               fill=VERMELHO if manda else CINZA)
        d.text((x0 - 4 * ESC, 292 * ESC), col['titulo'], font=fonte('playfair', 56, 500),
               fill=PAPEL if manda else CINZA)
        y = 400 * ESC
        for linha in col['linhas']:
            d.text((x0, y), linha, font=fonte('inter', 25), fill='#B9BEC2' if manda else '#6A7075')
            y += 40 * ESC
    assinatura(im)
    return im


def slide_lista(dados):
    """Lista longa (as 8 trilhas, os 7 passos da linha da vida). Uma ou duas
    colunas, com o item corrente aceso e os demais recuados — a tela acompanha
    a narração em vez de despejar tudo de uma vez."""
    im, d = novo()
    moldura(im, d, dados.get('secao'))
    d.text((92 * ESC, 80 * ESC), dados['titulo'], font=fonte('playfair', 44, 500), fill=PAPEL)
    itens = dados['itens']
    aceso = dados.get('aceso')          # 1-based; None acende todos
    duas = len(itens) > 6
    por_col = (len(itens) + 1) // 2 if duas else len(itens)
    fn = fonte('playfair', 30, 500)
    ft = fonte('inter', 27 if duas else 31)
    passo = 62 * ESC if duas else 76 * ESC
    for i, item in enumerate(itens, 1):
        col, lin = ((i - 1) // por_col, (i - 1) % por_col) if duas else (0, i - 1)
        x = 96 * ESC + col * (W / 2 - 40 * ESC)
        y = 220 * ESC + lin * passo
        vivo = aceso is None or i == aceso
        d.text((x, y), f'{i}', font=fn, fill=VERMELHO if (aceso and i == aceso) else FIO)
        d.text((x + 46 * ESC, y + 4 * ESC), item, font=ft,
               fill=PAPEL if vivo else '#5A6165')
        y += passo
    if dados.get('rodape'):
        d.text((96 * ESC, H - 130 * ESC), dados['rodape'], font=fonte('inter', 23), fill=CINZA)
    assinatura(im)
    return im



# ------------------------------------------------------- diagramas
# Tipografia e print mostram O QUE existe. Diagrama mostra COMO funciona —
# que é o que uma aula de processo precisa: sequência, proporção, passagem
# de uma etapa para a outra. Tudo desenhado na paleta da marca, sem ícone
# de banco de imagens.

def _seta(d, x, y, larg, cor, grossura=3):
    """Seta horizontal fina: haste + ponta triangular."""
    g = max(2, int(grossura * ESC))
    d.rectangle([(x, y - g // 2), (x + larg - 10 * ESC, y + g // 2)], fill=cor)
    p = x + larg
    h = int(9 * ESC)
    d.polygon([(p, y), (p - 14 * ESC, y - h), (p - 14 * ESC, y + h)], fill=cor)


def slide_fluxo(dados):
    """Etapas encadeadas por setas: a esteira que uma lista numerada não mostra.
    Até 4 por linha; com mais, quebra em duas fileiras."""
    im, d = novo()
    moldura(im, d, dados.get('secao'))
    d.text((92 * ESC, 80 * ESC), dados['titulo'], font=fonte('playfair', 44, 500), fill=PAPEL)
    itens = dados['etapas']
    aceso = dados.get('aceso')            # 1-based
    por_linha = 4 if len(itens) > 4 else len(itens)
    linhas = [itens[i:i + por_linha] for i in range(0, len(itens), por_linha)]
    cx = int(228 * ESC)                   # largura da caixa
    cy = int(142 * ESC)                   # altura: cabe rótulo de 3 linhas sem
    vao = int(58 * ESC)                   #   encavalar no número da etapa
    passo_v = int(196 * ESC)
    # O BLOCO E O RODAPÉ são centrados JUNTOS na faixa entre o título e a
    # assinatura. Centrar só o bloco fazia o rodapé de duas fileiras cair em
    # cima da segunda — aconteceu duas vezes antes de eu contar o rodapé aqui.
    alt_rodape = int(78 * ESC) if dados.get('rodape') else 0
    alt_bloco = len(linhas) * cy + (len(linhas) - 1) * (passo_v - cy)
    y0 = int(196 * ESC) + (int(392 * ESC) - alt_bloco - alt_rodape) / 2
    n_global = 0
    for li, linha in enumerate(linhas):
        larg = len(linha) * cx + (len(linha) - 1) * vao
        x = (W - larg) / 2
        y = y0 + li * int(230 * ESC)
        for i, item in enumerate(linha):
            n_global += 1
            on = (aceso is None or n_global == aceso)
            borda = VERMELHO if (aceso and n_global == aceso) else FIO
            tinta = PAPEL if on else '#5A6165'
            d.rectangle([(x, y), (x + cx, y + cy)], outline=borda, width=max(2, int(2 * ESC)))
            # número da etapa, discreto, no alto da caixa
            d.text((x + 14 * ESC, y + 10 * ESC), f'{n_global:02d}',
                   font=fonte('playfair', 22, 500), fill=borda)
            # rótulo, quebrado em até 3 linhas
            f = fonte('inter', 20)
            palavras, atual, ls = item.split(), '', []
            for w in palavras:
                t = (atual + ' ' + w).strip()
                if largura(d, t, f) > cx - 28 * ESC and atual:
                    ls.append(atual); atual = w
                else:
                    atual = t
            ls.append(atual)
            ty = y + cy / 2 - len(ls) * 14 * ESC + 14 * ESC
            for l in ls[:3]:
                d.text((x + 14 * ESC, ty), l, font=f, fill=tinta)
                ty += 26 * ESC
            if i < len(linha) - 1:
                _seta(d, x + cx + 12 * ESC, y + cy / 2, vao - 24 * ESC, FIO)
            x += cx + vao
    if dados.get('rodape'):
        fr = fonte('inter', 23)
        y_rod = y0 + (len(linhas) - 1) * passo_v + cy + 52 * ESC
        d.text(((W - largura(d, dados['rodape'], fr)) / 2, y_rod),
               dados['rodape'], font=fr, fill=CINZA)
    assinatura(im)
    return im


def slide_proporcao(dados):
    """Blocos iguais, alguns acesos: mostra 'um em cada quatro' sem pedir que
    a pessoa faça a conta de cabeça."""
    im, d = novo()
    moldura(im, d, dados.get('secao'))
    d.text((92 * ESC, 80 * ESC), dados['titulo'], font=fonte('playfair', 44, 500), fill=PAPEL)
    total = dados['total']
    marcados = dados['marcados']
    col = min(total, 10)
    lin = (total + col - 1) // col
    lado = int(78 * ESC)
    gap = int(16 * ESC)
    larg = col * lado + (col - 1) * gap
    x0 = (W - larg) / 2
    y0 = int(330 * ESC)
    for i in range(total):
        cx_, cy_ = i % col, i // col
        x = x0 + cx_ * (lado + gap)
        y = y0 + cy_ * (lado + gap)
        if i < marcados:
            d.rectangle([(x, y), (x + lado, y + lado)], fill=VERMELHO)
        else:
            d.rectangle([(x, y), (x + lado, y + lado)], outline=FIO, width=max(2, int(2 * ESC)))
    y = y0 + lin * (lado + gap) + 46 * ESC
    if dados.get('numero'):
        f = fonte('playfair', 64, 500)
        d.text(((W - largura(d, dados['numero'], f)) / 2, y), dados['numero'], font=f, fill=PAPEL)
        y += 96 * ESC
    if dados.get('rodape'):
        fr = fonte('inter', 24)
        d.text(((W - largura(d, dados['rodape'], fr)) / 2, y), dados['rodape'], font=fr, fill=CINZA)
    assinatura(im)
    return im


def slide_linha_tempo(dados):
    """Eixo horizontal com marcos. Para as grandes fases de um processo,
    onde o que importa é a ordem e a distância entre elas."""
    im, d = novo()
    moldura(im, d, dados.get('secao'))
    d.text((92 * ESC, 80 * ESC), dados['titulo'], font=fonte('playfair', 44, 500), fill=PAPEL)
    marcos = dados['marcos']
    aceso = dados.get('aceso')
    x0, x1 = int(150 * ESC), W - int(150 * ESC)
    y = int(H / 2)
    d.rectangle([(x0, y - 1), (x1, y + 2)], fill=FIO)
    _seta(d, x1 - 30 * ESC, y + 1, int(30 * ESC), FIO)
    passo = (x1 - x0 - 40 * ESC) / max(1, len(marcos) - 1)
    for i, m in enumerate(marcos):
        cx_ = x0 + i * passo
        on = (aceso is None or i + 1 == aceso)
        cor = VERMELHO if (aceso and i + 1 == aceso) else (PAPEL if on else FIO)
        r = int(11 * ESC) if on else int(8 * ESC)
        d.ellipse([(cx_ - r, y - r), (cx_ + r, y + r)], fill=cor)
        # rótulos alternam acima e abaixo do eixo, para não colidirem
        acima = i % 2 == 0
        f = fonte('playfair', 30, 500)
        fs = fonte('inter', 19)
        ty = y - 92 * ESC if acima else y + 46 * ESC
        w = largura(d, m['titulo'], f)
        d.text((cx_ - w / 2, ty), m['titulo'], font=f, fill=PAPEL if on else '#5A6165')
        if m.get('sub'):
            ws = largura(d, m['sub'], fs)
            d.text((cx_ - ws / 2, ty + 40 * ESC), m['sub'], font=fs, fill=CINZA)
    if dados.get('rodape'):
        fr = fonte('inter', 23)
        d.text(((W - largura(d, dados['rodape'], fr)) / 2, H - 150 * ESC),
               dados['rodape'], font=fr, fill=CINZA)
    assinatura(im)
    return im




def slide_cartoes(dados):
    """Conceitos em cartões, cada um com pictograma. Para enumerações em que
    cada item é uma COISA (um módulo, um documento, um risco) — não um passo."""
    import pictogramas_academia as P
    im, d = novo()
    moldura(im, d, dados.get('secao'))
    d.text((92 * ESC, 80 * ESC), dados['titulo'], font=fonte('playfair', 44, 500), fill=PAPEL)
    itens = dados['cartoes']
    aceso = dados.get('aceso')
    col = min(len(itens), 4)
    cw, ch = int(258 * ESC), int(228 * ESC)
    gap = int(30 * ESC)
    larg = col * cw + (col - 1) * gap
    x0 = (W - larg) / 2
    y0 = int(250 * ESC)
    for i, it in enumerate(itens):
        on = (aceso is None or i + 1 == aceso)
        destaque = (aceso and i + 1 == aceso)
        x = x0 + (i % col) * (cw + gap)
        y = y0 + (i // col) * (ch + gap)
        d.rectangle([(x, y), (x + cw, y + ch)],
                    outline=VERMELHO if destaque else FIO, width=max(2, int(2 * ESC)))
        cor_ic = VERMELHO if destaque else (PAPEL if on else '#4A5155')
        P.desenhar(d, it['icone'], x + cw / 2 - 40 * ESC, y + 26 * ESC, 80 * ESC, cor_ic)
        ft = fonte('playfair', 30, 500)
        wt = largura(d, it['titulo'], ft)
        d.text((x + cw / 2 - wt / 2, y + 128 * ESC), it['titulo'], font=ft,
               fill=PAPEL if on else '#5A6165')
        if it.get('sub'):
            fs = fonte('inter', 19)
            # quebra em duas linhas se precisar
            palavras, atual, ls = it['sub'].split(), '', []
            for w in palavras:
                t = (atual + ' ' + w).strip()
                if largura(d, t, fs) > cw - 30 * ESC and atual:
                    ls.append(atual); atual = w
                else:
                    atual = t
            ls.append(atual)
            ly = y + 172 * ESC
            for l in ls[:2]:
                d.text((x + cw / 2 - largura(d, l, fs) / 2, ly), l, font=fs, fill=CINZA)
                ly += 26 * ESC
    if dados.get('rodape'):
        fr = fonte('inter', 23)
        d.text(((W - largura(d, dados['rodape'], fr)) / 2, H - 150 * ESC),
               dados['rodape'], font=fr, fill=CINZA)
    assinatura(im)
    return im


def slide_funil(dados):
    """Trapézios empilhados com contagem. O funil comercial, ou qualquer
    coisa que estreita de uma etapa para a próxima."""
    im, d = novo()
    moldura(im, d, dados.get('secao'))
    d.text((92 * ESC, 80 * ESC), dados['titulo'], font=fonte('playfair', 44, 500), fill=PAPEL)
    fases = dados['fases']
    n = len(fases)
    topo = int(240 * ESC)
    alt = int(64 * ESC)
    gap = int(12 * ESC)
    w_max, w_min = int(760 * ESC), int(260 * ESC)
    cx = W / 2
    for i, f in enumerate(fases):
        w0 = w_max - (w_max - w_min) * i / max(1, n)
        w1 = w_max - (w_max - w_min) * (i + 1) / max(1, n)
        y = topo + i * (alt + gap)
        destaque = dados.get('aceso') == i + 1
        cor = VERMELHO if destaque else FIO
        d.polygon([(cx - w0 / 2, y), (cx + w0 / 2, y),
                   (cx + w1 / 2, y + alt), (cx - w1 / 2, y + alt)],
                  outline=cor, width=max(2, int(2 * ESC)))
        ft = fonte('inter', 24, 500 if destaque else 400)
        tinta = PAPEL if destaque else '#B9BEC2'
        d.text((cx - largura(d, f['nome'], ft) / 2, y + alt / 2 - 15 * ESC),
               f['nome'], font=ft, fill=tinta)
        if f.get('n'):
            fn_ = fonte('playfair', 26, 500)
            d.text((cx + w0 / 2 + 24 * ESC, y + alt / 2 - 16 * ESC), str(f['n']),
                   font=fn_, fill=VERMELHO if destaque else CINZA)
    if dados.get('rodape'):
        fr = fonte('inter', 23)
        d.text(((W - largura(d, dados['rodape'], fr)) / 2,
                topo + n * (alt + gap) + 40 * ESC), dados['rodape'], font=fr, fill=CINZA)
    assinatura(im)
    return im


def slide_calendario(dados):
    """Grade de dias com o prazo correndo. Feito para os 10 dias do portal:
    mostra o tempo passando mesmo com ninguém abrindo a intimação."""
    im, d = novo()
    moldura(im, d, dados.get('secao'))
    d.text((92 * ESC, 80 * ESC), dados['titulo'], font=fonte('playfair', 44, 500), fill=PAPEL)
    total = dados.get('total', 10)
    corridos = dados.get('corridos', 0)
    lado = int(96 * ESC)
    gap = int(18 * ESC)
    larg = total * lado + (total - 1) * gap
    x0 = (W - larg) / 2
    y = int(330 * ESC)
    fnum = fonte('playfair', 34, 500)
    for i in range(total):
        x = x0 + i * (lado + gap)
        passou = i < corridos
        if passou:
            d.rectangle([(x, y), (x + lado, y + lado)], fill=VERMELHO)
            tinta = PAPEL
        else:
            d.rectangle([(x, y), (x + lado, y + lado)], outline=FIO, width=max(2, int(2 * ESC)))
            tinta = '#5A6165'
        txt = str(i + 1)
        d.text((x + lado / 2 - largura(d, txt, fnum) / 2, y + lado / 2 - 24 * ESC),
               txt, font=fnum, fill=tinta)
    # a régua embaixo, mostrando que o relógio não para
    d.line([(x0, y + lado + 34 * ESC), (x0 + larg, y + lado + 34 * ESC)], fill=FIO, width=2)
    if corridos:
        d.line([(x0, y + lado + 34 * ESC),
                (x0 + corridos * (lado + gap) - gap, y + lado + 34 * ESC)],
               fill=VERMELHO, width=max(3, int(4 * ESC)))
    if dados.get('numero'):
        f = fonte('playfair', 60, 500)
        d.text(((W - largura(d, dados['numero'], f)) / 2, y + lado + 74 * ESC),
               dados['numero'], font=f, fill=PAPEL)
    if dados.get('rodape'):
        fr = fonte('inter', 24)
        d.text(((W - largura(d, dados['rodape'], fr)) / 2, y + lado + 156 * ESC),
               dados['rodape'], font=fr, fill=CINZA)
    assinatura(im)
    return im


TIPOS = {'abertura': slide_abertura, 'frase': slide_frase, 'tela': slide_tela,
         'passos': slide_passos, 'contraste': slide_contraste, 'lista': slide_lista,
         'fluxo': slide_fluxo, 'proporcao': slide_proporcao,
         'linha_tempo': slide_linha_tempo, 'cartoes': slide_cartoes,
         'funil': slide_funil, 'calendario': slide_calendario}

BASE_PRINTS = 'https://api.friderandrade.com.br/api/v1/uploads/assets/academia/prints'


def baixar_print(nome):
    os.makedirs('/tmp/prints-academia', exist_ok=True)
    destino = f'/tmp/prints-academia/{nome}.png'
    if not os.path.exists(destino):
        urllib.request.urlretrieve(f'{BASE_PRINTS}/{nome}.png', destino)
    return destino


def montar(slug, roteiro, duracao):
    from PIL import Image  # noqa: F401  (garante a dependência antes de gerar)
    carregar_fontes()
    os.makedirs(SAIDA, exist_ok=True)
    for f in os.listdir(SAIDA):
        os.remove(os.path.join(SAIDA, f))

    cortes = [c['t'] for c in roteiro] + [duracao]
    lista = []
    for i, cena in enumerate(roteiro):
        im = TIPOS[cena['tipo']](cena)
        arq = os.path.join(SAIDA, f'{i:03d}.png')
        im.save(arq)
        seg = round(cortes[i + 1] - cortes[i], 3)
        if seg <= 0:
            sys.exit(f'cena {i} ({cena["tipo"]}) tem duracao {seg}s — roteiro fora de ordem.')
        lista.append((arq, seg))
        print(f'  {i:2}. {cena["tipo"]:10} {cortes[i]:6.1f}s  +{seg:5.1f}s')

    concat = os.path.join(SAIDA, 'lista.txt')
    with open(concat, 'w') as fh:
        for arq, seg in lista:
            fh.write(f"file '{arq}'\nduration {seg}\n")
        fh.write(f"file '{lista[-1][0]}'\n")   # o concat exige repetir o último
    # cenas.tsv: uma linha por cena, "arquivo<TAB>segundos". O shell da VPS
    # lia o lista.txt do concat aos pares e quebrava no último quadro, que vem
    # repetido e sem duration. Aqui a informação é explícita.
    with open(os.path.join(SAIDA, 'cenas.tsv'), 'w') as fh:
        for arq, seg in lista:
            fh.write(f'{os.path.basename(arq)} {seg}\n')
    with open(os.path.join(SAIDA, 'plano.json'), 'w') as fh:
        json.dump({'slug': slug, 'duracao': duracao, 'cenas': len(lista)}, fh)
    print(f'\n{len(lista)} quadros em {SAIDA}')
    return concat


if __name__ == '__main__':
    from roteiros_academia import ROTEIROS  # noqa: E402
    slug = sys.argv[1] if len(sys.argv) > 1 else sys.exit('uso: montar-video-academia.py <slug>')
    if slug not in ROTEIROS:
        sys.exit(f'sem roteiro visual para "{slug}" — defina em roteiros_academia.py')
    r = ROTEIROS[slug]
    montar(slug, r['cenas'], r['duracao'])
    print(f'\nAgora, na VPS:\n  bash scripts/publicar-video-montado.sh {slug}')
