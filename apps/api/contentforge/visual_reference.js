'use strict';

const COURSE_VISUAL_DNA = `
DNA visual NoSeuTempo, inspirado no mapa visual de 11 telas:
- Interface limpa, acolhedora e mobile-first; fundo branco/quase branco com roxo claro, roxo escuro, verde calmo e detalhes quentes.
- Tudo deve parecer feito "sem pressa": poucos elementos por tela, bastante respiro, bordas arredondadas, sombras suaves e texto curto.
- Geni IA aparece como apoio gentil e criadora visual principal. Nao use a Turminha como base da cena.
- Use imagens fofas e didaticas no centro da aula: paisagens simples, plantinhas, folhas felizes, sol/gota/nuvem com rostinhos, estrelas discretas e pequenos objetos de estudo.
- O visual deve explicar antes do texto. Se a aula falar de um conceito, crie uma cena concreta com comeco, meio e fim visual.
- Para perfis neurodivergentes: baixa carga visual, hierarquia clara, nada piscando, nada caotico, contraste suave e uma ideia por cena.
- Evite telas genericas de SaaS. A aula deve parecer um espaco de aprendizagem vivo criado pela Geni, com microhistorias e objetos fofos.
`.trim();

const LESSON_VISUAL_BLUEPRINT = `
Modelo da Tela 4 - A aula:
- Topo: selo da etapa + indicador de progresso "passo X de Y - sem pressa".
- Hero visual: uma grande ilustracao explicativa. Exemplo de referencia: colinas verdes, ceu azul, Sol fofo + Gota de agua fofa + Nuvem/ar fofa -> Folha feliz.
- Texto: uma analogia curta logo abaixo da imagem, como "A folha e como uma pequena cozinha".
- Caixa da Geni: fundo roxo bem claro, icone/personagem e uma historinha de uma frase.
- Ajuda adaptativa: chips como ouvir, mais simples, em topicos, conta como historia, me da um exemplo, ajustar leitura, modo foco, ver com imagens.
- Rodape: voltar, "nao entendi ainda" e proximo passo, com linguagem acolhedora.
- Cada bloco gerado deve conseguir virar uma cena assim: fundo, personagem, objeto fofo, analogia visual, acao simples e ajuda da Geni.
`.trim();

const SCREEN_DETAIL_REFERENCE = `
Referencia resumida das 11 telas:
1. Conhecendo seu jeito: Geni pergunta como a pessoa aprende; chips de perfil, modos de aprender e temas favoritos; plantinha com estrelas.
2. Como prefere aprender hoje: cartoes de Foco, Visual, Leitura facilitada, Neurodivergente e Audio; caixa roxo-clara dizendo que modos podem combinar.
3. Minhas aulas: aula atual em destaque com progresso, chips audio+imagem/frases curtas/exemplos, outras formas de estudar e tema favorito com dinossauro fofo.
4. A aula: grande ilustracao didatica kawaii, analogia curta, caixa de historinha da Geni, chips de ajuda e navegacao sem pressa.
5. Sua rotina de estudos: cartoes de rotina e horario, com check no selecionado e mensagem de permissao para mudar de ideia.
6. Vamos testar juntos: folha feliz em paisagem verde, quiz 2x2 com opcoes visuais, dica, rever explicacao e texto de tentativa sem pressao.
7. Conclui, no meu tempo: folha com capelo roxo, confetes, estatisticas simples, revisao calma e proxima aula.
8. Geni IA percebe: cartoes mostrando padroes de aprendizagem e temas que prendem atencao; pede permissao para salvar como padrao.
9. Seu proximo passo: cartao da proxima aula com imagem de planta brotando, chips adaptativos, revisao curta e historinha alternativa.
10. Resumo da jornada: cartoes sobre jeito de aprender, temas favoritos e progresso; promessa da Geni de continuar com leveza.
11. Minha pagina inicial: continuar aula, acoes rapidas, temas favoritos e conquistas, sempre com chips, setas e botoes claros.
`.trim();

module.exports = {
  COURSE_VISUAL_DNA,
  LESSON_VISUAL_BLUEPRINT,
  SCREEN_DETAIL_REFERENCE,
};
