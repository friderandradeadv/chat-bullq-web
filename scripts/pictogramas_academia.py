"""
Pictogramas da Academia — desenhados aqui, com linha e forma.

POR QUE NÃO USAR ÍCONE PRONTO: biblioteca de ícone traz peso de traço,
cantos e proporção de outra marca. Misturado com Playfair e com o vermelho
do escritório, o resultado é o mesmo "genérico de IA" que motivou largar o
visual do Gemini. Aqui o traço é um só, a espessura é uma só, e tudo
acompanha a cor que o slide mandar.

Todos recebem (d, x, y, tam, cor) e desenham DENTRO do quadrado
(x, y) → (x+tam, y+tam). Grossura proporcional ao tamanho, para o ícone
funcionar tanto a 40px quanto a 200px.
"""


def _g(tam):
    """Grossura do traço: fina o bastante para ser elegante, grossa o
    bastante para sobreviver à compressão do vídeo."""
    return max(2, int(tam * 0.055))


def documento(d, x, y, t, cor):
    """Folha com a quina dobrada e linhas de texto."""
    g = _g(t)
    m = t * 0.16
    x0, y0, x1, y1 = x + m, y + m * 0.4, x + t - m, y + t - m * 0.4
    dobra = t * 0.22
    d.line([(x0, y0), (x1 - dobra, y0), (x1, y0 + dobra), (x1, y1),
            (x0, y1), (x0, y0)], fill=cor, width=g, joint='curve')
    d.line([(x1 - dobra, y0), (x1 - dobra, y0 + dobra), (x1, y0 + dobra)], fill=cor, width=g)
    for i in range(3):
        ly = y0 + dobra + t * 0.16 * (i + 1)
        d.line([(x0 + t * 0.12, ly), (x1 - t * 0.12, ly)], fill=cor, width=max(1, g - 1))


def relogio(d, x, y, t, cor):
    """Mostrador com ponteiros — prazo, tempo, urgência."""
    g = _g(t)
    m = t * 0.12
    d.ellipse([(x + m, y + m), (x + t - m, y + t - m)], outline=cor, width=g)
    cx, cy = x + t / 2, y + t / 2
    d.line([(cx, cy), (cx, cy - t * 0.26)], fill=cor, width=g)          # ponteiro longo
    d.line([(cx, cy), (cx + t * 0.19, cy + t * 0.10)], fill=cor, width=g)


def calendario(d, x, y, t, cor):
    """Folhinha com argolas — data certa, dia marcado."""
    g = _g(t)
    m = t * 0.12
    topo = y + m + t * 0.12
    d.rectangle([(x + m, topo), (x + t - m, y + t - m)], outline=cor, width=g)
    d.line([(x + m, topo + t * 0.16), (x + t - m, topo + t * 0.16)], fill=cor, width=g)
    for i in (0.3, 0.7):
        ax = x + m + (t - 2 * m) * i
        d.line([(ax, y + m * 0.4), (ax, topo + t * 0.05)], fill=cor, width=g)


def pessoa(d, x, y, t, cor):
    """Cabeça e ombros — o cliente, a pessoa do outro lado."""
    g = _g(t)
    r = t * 0.15
    cx = x + t / 2
    d.ellipse([(cx - r, y + t * 0.16), (cx + r, y + t * 0.16 + 2 * r)], outline=cor, width=g)
    d.arc([(cx - t * 0.30, y + t * 0.52), (cx + t * 0.30, y + t * 1.06)],
          start=180, end=360, fill=cor, width=g)


def banco(d, x, y, t, cor):
    """Frontão com colunas — a instituição financeira, o réu."""
    g = _g(t)
    m = t * 0.10
    base = y + t - m
    d.polygon([(x + t / 2, y + m), (x + t - m, y + t * 0.36), (x + m, y + t * 0.36)],
              outline=cor, width=g)
    for i in range(3):
        cx = x + t * (0.30 + 0.20 * i)
        d.line([(cx, y + t * 0.42), (cx, base - t * 0.08)], fill=cor, width=g)
    d.line([(x + m, base), (x + t - m, base)], fill=cor, width=g)


def balanca(d, x, y, t, cor):
    """Balança — o juízo, a decisão."""
    g = _g(t)
    cx = x + t / 2
    d.line([(cx, y + t * 0.16), (cx, y + t * 0.80)], fill=cor, width=g)
    d.line([(x + t * 0.16, y + t * 0.28), (x + t - t * 0.16, y + t * 0.28)], fill=cor, width=g)
    d.line([(x + t * 0.30, y + t * 0.84), (x + t * 0.70, y + t * 0.84)], fill=cor, width=g)
    for lado in (-1, 1):
        px = cx + lado * t * 0.34
        d.line([(px, y + t * 0.28), (px - t * 0.10, y + t * 0.50)], fill=cor, width=max(1, g - 1))
        d.line([(px, y + t * 0.28), (px + t * 0.10, y + t * 0.50)], fill=cor, width=max(1, g - 1))
        d.line([(px - t * 0.10, y + t * 0.50), (px + t * 0.10, y + t * 0.50)], fill=cor, width=g)


def cartao(d, x, y, t, cor):
    """Cartão com tarja — o RMC, o produto vendido como empréstimo."""
    g = _g(t)
    x0, y0, x1, y1 = x + t * 0.10, y + t * 0.26, x + t * 0.90, y + t * 0.74
    d.rectangle([(x0, y0), (x1, y1)], outline=cor, width=g)
    d.rectangle([(x0, y0 + t * 0.10), (x1, y0 + t * 0.20)], fill=cor)
    d.line([(x0 + t * 0.08, y1 - t * 0.09), (x0 + t * 0.34, y1 - t * 0.09)],
           fill=cor, width=max(1, g - 1))


def chat(d, x, y, t, cor):
    """Balão de conversa — o WhatsApp, o atendimento."""
    g = _g(t)
    x0, y0, x1, y1 = x + t * 0.12, y + t * 0.18, x + t * 0.88, y + t * 0.66
    d.rounded_rectangle([(x0, y0), (x1, y1)], radius=t * 0.12, outline=cor, width=g)
    d.polygon([(x0 + t * 0.18, y1), (x0 + t * 0.18, y1 + t * 0.16), (x0 + t * 0.38, y1)],
              fill=cor)
    for i in range(2):
        ly = y0 + t * 0.16 + i * t * 0.14
        d.line([(x0 + t * 0.10, ly), (x1 - t * 0.14, ly)], fill=cor, width=max(1, g - 1))


def alerta(d, x, y, t, cor):
    """Triângulo com exclamação — a armadilha, o risco."""
    g = _g(t)
    m = t * 0.10
    d.polygon([(x + t / 2, y + m), (x + t - m, y + t - m), (x + m, y + t - m)],
              outline=cor, width=g)
    cx = x + t / 2
    d.line([(cx, y + t * 0.40), (cx, y + t * 0.66)], fill=cor, width=g + 1)
    d.ellipse([(cx - g, y + t * 0.73), (cx + g, y + t * 0.73 + 2 * g)], fill=cor)


def dinheiro(d, x, y, t, cor):
    """Cifrão em círculo — o repasse, o proveito econômico.

    🚨 O S SE DESENHA COM DOIS ARCOS DE ABERTURA OPOSTA. A primeira versão
    usava start/end trocados e saía um emaranhado que o Matheus perguntou, com
    razão, que símbolo era. No PIL o ângulo 0 é leste e cresce no sentido
    horário (porque y cresce para baixo): a metade de cima é um "C" (falta o
    setor leste) e a de baixo é um "C" espelhado (falta o setor oeste).
    """
    g = _g(t)
    m = t * 0.12
    d.ellipse([(x + m, y + m), (x + t - m, y + t - m)], outline=cor, width=g)
    cx, cy = x + t / 2, y + t / 2
    # o S ocupa pouco menos da METADE do circulo: com as proporcoes da
    # primeira tentativa (w=0.15, h=0.19) ele encostava na borda e virava
    # rabisco.
    w = t * 0.105         # meia-largura do S
    h = t * 0.098         # cada metade do S tem 2h de altura; o S inteiro, 4h
    # haste vertical, atravessando o S em cima e embaixo
    d.line([(cx, cy - 2 * h - t * 0.055), (cx, cy + 2 * h + t * 0.055)],
           fill=cor, width=max(1, g - 1))
    # metade de cima: "C" — abertura voltada para a direita
    d.arc([(cx - w, cy - 2 * h), (cx + w, cy)], start=40, end=320, fill=cor, width=g)
    # metade de baixo: "C" espelhado — abertura voltada para a esquerda
    d.arc([(cx - w, cy), (cx + w, cy + 2 * h)], start=220, end=140, fill=cor, width=g)


def cadeado(d, x, y, t, cor):
    """Cadeado — sigilo, dado do cliente, segurança."""
    g = _g(t)
    d.rounded_rectangle([(x + t * 0.20, y + t * 0.44), (x + t * 0.80, y + t * 0.86)],
                        radius=t * 0.06, outline=cor, width=g)
    d.arc([(x + t * 0.34, y + t * 0.24), (x + t * 0.66, y + t * 0.56)],
          start=180, end=360, fill=cor, width=g)
    for lado in (0.34, 0.66):   # hastes que descem até o corpo: cadeado fechado
        d.line([(x + t * lado, y + t * 0.40), (x + t * lado, y + t * 0.45)], fill=cor, width=g)
    d.ellipse([(x + t * 0.46, y + t * 0.60), (x + t * 0.54, y + t * 0.68)], fill=cor)


def pasta(d, x, y, t, cor):
    """Pasta — o caso, a pasta do cliente no Drive."""
    g = _g(t)
    x0, x1 = x + t * 0.10, x + t * 0.90
    y0, y1 = y + t * 0.30, y + t * 0.78
    # contorno único: corpo + aba no mesmo caminho, para a aba não flutuar
    d.line([(x0, y1), (x0, y0 - t * 0.10), (x0 + t * 0.30, y0 - t * 0.10),
            (x0 + t * 0.38, y0), (x1, y0), (x1, y1), (x0, y1)],
           fill=cor, width=g, joint='curve')


def engrenagem(d, x, y, t, cor):
    """Engrenagem — a automação, o classificador, o que roda sozinho."""
    import math
    g = _g(t)
    cx, cy = x + t / 2, y + t / 2
    r_ext, r_int = t * 0.34, t * 0.16
    for i in range(8):
        a = math.radians(i * 45)
        d.line([(cx + math.cos(a) * r_int * 1.4, cy + math.sin(a) * r_int * 1.4),
                (cx + math.cos(a) * r_ext, cy + math.sin(a) * r_ext)], fill=cor, width=g + 1)
    d.ellipse([(cx - r_int * 1.5, cy - r_int * 1.5), (cx + r_int * 1.5, cy + r_int * 1.5)],
              outline=cor, width=g)
    d.ellipse([(cx - r_int * 0.5, cy - r_int * 0.5), (cx + r_int * 0.5, cy + r_int * 0.5)],
              outline=cor, width=max(1, g - 1))


PICTOGRAMAS = {
    'documento': documento, 'relogio': relogio, 'calendario': calendario,
    'pessoa': pessoa, 'banco': banco, 'balanca': balanca, 'cartao': cartao,
    'chat': chat, 'alerta': alerta, 'dinheiro': dinheiro, 'cadeado': cadeado,
    'pasta': pasta, 'engrenagem': engrenagem,
}


def desenhar(d, nome, x, y, tam, cor):
    fn = PICTOGRAMAS.get(nome)
    if fn is None:
        raise KeyError(f'pictograma "{nome}" nao existe. Disponiveis: '
                       + ', '.join(sorted(PICTOGRAMAS)))
    fn(d, x, y, tam, cor)
