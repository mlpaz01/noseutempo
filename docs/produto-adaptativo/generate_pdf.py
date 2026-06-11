from pathlib import Path
from math import cos, sin, pi

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "NoSeuTempo_Plano_Produto_Adaptativo.pdf"
ASSETS = ROOT / "apps" / "site" / "assets"

W, H = landscape(A4)


COL = {
    "navy": "#1c3a5e",
    "navy_deep": "#13294a",
    "ink": "#16314f",
    "muted": "#5d6e80",
    "teal": "#14a098",
    "teal_dark": "#0e8a83",
    "purple": "#6c3fb5",
    "lav": "#e8e1fc",
    "lav2": "#f3eeff",
    "cyan": "#2bb6ea",
    "blue": "#2f7fd1",
    "orange": "#f7941d",
    "pink": "#c0398a",
    "mint": "#d3f0e1",
    "yellow": "#fdf1ca",
    "paper": "#fbf7f1",
    "cream": "#fefcf8",
    "white": "#ffffff",
    "line": "#e7dfd2",
    "soft_blue": "#eaf4ff",
    "soft_mint": "#e4f4f1",
    "soft_orange": "#fff0dd",
    "dark_panel": "#1e2a4a",
}


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def color(c):
    return hex_to_rgb(COL.get(c, c))


def set_fill(c, name, alpha=1):
    c.setFillColorRGB(*color(name))
    if hasattr(c, "setFillAlpha"):
        c.setFillAlpha(alpha)


def set_stroke(c, name, alpha=1):
    c.setStrokeColorRGB(*color(name))
    if hasattr(c, "setStrokeAlpha"):
        c.setStrokeAlpha(alpha)


def reset_alpha(c):
    if hasattr(c, "setFillAlpha"):
        c.setFillAlpha(1)
    if hasattr(c, "setStrokeAlpha"):
        c.setStrokeAlpha(1)


def text_width(text, font="Helvetica", size=10):
    return pdfmetrics.stringWidth(str(text), font, size)


def wrap_text(text, width, font="Helvetica", size=10):
    words = str(text).replace("\n", " \n ").split()
    lines, line = [], ""
    for word in words:
        if word == "\n":
            if line:
                lines.append(line)
                line = ""
            continue
        test = word if not line else f"{line} {word}"
        if text_width(test, font, size) <= width:
            line = test
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def draw_text(c, text, x, y, width, size=10, font="Helvetica", fill="ink",
              leading=None, max_lines=None):
    set_fill(c, fill)
    c.setFont(font, size)
    leading = leading or size * 1.35
    lines = wrap_text(text, width, font, size)
    if max_lines:
        lines = lines[:max_lines]
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    reset_alpha(c)
    return y


def draw_title(c, title, subtitle=None, eyebrow=None):
    if eyebrow:
        pill(c, 48, H - 72, eyebrow, fill="lav", txt="purple")
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 28)
    c.drawString(48, H - 112, title)
    if subtitle:
        draw_text(c, subtitle, 50, H - 140, 610, size=10.8, fill="muted")


def page_bg(c, page_no, section="NoSeuTempo Adaptive Layer"):
    set_fill(c, "paper")
    c.rect(0, 0, W, H, fill=1, stroke=0)
    set_fill(c, "soft_blue", .65)
    c.circle(80, H - 40, 180, fill=1, stroke=0)
    set_fill(c, "lav2", .75)
    c.circle(W - 70, H - 50, 220, fill=1, stroke=0)
    set_fill(c, "soft_orange", .45)
    c.circle(W - 120, 20, 165, fill=1, stroke=0)
    reset_alpha(c)
    set_stroke(c, "line")
    c.setLineWidth(.7)
    c.line(42, 42, W - 42, 42)
    set_fill(c, "muted")
    c.setFont("Helvetica", 7.5)
    c.drawString(48, 25, section)
    c.drawRightString(W - 48, 25, f"{page_no:02d}")
    reset_alpha(c)


def logo(c, x, y, w=150):
    p = ASSETS / "logo.png"
    if p.exists():
        img = ImageReader(str(p))
        iw, ih = img.getSize()
        h = w * ih / iw
        c.drawImage(img, x, y, w, h, mask="auto")
    else:
        set_fill(c, "navy")
        c.setFont("Helvetica-Bold", 22)
        c.drawString(x, y + 14, "NoSeu")
        set_fill(c, "teal")
        c.drawString(x + 62, y + 14, "Tempo")


def pill(c, x, y, text, fill="white", txt="navy", stroke=None, pad=11, size=9):
    c.setFont("Helvetica-Bold", size)
    tw = text_width(text, "Helvetica-Bold", size)
    h = size + 12
    set_fill(c, fill)
    if stroke:
        set_stroke(c, stroke)
        c.roundRect(x, y, tw + pad * 2, h, h / 2, fill=1, stroke=1)
    else:
        c.roundRect(x, y, tw + pad * 2, h, h / 2, fill=1, stroke=0)
    set_fill(c, txt)
    c.drawString(x + pad, y + 6, text)
    reset_alpha(c)
    return tw + pad * 2


def card(c, x, y, w, h, fill="white", stroke="line", radius=18, shadow=True):
    if shadow:
        set_fill(c, "navy", .07)
        c.roundRect(x + 5, y - 6, w, h, radius, fill=1, stroke=0)
    set_fill(c, fill)
    set_stroke(c, stroke)
    c.setLineWidth(.8)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)
    reset_alpha(c)


def small_icon(c, x, y, label, fill="lav", txt="purple"):
    set_fill(c, fill)
    c.roundRect(x, y, 34, 34, 11, fill=1, stroke=0)
    set_fill(c, txt)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(x + 17, y + 11, label)
    reset_alpha(c)


def mini_bar(c, x, y, w, pct, bg="lav2", fg="teal"):
    set_fill(c, bg)
    c.roundRect(x, y, w, 7, 3.5, fill=1, stroke=0)
    set_fill(c, fg)
    c.roundRect(x, y, w * pct, 7, 3.5, fill=1, stroke=0)
    reset_alpha(c)


def draw_browser_frame(c, x, y, w, h, title="NoSeuTempo Player"):
    card(c, x, y, w, h, fill="white", radius=22)
    set_fill(c, "soft_blue")
    c.roundRect(x, y + h - 38, w, 38, 22, fill=1, stroke=0)
    set_fill(c, "orange")
    c.circle(x + 22, y + h - 19, 4, fill=1, stroke=0)
    set_fill(c, "teal")
    c.circle(x + 36, y + h - 19, 4, fill=1, stroke=0)
    set_fill(c, "purple")
    c.circle(x + 50, y + h - 19, 4, fill=1, stroke=0)
    set_fill(c, "muted")
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + 70, y + h - 23, title)
    reset_alpha(c)


def diagram_arrow(c, x1, y1, x2, y2, col="muted"):
    set_stroke(c, col)
    c.setLineWidth(1.4)
    c.line(x1, y1, x2, y2)
    ang = 0 if x2 >= x1 else pi
    c.line(x2, y2, x2 - 7 * cos(ang + .45), y2 - 7 * sin(ang + .45))
    c.line(x2, y2, x2 - 7 * cos(ang - .45), y2 - 7 * sin(ang - .45))
    reset_alpha(c)


def cover(c):
    page_bg(c, 1, "Visao de produto")
    logo(c, 52, H - 95, 170)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 36)
    c.drawString(55, H - 170, "NoSeuTempo")
    c.setFont("Helvetica-Bold", 30)
    c.drawString(55, H - 210, "Adaptive Content Layer")
    draw_text(
        c,
        "Plano para transformar conteudo tradicional em experiencias adaptadas, personalizadas e plugaveis em e-learnings, cursos corporativos, faculdades e WordPress.",
        58,
        H - 248,
        560,
        size=13,
        fill="muted",
    )
    pill(c, 58, H - 310, "Do conteudo unico ao caminho certo para cada aluno", fill="lav", txt="purple", size=10)
    pill(c, 58, H - 346, "Player adaptativo + plugin + motor de conversao", fill="soft_mint", txt="teal_dark", size=10)
    p = ASSETS / "geni-ia-maos-sem-fundo-v2.png"
    if p.exists():
        c.drawImage(ImageReader(str(p)), W - 330, 84, 235, 235, mask="auto")
    card(c, W - 370, H - 250, 285, 112, fill="white", radius=24)
    small_icon(c, W - 346, H - 198, "AI", fill="soft_mint", txt="teal_dark")
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 16)
    c.drawString(W - 298, H - 178, "Ensinar de verdade")
    draw_text(c, "No tempo certo. No seu tempo.", W - 298, H - 198, 190, size=11, fill="muted")
    set_fill(c, "muted")
    c.setFont("Helvetica", 9)
    c.drawString(58, 78, "Documento de produto, UX e integracoes - gerado para planejamento executivo e tecnico.")
    reset_alpha(c)


def page_executive(c):
    page_bg(c, 2)
    draw_title(c, "1. Tese do produto", "Um padrao para converter aulas tradicionais em experiencias que se adaptam ao jeito de aprender de cada aluno.", "Resumo executivo")
    items = [
        ("Problema", "Cursos digitais assumem que uma unica aula serve para todos. Para alunos com dislexia, TDAH, autismo, baixa alfabetizacao digital, ansiedade ou fadiga cognitiva, o conteudo pode estar correto e ainda assim falhar."),
        ("Resposta NoSeuTempo", "Criar uma camada adaptativa sobre conteudos existentes: o aluno continua no curso original, mas ganha alternativas de explicacao, ritmo, formato, apoio da Geni e feedback continuo."),
        ("Produto", "Um motor de conversao + player adaptativo + plugin/SDK que pode funcionar no proprio NoSeuTempo, em WordPress, LMS corporativo, faculdade, AVA ou plataforma customizada."),
        ("Diferencial", "Nao e so acessibilidade visual. E pedagogia adaptativa operacional: diagnostica dificuldades, transforma o formato, mede compreensao e aprende com o aluno."),
    ]
    x, y = 50, H - 210
    for i, (t, body) in enumerate(items):
        cx = x + (i % 2) * 380
        cy = y - (i // 2) * 145
        card(c, cx, cy, 330, 105, fill="white")
        small_icon(c, cx + 18, cy + 55, str(i + 1), fill=["lav", "soft_mint", "soft_blue", "soft_orange"][i], txt=["purple", "teal_dark", "blue", "orange"][i])
        set_fill(c, "navy")
        c.setFont("Helvetica-Bold", 14)
        c.drawString(cx + 66, cy + 78, t)
        draw_text(c, body, cx + 66, cy + 58, 238, size=9.2, fill="muted")
    card(c, 50, 82, W - 100, 74, fill="dark_panel", stroke="dark_panel", radius=22)
    set_fill(c, "white")
    c.setFont("Helvetica-Bold", 15)
    c.drawString(78, 124, "Frase norteadora")
    draw_text(c, "O conteudo nao precisa trocar de dono. Ele precisa ganhar novos caminhos para chegar em cada pessoa.", 78, 105, 680, size=11, fill="white")


def page_modules(c):
    page_bg(c, 3)
    draw_title(c, "2. Produto como plataforma", "Cinco modulos formam o padrao NoSeuTempo de conteudo adaptativo.", "Arquitetura modular")
    modules = [
        ("01", "Content Converter", "Ingestao de aulas, PDFs, videos, SCORM, posts ou HTML. Gera resumo, passos, roteiro visual, quiz, audio e explicacao conversacional."),
        ("02", "Learner Profile", "Perfil de dificuldade, preferencia, ritmo, energia, leitura, atencao, linguagem e historico de respostas."),
        ("03", "Adaptive Player", "Player que muda formato, densidade, ritmo, apoio visual, leitura guiada, atividades e explicacao da Geni."),
        ("04", "Plugin SDK", "Script, shortcode, bloco WordPress, LTI, iframe ou API para acoplar em plataformas existentes."),
        ("05", "Learning Analytics", "Painel de engajamento, pontos de travamento, formatos que funcionam e alertas para equipe pedagogica."),
    ]
    start_x, y = 48, H - 205
    box_w, gap = 145, 14
    for i, (num, title, body) in enumerate(modules):
        x = start_x + i * (box_w + gap)
        card(c, x, y, box_w, 238, fill="white", radius=20)
        small_icon(c, x + 17, y + 184, num, fill=["lav", "soft_mint", "soft_blue", "soft_orange", "yellow"][i], txt=["purple", "teal_dark", "blue", "orange", "navy"][i])
        set_fill(c, "navy")
        c.setFont("Helvetica-Bold", 12)
        draw_text(c, title, x + 17, y + 166, box_w - 34, size=11.5, font="Helvetica-Bold", fill="navy")
        draw_text(c, body, x + 17, y + 123, box_w - 34, size=8.4, fill="muted")
    diagram_arrow(c, 120, 168, W - 130, 168, "purple")
    labels = ["Conteudo", "Conversao", "Perfil", "Player", "Dados"]
    for i, label in enumerate(labels):
        x = 78 + i * 165
        pill(c, x, 147, label, fill="lav2", txt="purple", size=8)
    draw_text(c, "A plataforma pode ser vendida como SaaS completo, camada white-label ou plugin para ambientes existentes.", 66, 103, 720, size=12, fill="navy")


def page_pipeline(c):
    page_bg(c, 4)
    draw_title(c, "3. Padrao de conversao de conteudo", "O NoSeuTempo transforma uma aula tradicional em um pacote adaptativo versionado, mensuravel e seguro.", "NST-A1")
    stages = [
        ("Entrada", "PDF, video, slide, HTML, SCORM, aula WordPress, texto ou link."),
        ("Leitura pedagogica", "Objetivo, topicos, pre-requisitos, vocabulário, exemplos e riscos de confusao."),
        ("Quebra em blocos", "Microaulas, passos, conceitos-chave, check-ins e perguntas de compreensao."),
        ("Geracao de rotas", "Texto simples, audio, imagem, historia, jogo, mapa mental, quiz e conversa."),
        ("Revisao", "Professor aprova, edita tom, bloqueia partes sensiveis e marca autoria."),
        ("Publicacao", "Player adaptativo entrega a melhor rota e registra aprendizagem."),
    ]
    x0, y = 52, H - 218
    w, h, gap = 118, 128, 16
    for i, (t, b) in enumerate(stages):
        x = x0 + i * (w + gap)
        card(c, x, y, w, h, fill="white", radius=18)
        small_icon(c, x + 14, y + 76, str(i + 1), fill="soft_mint" if i % 2 else "lav", txt="teal_dark" if i % 2 else "purple")
        set_fill(c, "navy")
        c.setFont("Helvetica-Bold", 10.5)
        draw_text(c, t, x + 14, y + 58, w - 28, size=10.2, font="Helvetica-Bold", fill="navy")
        draw_text(c, b, x + 14, y + 32, w - 28, size=7.4, fill="muted")
        if i < len(stages) - 1:
            diagram_arrow(c, x + w + 2, y + h / 2, x + w + gap - 4, y + h / 2, "muted")
    card(c, 70, 95, 700, 135, fill="dark_panel", stroke="dark_panel", radius=22)
    set_fill(c, "white")
    c.setFont("Helvetica-Bold", 16)
    c.drawString(98, 190, "Manifesto adaptativo por aula")
    draw_text(c, "Cada conteudo convertido vira um pacote com: objetivos, blocos, formatos gerados, regras de adaptacao, limites de uso, autoria, idioma, nivel de leitura, indicadores e versoes aprovadas.", 98, 166, 420, size=10.5, fill="white")
    set_fill(c, "soft_mint")
    c.roundRect(555, 115, 175, 90, 14, fill=1, stroke=0)
    set_fill(c, "teal_dark")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(575, 181, "Exemplo de saida")
    draw_text(c, "lesson_id\nformats: video, audio, cards\nreading_level: simples\nsupport: Geni + passo a passo\nsignals: pausa, erro, replay", 575, 162, 140, size=7.8, fill="navy")


def page_profile(c):
    page_bg(c, 5)
    draw_title(c, "4. Perfil adaptativo do aluno", "O player nao pergunta apenas 'qual formato voce prefere?'. Ele aprende quais caminhos realmente funcionam.", "Personalizacao")
    card(c, 54, 92, 340, 370, fill="white", radius=24)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 17)
    c.drawString(82, 428, "Perfil vivo de aprendizagem")
    traits = [
        ("Leitura longa", .32, "Prefere blocos curtos"),
        ("Apoio visual", .82, "Imagens ajudam"),
        ("Audio", .64, "Bom em revisao"),
        ("Jogos", .48, "Bom para pratica"),
        ("Ansiedade", .58, "Evitar cronometro"),
        ("Atencao", .38, "Check-ins frequentes"),
    ]
    y = 385
    for name, pct, note in traits:
        set_fill(c, "ink")
        c.setFont("Helvetica-Bold", 9.2)
        c.drawString(82, y, name)
        mini_bar(c, 180, y + 2, 130, pct, bg="lav2", fg="teal" if pct > .55 else "orange")
        draw_text(c, note, 82, y - 14, 240, size=7.3, fill="muted")
        y -= 48
    card(c, 430, 292, 350, 170, fill="soft_blue", stroke="soft_blue", radius=24)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 17)
    c.drawString(458, 426, "Fontes de sinal")
    signals = ["autodeclaracao inicial", "tempo parado", "repeticao de trecho", "erros no quiz", "pedido de ajuda", "troca manual de formato", "humor/energia do dia", "progresso longitudinal"]
    x, y = 458, 390
    for i, sig in enumerate(signals):
        pill(c, x + (i % 2) * 154, y - (i // 2) * 30, sig, fill="white", txt="navy", size=7.2)
    card(c, 430, 112, 350, 138, fill="white", radius=24)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 15)
    c.drawString(458, 216, "Principio etico")
    draw_text(c, "O perfil deve ser explicavel, editavel pelo aluno e usado para apoio pedagogico. Nao deve rotular, diagnosticar ou limitar acesso a conteudos.", 458, 193, 285, size=10, fill="muted")


def page_player(c):
    page_bg(c, 6)
    draw_title(c, "5. Mockup: Player adaptativo", "Uma unica aula, varios caminhos. O aluno pode pedir ajuda, trocar formato ou deixar o motor sugerir.", "Tela principal")
    draw_browser_frame(c, 54, 82, 735, 390, "noseutempo.app/player/aula-123")
    # left content
    card(c, 78, 115, 440, 300, fill="cream", radius=18, shadow=False)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 18)
    c.drawString(102, 383, "Como funciona a memoria?")
    draw_text(c, "A memoria guarda informacoes em etapas. Primeiro percebemos, depois organizamos, repetimos e conectamos com algo que ja conhecemos.", 102, 354, 355, size=10.5, fill="muted")
    set_fill(c, "soft_mint")
    c.roundRect(102, 250, 170, 86, 16, fill=1, stroke=0)
    set_fill(c, "teal_dark")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(122, 305, "Resumo simples")
    draw_text(c, "1 ideia por vez\nPalavras mais claras\nExemplo do cotidiano", 122, 285, 125, size=8.5, fill="navy")
    set_fill(c, "lav")
    c.roundRect(290, 250, 170, 86, 16, fill=1, stroke=0)
    set_fill(c, "purple")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(310, 305, "Mapa visual")
    draw_text(c, "Conceitos ligados\nCores por etapa\nMenos texto", 310, 285, 125, size=8.5, fill="navy")
    mini_bar(c, 102, 172, 360, .42, bg="lav2", fg="teal")
    draw_text(c, "Progresso nesta aula: 42%", 102, 154, 200, size=8.5, fill="muted")
    pill(c, 102, 122, "Continuar em passos pequenos", fill="teal", txt="white", size=9)
    # right panel
    card(c, 542, 115, 220, 300, fill="white", radius=18, shadow=False)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 14)
    c.drawString(562, 383, "Adaptar agora")
    opts = [("Texto simples", "ativo"), ("Audio narrado", ""), ("Imagem", ""), ("Jogo rapido", ""), ("Perguntar a Geni", "")]
    y = 348
    for label, active in opts:
        set_fill(c, "soft_mint" if active else "soft_blue")
        c.roundRect(562, y, 160, 26, 13, fill=1, stroke=0)
        set_fill(c, "teal_dark" if active else "navy")
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(576, y + 8, label)
        y -= 35
    set_fill(c, "dark_panel")
    c.roundRect(562, 150, 170, 70, 16, fill=1, stroke=0)
    set_fill(c, "white")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(580, 195, "Geni percebeu:")
    draw_text(c, "Voce voltou 3 vezes no mesmo trecho. Quer uma explicacao com exemplo?", 580, 178, 128, size=7.8, fill="white")


def page_player_modes(c):
    page_bg(c, 7)
    draw_title(c, "6. Estados do player", "O player combina controle do aluno, sugestao da IA e regras pedagogicas aprovadas pela instituicao.", "UX adaptativa")
    modes = [
        ("Modo Leitura Leve", "Texto curto, destaque de palavras-chave, fonte maior, menos densidade e checagens pequenas."),
        ("Modo Visual", "Infografico, mapa mental, linha do tempo, exemplos concretos e imagem gerada/aprovada."),
        ("Modo Audio", "Narracao pausada, transcricao, controle de velocidade e marcadores de revisao."),
        ("Modo Jogo", "Perguntas em missao, recompensa leve, feedback sem punicao e repeticao inteligente."),
        ("Modo Conversa", "Geni explica de outro jeito, faz analogias e pergunta se o aluno quer tentar novamente."),
        ("Modo Professor", "O aluno ve a aula original sem adaptacao, quando preferir ou quando a regra exigir."),
    ]
    for i, (t, b) in enumerate(modes):
        x = 54 + (i % 3) * 250
        y = 350 - (i // 3) * 165
        card(c, x, y, 218, 125, fill="white", radius=22)
        small_icon(c, x + 18, y + 75, str(i + 1), fill=["lav", "soft_mint", "soft_blue", "soft_orange", "yellow", "lav2"][i], txt=["purple", "teal_dark", "blue", "orange", "navy", "purple"][i])
        set_fill(c, "navy")
        c.setFont("Helvetica-Bold", 12.8)
        c.drawString(x + 64, y + 94, t)
        draw_text(c, b, x + 20, y + 62, 178, size=8.8, fill="muted")
    card(c, 72, 78, 700, 70, fill="dark_panel", stroke="dark_panel", radius=22)
    set_fill(c, "white")
    c.setFont("Helvetica-Bold", 13)
    c.drawString(98, 118, "Regra de ouro")
    draw_text(c, "O aluno nunca fica preso em uma adaptacao. Ele pode voltar, comparar com a aula original e dizer o que ajudou ou nao.", 98, 99, 620, size=10, fill="white")


def page_journey(c):
    page_bg(c, 8)
    draw_title(c, "7. Jornada do aluno", "Do primeiro acesso ao aprendizado persistente, a experiencia precisa parecer cuidado, nao fiscalizacao.", "Experiencia")
    steps = [
        ("1. Entrada", "Aluno abre a aula no LMS, WordPress ou NoSeuTempo."),
        ("2. Check-in leve", "Pergunta opcional: energia, tempo disponivel e preferencia do dia."),
        ("3. Aula original", "Conteudo principal permanece acessivel e preservado."),
        ("4. Sinais", "Pausa, replay, erro ou pedido de ajuda ativam sugestoes."),
        ("5. Rota adaptada", "Player oferece formato alternativo sem expor o aluno."),
        ("6. Confirmacao", "Aluno responde se entendeu, quer praticar ou quer outra explicacao."),
        ("7. Registro", "Sistema guarda o que funcionou e ajusta proximas aulas."),
    ]
    x0, y0 = 70, 410
    for i, (t, b) in enumerate(steps):
        x = x0 + (i % 4) * 180
        y = y0 - (i // 4) * 180
        card(c, x, y, 150, 115, fill="white", radius=20)
        small_icon(c, x + 16, y + 65, str(i + 1), fill="lav" if i % 2 == 0 else "soft_mint", txt="purple" if i % 2 == 0 else "teal_dark")
        set_fill(c, "navy")
        c.setFont("Helvetica-Bold", 10.5)
        c.drawString(x + 58, y + 85, t)
        draw_text(c, b, x + 16, y + 52, 115, size=8.2, fill="muted")
        if i < 6 and i % 4 != 3:
            diagram_arrow(c, x + 150, y + 58, x + 178, y + 58, "muted")
    diagram_arrow(c, x0 + 3 * 180 + 75, y0 - 20, x0 + 3 * 180 + 75, y0 - 145, "muted")
    card(c, 420, 82, 330, 92, fill="soft_mint", stroke="soft_mint", radius=22)
    set_fill(c, "teal_dark")
    c.setFont("Helvetica-Bold", 14)
    c.drawString(448, 138, "Tom de voz do produto")
    draw_text(c, "Apoio sem julgamento. Ritmo sem infantilizar. Personalizacao sem rotular.", 448, 116, 260, size=10, fill="navy")


def page_admin(c):
    page_bg(c, 9)
    draw_title(c, "8. Mockup: Painel da instituicao", "Quem cria ou hospeda o curso precisa enxergar onde o conteudo falha e como melhorar.", "Professor/Admin")
    draw_browser_frame(c, 54, 82, 735, 390, "admin.noseutempo.app/conteudos")
    # sidebar
    set_fill(c, "dark_panel")
    c.roundRect(54, 82, 160, 352, 0, fill=1, stroke=0)
    set_fill(c, "white")
    c.setFont("Helvetica-Bold", 13)
    c.drawString(78, 392, "NoSeuTempo")
    for i, item in enumerate(["Conteudos", "Conversoes", "Alunos", "Insights", "Plugin"]):
        set_fill(c, "teal" if i == 1 else "white", .95 if i == 1 else .12)
        c.roundRect(75, 350 - i * 42, 112, 28, 10, fill=1, stroke=0)
        set_fill(c, "white")
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(90, 359 - i * 42, item)
    # main dashboard
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 18)
    c.drawString(240, 392, "Conversoes e impacto")
    stats = [("74%", "mais conclusao"), ("38%", "menos abandono"), ("312", "rotas adaptadas"), ("19", "aulas com alerta")]
    for i, (num, lab) in enumerate(stats):
        card(c, 240 + i * 126, 326, 110, 52, fill="white", radius=14, shadow=False)
        set_fill(c, ["teal", "purple", "blue", "orange"][i])
        c.setFont("Helvetica-Bold", 16)
        c.drawString(258 + i * 126, 354, num)
        draw_text(c, lab, 258 + i * 126, 340, 76, size=7.2, fill="muted")
    card(c, 240, 170, 300, 130, fill="white", radius=18, shadow=False)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(262, 274, "Onde os alunos travam")
    bars = [("Modulo 2 - Aula 4", .82), ("Quiz final", .64), ("Video longo", .51)]
    yy = 246
    for label, pct in bars:
        draw_text(c, label, 262, yy, 150, size=7.6, fill="muted")
        mini_bar(c, 385, yy + 2, 110, pct, bg="lav2", fg="orange")
        yy -= 34
    card(c, 560, 170, 190, 130, fill="soft_blue", stroke="soft_blue", radius=18, shadow=False)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(582, 274, "Acoes sugeridas")
    draw_text(c, "Gerar versao visual\nAdicionar exemplo concreto\nReduzir densidade do bloco\nCriar pratica guiada", 582, 250, 150, size=8.4, fill="muted")
    pill(c, 582, 188, "Converter aula", fill="teal", txt="white", size=8)


def page_wordpress_settings(c):
    page_bg(c, 10)
    draw_title(c, "9. Plugin WordPress", "O caminho mais rapido para entrar em cursos existentes: instalar plugin, conectar API e inserir player por bloco ou shortcode.", "Integracao")
    draw_browser_frame(c, 54, 86, 735, 382, "wp-admin/admin.php?page=noseutempo")
    set_fill(c, "#f0f0f1")
    c.rect(55, 87, 734, 344, fill=1, stroke=0)
    set_fill(c, "#1d2327")
    c.rect(55, 87, 150, 344, fill=1, stroke=0)
    set_fill(c, "white")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(76, 398, "WordPress")
    for i, item in enumerate(["Dashboard", "Posts", "Cursos", "NoSeuTempo", "Plugins"]):
        set_fill(c, "teal" if item == "NoSeuTempo" else "white", .9 if item == "NoSeuTempo" else .18)
        c.roundRect(73, 360 - i * 36, 108, 24, 7, fill=1, stroke=0)
        set_fill(c, "white")
        c.setFont("Helvetica", 8)
        c.drawString(86, 368 - i * 36, item)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 18)
    c.drawString(230, 390, "NoSeuTempo Adaptive Layer")
    fields = [
        ("API Key", "nst_live_xxxxxxxxxxxxxxxxx"),
        ("Instituicao", "Faculdade / Empresa / Escola"),
        ("Modo padrao", "Sugerir adaptacao automaticamente"),
        ("Privacidade", "Anonimizar dados por turma"),
    ]
    y = 345
    for label, value in fields:
        set_fill(c, "muted")
        c.setFont("Helvetica-Bold", 8)
        c.drawString(234, y + 24, label)
        card(c, 234, y, 310, 24, fill="white", radius=7, shadow=False)
        draw_text(c, value, 244, y + 8, 285, size=7.5, fill="ink")
        y -= 48
    card(c, 575, 180, 175, 170, fill="white", radius=16, shadow=False)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(595, 320, "Status")
    draw_text(c, "Conectado\n12 aulas convertidas\n4 players ativos\nUltima sync: hoje", 595, 294, 130, size=9, fill="muted")
    pill(c, 595, 205, "Testar conexao", fill="teal", txt="white", size=8)


def page_wordpress_editor(c):
    page_bg(c, 11)
    draw_title(c, "10. WordPress: editor e front-end", "O plugin deve funcionar para criadores sem codigo, mas tambem oferecer shortcode e API para times tecnicos.", "Bloco + shortcode")
    # editor
    card(c, 52, 104, 350, 330, fill="white", radius=24)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 15)
    c.drawString(80, 400, "Gutenberg: bloco NoSeuTempo")
    card(c, 80, 322, 294, 48, fill="soft_blue", stroke="soft_blue", radius=13, shadow=False)
    draw_text(c, "Aula: Introducao a seguranca no trabalho", 98, 350, 250, size=9, fill="navy")
    card(c, 80, 252, 294, 48, fill="soft_mint", stroke="soft_mint", radius=13, shadow=False)
    draw_text(c, "Player: adaptativo automatico", 98, 280, 250, size=9, fill="navy")
    card(c, 80, 182, 294, 48, fill="lav2", stroke="lav2", radius=13, shadow=False)
    draw_text(c, "Permitir: texto simples, audio, Geni, quiz", 98, 210, 250, size=9, fill="navy")
    set_fill(c, "dark_panel")
    c.roundRect(80, 128, 294, 30, 12, fill=1, stroke=0)
    set_fill(c, "white")
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(227, 138, "[noseutempo_player lesson='seguranca-01']")
    # frontend
    draw_browser_frame(c, 430, 104, 360, 330, "curso.com/aula/seguranca")
    set_fill(c, "cream")
    c.roundRect(455, 135, 310, 245, 16, fill=1, stroke=0)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 15)
    c.drawString(478, 350, "Aula original do curso")
    draw_text(c, "Video, texto ou conteudo do professor continua aqui. O plugin adiciona uma camada de apoio sem sequestrar a plataforma.", 478, 326, 250, size=9, fill="muted")
    set_fill(c, "teal")
    c.roundRect(585, 156, 160, 34, 17, fill=1, stroke=0)
    set_fill(c, "white")
    c.setFont("Helvetica-Bold", 9)
    c.drawString(604, 168, "Adaptar com NoSeuTempo")
    card(c, 500, 205, 230, 82, fill="white", radius=18, shadow=True)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(522, 260, "Precisa de outro caminho?")
    draw_text(c, "Abrir texto simples, audio, imagem ou conversa com a Geni.", 522, 242, 180, size=8, fill="muted")


def page_lms(c):
    page_bg(c, 12)
    draw_title(c, "11. LMS, faculdade e curso corporativo", "Para ambientes maiores, o NoSeuTempo deve entrar como padrao interoperavel: LTI, SCORM/xAPI, iframe seguro ou SDK JavaScript.", "Integracoes")
    lanes = [
        ("LTI 1.3", "Ideal para Moodle, Canvas e Blackboard. Login federado, contexto da turma e notas."),
        ("SCORM/xAPI", "Para relatorios em LMS corporativo. Registra progresso, conclusao, tentativas e eventos de adaptacao."),
        ("JavaScript SDK", "Para plataformas proprias. Um script injeta botao, player e eventos na aula existente."),
        ("API Headless", "Para instituicoes com app proprio. Envia conteudo, recebe rotas adaptadas e analytics."),
    ]
    for i, (t, b) in enumerate(lanes):
        x = 60 + (i % 2) * 370
        y = 330 - (i // 2) * 150
        card(c, x, y, 320, 110, fill="white", radius=22)
        small_icon(c, x + 20, y + 58, str(i + 1), fill=["lav", "soft_mint", "soft_blue", "soft_orange"][i], txt=["purple", "teal_dark", "blue", "orange"][i])
        set_fill(c, "navy")
        c.setFont("Helvetica-Bold", 14)
        c.drawString(x + 68, y + 83, t)
        draw_text(c, b, x + 68, y + 60, 220, size=9, fill="muted")
    card(c, 92, 82, 660, 75, fill="dark_panel", stroke="dark_panel", radius=22)
    set_fill(c, "white")
    c.setFont("Helvetica-Bold", 13)
    c.drawString(120, 124, "Experiencia para a instituicao")
    draw_text(c, "Nao trocar de LMS. Adicionar uma camada de inclusao mensuravel, governada e reversivel sobre as aulas que ja existem.", 120, 105, 590, size=10, fill="white")


def page_converter(c):
    page_bg(c, 13)
    draw_title(c, "12. Tela de conversao de conteudo", "O criador acompanha o que entrou, o que foi gerado, o que precisa revisao e o que esta publicado.", "Content Studio")
    draw_browser_frame(c, 54, 80, 735, 392, "studio.noseutempo.app/converter")
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 18)
    c.drawString(88, 402, "Converter aula")
    card(c, 88, 285, 220, 85, fill="soft_blue", stroke="soft_blue", radius=16, shadow=False)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(108, 344, "1. Entrada")
    draw_text(c, "Upload de PDF, video, slide, URL, HTML ou pacote SCORM.", 108, 325, 170, size=8.5, fill="muted")
    card(c, 330, 285, 220, 85, fill="lav2", stroke="lav2", radius=16, shadow=False)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(350, 344, "2. Analise")
    draw_text(c, "Objetivos, vocabulario, densidade, pontos de travamento e nivel.", 350, 325, 170, size=8.5, fill="muted")
    card(c, 572, 285, 170, 85, fill="soft_mint", stroke="soft_mint", radius=16, shadow=False)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(592, 344, "3. Gerar rotas")
    draw_text(c, "Texto, audio, imagem, quiz, Geni.", 592, 325, 120, size=8.5, fill="muted")
    card(c, 88, 145, 300, 110, fill="white", radius=18, shadow=False)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(108, 228, "Revisao pedagogica")
    draw_text(c, "Aprovar rotas geradas, editar linguagem, bloquear topicos sensiveis e definir quando cada formato pode aparecer.", 108, 206, 235, size=8.8, fill="muted")
    card(c, 420, 145, 322, 110, fill="white", radius=18, shadow=False)
    set_fill(c, "navy")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(440, 228, "Publicacao")
    draw_text(c, "Gerar embed, shortcode, link LTI, pacote SCORM/xAPI ou publicar no player nativo do NoSeuTempo.", 440, 206, 245, size=8.8, fill="muted")
    pill(c, 440, 165, "Publicar versao 1.0", fill="teal", txt="white", size=8)


def page_rules(c):
    page_bg(c, 14)
    draw_title(c, "13. Motor de adaptacao", "A adaptacao deve ser explicavel: sinais entram, regras decidem, formatos saem, resultados atualizam o perfil.", "Regras")
    card(c, 62, 100, 720, 335, fill="white", radius=26)
    columns = [
        ("Sinais", ["tempo parado", "repeticao", "erro recorrente", "baixa confianca", "pedido de ajuda"]),
        ("Hipoteses", ["texto denso", "conceito abstrato", "ritmo rapido", "memoria de trabalho", "sobrecarga emocional"]),
        ("Acoes", ["simplificar", "visualizar", "narrar", "quebrar em passos", "praticar em jogo", "conversar com Geni"]),
        ("Aprendizado", ["entendeu?", "tentou de novo", "concluiu", "preferiu formato", "professor revisou"]),
    ]
    for i, (title, arr) in enumerate(columns):
        x = 90 + i * 170
        set_fill(c, ["purple", "blue", "teal_dark", "orange"][i])
        c.setFont("Helvetica-Bold", 13)
        c.drawString(x, 390, title)
        for j, item in enumerate(arr):
            pill(c, x, 352 - j * 38, item, fill=["lav2", "soft_blue", "soft_mint", "soft_orange"][i], txt="navy", size=7.8)
        if i < 3:
            diagram_arrow(c, x + 120, 292, x + 158, 292, "muted")
    card(c, 102, 130, 640, 74, fill="dark_panel", stroke="dark_panel", radius=20)
    set_fill(c, "white")
    c.setFont("Helvetica-Bold", 13)
    c.drawString(130, 172, "Exemplo")
    draw_text(c, "Se o aluno repete um trecho 3 vezes e erra o check-in, o player sugere explicacao visual curta. Se ele entende, esse formato ganha peso para aulas parecidas.", 130, 153, 555, size=9.5, fill="white")


def page_privacy(c):
    page_bg(c, 15)
    draw_title(c, "14. Dados, privacidade e governanca", "Instituicoes so adotam se houver seguranca, LGPD, controle de autoria e transparencia.", "Confianca")
    cards = [
        ("Minimo necessario", "Coletar apenas eventos pedagogicos essenciais. Separar identidade, turma e dados sensiveis."),
        ("Consentimento", "Explicar por que o perfil existe, permitir opt-out e ajustes pelo aluno ou responsavel."),
        ("Autoria preservada", "Conteudo original, autor, versao e instituicao ficam registrados no manifesto da aula."),
        ("Human-in-the-loop", "Professor ou equipe revisa adaptacoes de conteudos sensiveis antes da publicacao."),
        ("Ambiente seguro", "API keys por instituicao, tokens curtos, logs de acesso e isolamento de tenants."),
        ("Nao diagnosticar", "O sistema apoia dificuldades de aprendizagem. Nao faz diagnostico clinico nem rotula alunos."),
    ]
    for i, (t, b) in enumerate(cards):
        x = 58 + (i % 3) * 250
        y = 338 - (i // 3) * 150
        card(c, x, y, 220, 112, fill="white", radius=22)
        small_icon(c, x + 18, y + 62, str(i + 1), fill="soft_mint" if i % 2 else "lav", txt="teal_dark" if i % 2 else "purple")
        set_fill(c, "navy")
        c.setFont("Helvetica-Bold", 12)
        c.drawString(x + 62, y + 84, t)
        draw_text(c, b, x + 20, y + 52, 180, size=8.6, fill="muted")


def page_business(c):
    page_bg(c, 16)
    draw_title(c, "15. Modelos de implantacao", "O mesmo nucleo pode virar produto SaaS, plugin, camada white-label ou solucao corporativa.", "Go-to-market")
    rows = [
        ("SaaS NoSeuTempo", "Alunos e cursos dentro da plataforma propria.", "Mais controle de experiencia e dados."),
        ("Plugin WordPress", "Cursos, escolas menores e produtores de conteudo.", "Entrada rapida no mercado e baixo atrito."),
        ("LMS corporativo", "Empresas com treinamento obrigatorio e compliance.", "Valor em conclusao, acessibilidade e relatorios."),
        ("Faculdades/AVA", "Moodle, Canvas, Blackboard ou ambiente proprio.", "Inclusao institucional com governanca."),
        ("White-label/API", "Edtechs e plataformas que querem adaptar sem aparecer NoSeuTempo.", "Receita B2B, integracao mais profunda."),
    ]
    y = 392
    for i, (model, target, value) in enumerate(rows):
        fill = "white" if i % 2 == 0 else "soft_blue"
        card(c, 70, y - 45, 700, 52, fill=fill, stroke=fill, radius=16, shadow=False)
        set_fill(c, "purple")
        c.setFont("Helvetica-Bold", 10)
        c.drawString(94, y - 12, model)
        draw_text(c, target, 250, y - 8, 230, size=8.5, fill="muted")
        draw_text(c, value, 510, y - 8, 220, size=8.5, fill="navy")
        y -= 65
    set_fill(c, "muted")
    c.setFont("Helvetica-Bold", 8)
    c.drawString(250, 420, "Cliente ideal")
    c.drawString(510, 420, "Por que compra")


def page_roadmap(c):
    page_bg(c, 17)
    draw_title(c, "16. MVP e roadmap", "Comecar pequeno, provar aprendizado, depois ampliar formatos e integracoes.", "90 dias")
    phases = [
        ("0-30 dias", "Plugin demo + player", ["Player web", "Shortcode WordPress", "Perfil simples", "Texto simples + Geni"]),
        ("31-60 dias", "Conversor revisavel", ["Upload PDF/HTML", "Manifesto da aula", "Painel de revisao", "Analytics basico"]),
        ("61-90 dias", "Piloto institucional", ["Turmas reais", "Eventos xAPI", "Relatorio professor", "LGPD e consentimento"]),
        ("Depois", "Escala", ["LTI 1.3", "SCORM empacotado", "White-label", "Marketplace de adaptacoes"]),
    ]
    for i, (phase, title, bullets) in enumerate(phases):
        x = 54 + i * 190
        card(c, x, 150, 165, 275, fill="white", radius=24)
        pill(c, x + 18, 386, phase, fill=["lav", "soft_mint", "soft_blue", "soft_orange"][i], txt=["purple", "teal_dark", "blue", "orange"][i], size=8)
        set_fill(c, "navy")
        c.setFont("Helvetica-Bold", 13)
        draw_text(c, title, x + 18, 352, 125, size=12.5, font="Helvetica-Bold", fill="navy")
        y = 302
        for b in bullets:
            set_fill(c, "teal")
            c.circle(x + 23, y + 3, 3, fill=1, stroke=0)
            draw_text(c, b, x + 34, y + 7, 110, size=8.8, fill="muted")
            y -= 34
    card(c, 84, 78, 674, 46, fill="dark_panel", stroke="dark_panel", radius=18)
    draw_text(c, "Objetivo do MVP: provar que a camada adaptativa aumenta compreensao, permanencia e satisfacao sem obrigar a instituicao a trocar sua plataforma.", 108, 102, 620, size=9.5, fill="white")


def page_metrics(c):
    page_bg(c, 18)
    draw_title(c, "17. Metricas de sucesso", "O produto precisa provar inclusao com dados de aprendizagem, nao apenas cliques.", "Indicadores")
    metrics = [
        ("Aprendizagem", ["taxa de conclusao", "acerto apos adaptacao", "retentativas bem-sucedidas"]),
        ("Acessibilidade real", ["formatos usados", "queda de abandono", "alunos que pedem outro caminho"]),
        ("Professor", ["aulas com maior travamento", "tempo de revisao", "adaptacoes aprovadas"]),
        ("Negocio", ["ativacao do plugin", "aulas convertidas", "MRR por instituicao"]),
    ]
    for i, (title, arr) in enumerate(metrics):
        x = 62 + (i % 2) * 370
        y = 312 - (i // 2) * 150
        card(c, x, y, 320, 115, fill="white", radius=22)
        set_fill(c, ["purple", "teal_dark", "blue", "orange"][i])
        c.setFont("Helvetica-Bold", 14)
        c.drawString(x + 24, y + 82, title)
        yy = y + 55
        for item in arr:
            set_fill(c, "muted")
            c.setFont("Helvetica", 8.8)
            c.drawString(x + 34, yy, "- " + item)
            yy -= 22
    card(c, 82, 82, 680, 72, fill="soft_mint", stroke="soft_mint", radius=22)
    set_fill(c, "teal_dark")
    c.setFont("Helvetica-Bold", 14)
    c.drawString(110, 124, "Proxima decisao")
    draw_text(c, "Escolher o primeiro piloto: WordPress de cursos, LMS corporativo ou uma turma dentro do NoSeuTempo. A decisao muda o MVP, mas nao muda o nucleo: converter, adaptar, medir e aprender.", 110, 104, 610, size=9.8, fill="navy")


PAGES = [
    cover,
    page_executive,
    page_modules,
    page_pipeline,
    page_profile,
    page_player,
    page_player_modes,
    page_journey,
    page_admin,
    page_wordpress_settings,
    page_wordpress_editor,
    page_lms,
    page_converter,
    page_rules,
    page_privacy,
    page_business,
    page_roadmap,
    page_metrics,
]


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    c.setTitle("NoSeuTempo - Plano Produto Adaptativo")
    c.setAuthor("NoSeuTempo / Codex")
    for render in PAGES:
        render(c)
        c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()

