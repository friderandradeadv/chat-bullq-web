"""
Roteiro visual de cada aula: em que segundo entra cada tela.

Os tempos vêm da transcrição (o .vtt da aula), não de chute — cada corte cai
numa pausa da narração, entre um assunto e o seguinte. Para levantá-los:

    curl -s .../academia/<slug>.vtt | grep ' --> '

Regra ao escrever: a tela acompanha o que está sendo dito. Slide que fica
parado enquanto a narração já mudou de assunto é pior que slide nenhum, porque
compete com quem escuta.
"""

ROTEIROS = {
    # 2.2 — O foco do Início (2:34). Sete blocos, medidos no vtt de 59 deixas.
    'inicio': {
        'duracao': 154.0,
        'cenas': [
            {'t': 0.0, 'tipo': 'abertura',
             'etiqueta': 'Trilha 2 · Aula 2',
             'titulo': 'O Foco do Início',
             'sub': ['A mesa de trabalho diária: o que abrir primeiro,',
                     'e o que nunca deixar para depois.']},

            # 10.5s: "o objetivo desse painel é dar clareza sobre as responsabilidades do dia"
            {'t': 10.5, 'tipo': 'frase', 'secao': 'Para que serve',
             'linhas': ['“O que está esperando', 'por mim agora?”'],
             'rodape': 'A tela inteira existe para responder a esta pergunta.'},

            # 41.0s: "na prática, a interface apresenta as conversas, tarefas, publicações"
            {'t': 41.0, 'tipo': 'tela', 'secao': 'A mesa de trabalho',
             'titulo': 'Início', 'print': 'inicio-mesa'},

            # 63.8s: "o filtro dessa tela é estritamente pessoal"
            {'t': 63.8, 'tipo': 'contraste', 'secao': 'O filtro é pessoal',
             'esquerda': {'rotulo': 'O que o Início mostra', 'titulo': 'Você',
                          'manda': True,
                          'linhas': ['Só as suas pendências.', 'Lista curta de manhã não quer dizer',
                                     'escritório parado — quer dizer que há', 'menos coisa designada a você.']},
             'direita': {'rotulo': 'O que ele não mostra', 'titulo': 'O escritório',
                         'linhas': ['A fila das outras equipes.', 'O volume delas pode estar alto;',
                                    'esta visão protege a sua', 'concentração.']}},

            # 92.8s: "uma rotina de abertura do dia, dividida em quatro passos"
            {'t': 92.8, 'tipo': 'passos', 'secao': 'Rotina de abertura', 'ate': 1,
             'titulo': 'Todo dia, nesta ordem',
             'passos': ['Limpar as publicações', 'Tratar as conversas pendentes',
                        'Conferir a agenda da semana', 'Mover os cards do Kanban']},
            {'t': 100.5, 'tipo': 'passos', 'secao': 'Rotina de abertura', 'ate': 2,
             'titulo': 'Todo dia, nesta ordem',
             'passos': ['Limpar as publicações', 'Tratar as conversas pendentes',
                        'Conferir a agenda da semana', 'Mover os cards do Kanban']},
            {'t': 104.0, 'tipo': 'passos', 'secao': 'Rotina de abertura', 'ate': 3,
             'titulo': 'Todo dia, nesta ordem',
             'passos': ['Limpar as publicações', 'Tratar as conversas pendentes',
                        'Conferir a agenda da semana', 'Mover os cards do Kanban']},
            {'t': 106.0, 'tipo': 'passos', 'secao': 'Rotina de abertura', 'ate': 4,
             'titulo': 'Todo dia, nesta ordem',
             'passos': ['Limpar as publicações', 'Tratar as conversas pendentes',
                        'Conferir a agenda da semana', 'Mover os cards do Kanban']},

            # 110.5s: "a justificativa para essa ordem é estritamente técnica"
            {'t': 110.5, 'tipo': 'contraste', 'secao': 'Por que nesta ordem',
             'esquerda': {'rotulo': 'Publicação do tribunal', 'titulo': 'Preclui',
                          'manda': True,
                          'linhas': ['Gera prazo. Prazo perdido', 'não volta.', '',
                                     'Por isso vem primeiro.']},
             'direita': {'rotulo': 'Conversa de cliente', 'titulo': 'Não preclui',
                         'linhas': ['Exige retorno rápido,', 'mas não fecha porta nenhuma.', '',
                                    'Vem logo depois.']}},

            # 126.0s: "uma regra fundamental sobre o sino de notificações e a agenda"
            {'t': 126.0, 'tipo': 'contraste', 'secao': 'Sino e agenda',
             'esquerda': {'rotulo': 'O sino', 'titulo': 'Lembra',
                          'linhas': ['Alerta pontual.', 'Ajuda, mas não é controle.']},
             'direita': {'rotulo': 'A agenda', 'titulo': 'Controla',
                         'manda': True,
                         'linhas': ['O prazo se confere aqui.', 'A notificação nunca substitui',
                                    'o hábito de olhar a pauta', 'da semana inteira.']}},

            # 144.0s: fecho — "o prazo processual se confere na agenda"
            {'t': 144.0, 'tipo': 'frase', 'secao': 'Fecho', 'corpo': 58,
             'linhas': ['O prazo se confere na agenda.'],
             'rodape': 'Academia Frider · Trilha 2, aula 2'},
        ],
    },
}
