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


def assinatura(d, tinta=CINZA, e=0.62):
    """A marca no rodapé: FriderAndrade ▪ / ADVOGADOS."""
    x, y = 96 * ESC, H - 62 * ESC
    fl = fonte('playfair', 30 * e, 500)
    d.text((x, y), 'FriderAndrade', font=fl, fill=tinta)
    w = d.textbbox((0, 0), 'FriderAndrade', font=fl)[2]
    s = int(13 * e * ESC)
    d.rectangle([(x + w + 9 * e * ESC, y + 11 * e * ESC),
                 (x + w + 9 * e * ESC + s, y + 11 * e * ESC + s)], fill=VERMELHO)
    d.text((x, y + 38 * e * ESC), 'A D V O G A D O S', font=fonte('inter', 11 * e, 500), fill=CINZA)


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
    assinatura(d, PAPEL, 0.75)
    return im


def slide_frase(dados):
    """Uma frase só, grande. Para os momentos em que a narração vira lema."""
    im, d = novo()
    moldura(im, d, dados.get('secao'))
    f = fonte('playfair', dados.get('corpo', 68), 500)
    y = (H - len(dados['linhas']) * 92 * ESC) / 2
    for linha in dados['linhas']:
        d.text(((W - largura(d, linha, f)) / 2, y), linha, font=f, fill=PAPEL)
        y += 92 * ESC
    if dados.get('rodape'):
        fr = fonte('inter', 24)
        d.text(((W - largura(d, dados['rodape'], fr)) / 2, y + 24 * ESC),
               dados['rodape'], font=fr, fill=CINZA)
    assinatura(d)
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
    assinatura(d)
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
    assinatura(d)
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
    assinatura(d)
    return im


TIPOS = {'abertura': slide_abertura, 'frase': slide_frase, 'tela': slide_tela,
         'passos': slide_passos, 'contraste': slide_contraste}

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
