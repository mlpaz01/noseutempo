# NoSeuTempo - Mapa visual detalhado das 11 telas

Origem: `C:\Users\Marcio Leandro\Downloads\NoSeuTempo_Mapa_Visual_11_Telas.pdf`.

Este documento transforma o PDF em requisitos praticos para a plataforma e para o ContentForge. A intencao e preservar a visao da Carol: aprendizagem bonita, leve, adaptativa, visual e sem pressa.

## Principios visuais obrigatorios

- Fundo branco ou quase branco, com roxo claro, roxo escuro, verde calmo e detalhes quentes.
- Cartoes e chips arredondados, bordas sutis, sombras suaves e bastante respiro.
- Geni IA sempre aparece como apoio acolhedor, com linguagem de permissao: "pode mudar depois", "sem pressa", "do seu jeito".
- A imagem principal deve explicar antes do texto: cenas fofas, concretas e didaticas.
- Para aula, usar paisagens simples, objetos com carinha quando fizer sentido, plantinhas, estrelas discretas, folhas felizes, sol, agua, nuvem e outros elementos que tornem o conceito visual.
- Ajudas adaptativas devem aparecer como chips acionaveis: ouvir, mais simples, em topicos, historia, exemplo, ajustar leitura, modo foco, ver com imagens.
- Evitar excesso de estimulo, telas densas, textos longos e prompts genericos de imagem/video.

## Telas detalhadas

### 1. Conhecendo seu jeito

Tela de onboarding em que a Geni pergunta como a pessoa aprende melhor. Deve ter selo "1 - Conhecendo seu jeito", avatar da Geni, mensagem principal, texto auxiliar, plantinha com estrelas e tres grupos de chips: perfil, preferencia de aprendizagem e temas que prendem atencao.

Detalhe importante: chips selecionados aparecem em roxo; a tela permite marcar mais de uma opcao e reforca que tudo pode mudar depois.

### 2. Como prefere aprender hoje

Tela de escolha de modo do dia. Usa cartoes horizontais com icone, titulo e descricao: Foco, Visual, Leitura facilitada, Neurodivergente e Audio. O modo selecionado tem fundo roxo claro e check.

Detalhe importante: a caixa roxo-clara informa que modos podem ser combinados durante as aulas.

### 3. Minhas aulas

Tela de continuidade. O cartao principal mostra a aula atual, progresso, chips de adaptacao e botao "continuar aula". Tambem oferece revisao rapidinha, aprender com historia e usar tema favorito.

Detalhe importante: tema favorito pode mudar o conteudo visual, como dinossauro fofo e plantinha.

### 4. A aula

Tela central da experiencia. Deve ter selo, progresso "passo X de Y - sem pressa", Geni e titulo da aula. A area principal traz uma grande ilustracao didatica.

Referencia visual do PDF: colinas verdes, ceu azul, Sol fofo + Gota de agua fofa + Nuvem/ar fofa -> Folha feliz. O texto explica com analogia: "A folha e como uma pequena cozinha". A caixa da Geni transforma a explicacao em historinha.

Detalhe importante: esta tela e a principal referencia para o motor de cursos. Cada bloco precisa gerar fundo, personagens, objetos, analogia visual, acao e chips de ajuda.

### 5. Sua rotina de estudos

Tela de rotina com cartoes para frequencia e horario: todos os dias, alguns dias, blocos intensos, manha, tarde e noite. Selecionado com roxo claro e check.

Detalhe importante: a mensagem reforca que mudar de ideia faz parte.

### 6. Vamos testar juntos

Tela de quiz sem pressao. A imagem central e uma folha feliz em paisagem verde com estrelas discretas. A pergunta usa cartoes grandes 2x2 com icones: sol, agua, ar e terra.

Detalhe importante: botoes de apoio aparecem antes da acao final: "quero uma dica" e "quero rever a explicacao".

### 7. Conclui, no meu tempo

Tela de sucesso com folha feliz usando capelo roxo, confetes e estatisticas simples: passos, atividade concluida e "do seu jeito sem pressa".

Detalhe importante: sucesso deve permitir revisar com calma ou seguir para a proxima aula.

### 8. Geni IA percebe

Tela em que a Geni mostra o que aprendeu sobre o aluno: audio + imagem, exemplos curtos, poucos estimulos e temas favoritos. Pede permissao para salvar como padrao.

Detalhe importante: o sistema nao deve rotular a pessoa de forma pesada; deve falar de preferencias praticas.

### 9. Seu proximo passo

Tela de continuacao leve, com cartao grande da proxima aula, imagem de planta brotando, chips adaptativos e opcoes alternativas como revisao curta e historinha.

Detalhe importante: sempre oferecer caminho principal e alternativas calmas.

### 10. Resumo da jornada

Tela de consolidacao com tres cartoes: como aprende melhor, temas que prendem atencao e progresso. A Geni promete continuar explicando com leveza, exemplos curtos e sem sobrecarga.

Detalhe importante: resumo e configuracao, nao avaliacao.

### 11. Minha pagina inicial

Tela inicial personalizada. Deve destacar continuar aula, acoes rapidas, temas favoritos e conquistas. Usa imagem de planta brotando, lista com setas, chips e estatisticas pequenas.

Detalhe importante: pagina inicial deve refletir o jeito configurado do aluno e manter o tom de permissao.

## Requisito para o motor de cursos

Todo bloco gerado pelo ContentForge deve trazer, alem do conteudo pedagogico, uma direcao visual concreta:

- `presentation.visualBrief`: cena completa em 2-3 frases.
- `presentation.background`: fundo especifico e calmo.
- `presentation.cuteElements`: elementos fofos/didaticos.
- `presentation.assistiveChips`: ajudas coerentes com a etapa.
- `presentation.imagePrompt`: prompt 16:9 para imagem.
- `presentation.videoScene`: ambiente, acao principal, detalhes de fundo, camera e `falPrompt`.

O resultado esperado e que o curso nao dependa de uma tela generica. A aula precisa nascer com uma imagem mental clara, bonita e adaptada ao aluno.
