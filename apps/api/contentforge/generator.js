'use strict';
/**
 * NoSeuTempo ContentForge — GENERATOR
 *
 * Gera os blocos interativos de cada aula.
 * Motor LÚDICO E ADAPTATIVO — 12 tipos de blocos incluindo
 * voice_challenge (Momento Papo) e mission (tarefa offline).
 */

const { generateJson } = require('./llm');
const { TURMINHA_STYLE } = require('./turminha');

const BLOCK_SEQUENCE = `
SEQUÊNCIA PEDAGÓGICA PROGRESSIVA (inspirada em ELE - Español Lengua Extranjera):
1. concept       — Apresenta vocabulário com IMAGEM + EMOJI (visual primeiro, texto depois)
2. example       — Situação do cotidiano com PERSONAGEM brasileiro que usa o vocabulário
3. audio_vocab   — Bloco especial: lista de palavras com instrução "Ouça e repita" (imageQuery por palavra)
4. quick_check   — Verificação rápida: 1 pergunta baseada no que ouviu/viu
5. fill_blank    — Complete a lacuna (escrita guiada com banco de palavras)
6. drag_order    — Ordene / arraste (jogo interativo)
7. match_pairs   — Conecte pares: imagem ↔ palavra ou número ↔ nome
8. scenario_choice — Situação real: "O que você diria?" com 3 opções
9. voice_challenge — "Diga em voz alta:" — lista de palavras para praticar pronúncia
10. reflection   — "Como você usaria isso hoje?"
11. mission      — (última aula da unidade) Tarefa offline prática
`;

const BLOCK_SPECS = `
ESPECIFICAÇÕES DOS BLOCOS:

concept:
  title: título curto e curioso (máx 8 palavras)
  body: explicação em 2-3 frases simples, SEM jargão. Use analogias.
  imageQuery: 2-3 palavras em inglês para foto do Unsplash
  emoji: 1 emoji que representa o conceito

example:
  character: nome de personagem brasileiro (João, Ana, Mariana...)
  scenario: situação realista do dia a dia onde o conceito aparece (2-4 frases)
  takeaway: "O que isso ensina:" — 1 frase direta
  imageQuery: english keywords for Unsplash

quick_check:
  question: pergunta direta baseada no conceito anterior
  options: 3 opções (A, B, C) — não 4
  correctIndex: 0-2
  explanation: reforço positivo + explicação (2 frases). Mesmo se errar: "Boa tentativa! ..."

multiple_choice:
  question: pergunta que aplica o conceito em situação nova
  options: 4 opções
  correctIndex: 0-3
  explanation: feedback rico e motivador

true_false:
  statement: afirmação prática (não pegadinha gramatical)
  answer: true | false
  explanation: sempre começa com "Exatamente!" ou "Quase lá!" — nunca "Errado"

fill_blank:
  template: frase com ____ no lugar da palavra-chave
  correctAnswers: [array de respostas aceitas]
  wordBank: [4-5 opções incluindo a correta]
  hint: dica gentil se o aluno travar
  explanation: confirmação motivadora

drag_order:
  instruction: "Coloque na ordem certa:"
  items: [3-4 itens embaralhados]
  correctOrder: [ordem correta]
  explanation: por que essa ordem faz sentido

match_pairs:
  instruction: "Conecte cada item com seu par:"
  leftItems: [3-4 itens]
  rightItems: [3-4 pares correspondentes]
  correctPairs: [[0,0],[1,1],[2,2]...]
  explanation: resumo do que foi conectado

scenario_choice:
  character: nome do personagem
  scenario: situação desafiadora (3-5 frases)
  question: "O que você faria?"
  choices:
    - text: primeira opção
      outcome: consequência realista
      isBest: false
    - text: melhor opção (com carinho, sem julgamento)
      outcome: consequência positiva
      isBest: true
    - text: terceira opção
      outcome: consequência neutra/negativa gentil
      isBest: false

audio_vocab:
  title: "Ouça e repita:" (sempre este título)
  words: array de objetos [{word: "lunes", translation: "segunda-feira", emoji: "📅", imageQuery: "monday calendar"}]
  instruction: instrução breve (ex: "Toque em cada palavra para ouvir a pronúncia")
  tip: dica de pronúncia (ex: "Atenção: 'miércoles' tem acento na primeira sílaba")

reflection:
  question: pergunta pessoal aberta ("Como isso se aplica à sua vida?")
  guidance: sugestão gentil de como responder (2-3 linhas)
  prompt: 1 frase para o aluno completar (ex: "Na minha vida, eu poderia...")

voice_challenge:
  instruction: "Diga em voz alta:" — texto curto para o aluno falar
  tip: dica de como pronunciar ou quando usar na vida real
  alternativeText: versão escrita para quem preferir digitar

mission:
  title: "Missão do dia:"
  description: tarefa prática offline (30 segundos a 5 minutos)
  howToReport: como o aluno "entrega" a missão (escrever, tirar foto, falar)
  motivation: mensagem de incentivo para fazer
`;

/**
 * @param {object} opts - opções gerais do curso (geminiKey, audience, etc)
 * @param {object} ctx  - contexto da aula
 * @param {string} ctx.courseTitle
 * @param {string} ctx.courseCategory
 * @param {string} ctx.unitTitle
 * @param {string} ctx.unitMotivacao
 * @param {string} ctx.lessonTitle
 * @param {string[]} ctx.previousLessonTitles
 */
async function generateLessonBlocks(opts, ctx) {
  const system = `Você é um designer instrucional do NoSeuTempo — plataforma de aprendizagem personalizada e lúdica.

PRINCÍPIOS FUNDAMENTAIS:
- Público: pessoas com TDAH, dislexia, ansiedade de aprendizagem, baixa concentração
- Tom: amigo que sabe muito, não professor sério
- Blocos curtos (max 80 palavras cada)
- NUNCA use linguagem técnica sem explicar imediatamente com analogia
- SEMPRE que errar: feedback gentil e encorajador ("Quase lá!" não "Errado!")
- O mesmo conteúdo pode aparecer de formas diferentes para fixar sem cansar

${BLOCK_SEQUENCE}

${BLOCK_SPECS}

CAMADA VISUAL/VIDEO OBRIGATORIA:
Cada bloco deve incluir no nivel raiz estes objetos:

presentation:
  stageName: uma destas etapas, em ordem pedagogica quando fizer sentido: "Ver", "Sentir", "Praticar", "Jogar", "Conversar", "Avancar"
  primaryFormat: "video" | "image" | "game"
  caption: frase curta para a cena principal
  durationLabel: "0:45" ou "1:00"
  videoScene:
    focusCharacter: "Caua" | "Carol" | "Geni" | "Bia" | "Leo" | "Nina"
    supportCharacters: array com 0 a 2 nomes da Turminha
    sceneGoal: o que a cena explica visualmente em 1 frase
    misconception: qual confusao comum esta cena resolve
    scriptBeats: 3 frases curtas, uma acao por frase, sem texto na tela
    falPrompt: prompt completo para fal.ai gerar video curto 16:9, usando a Turminha e o contexto exato do bloco
    preloadPriority: "high" | "normal" | "low"

adaptive:
  microGoal: objetivo pequeno desta etapa
  support:
    simpler: explicacao alternativa em 1 frase
    example: exemplo cotidiano em 1 frase
    hint: dica curta para destravar

Use a Turminha NoSeuTempo nos prompts visuais:
${TURMINHA_STYLE}

Retorne APENAS JSON válido:
{
  "estimatedMinutes": 3,
  "blocks": [ ...array de blocos... ]
}

Regras de composição:
- Mínimo 5 blocos, máximo 8
- Sempre 1+ concept no início
- Sempre terminar com reflection OU voice_challenge
- Incluir pelo menos 1 bloco lúdico (fill_blank | drag_order | match_pairs)
- voice_challenge: incluir quando o tema envolve comunicação/idiomas/oratória
- mission: incluir na ÚLTIMA aula de cada unidade
- Language: pt-BR coloquial e acolhedor`;

  const userMsg = `Curso: "${ctx.courseTitle}" (${ctx.courseCategory})
Unidade: "${ctx.unitTitle}"
Motivação da unidade: "${ctx.unitMotivacao || ''}"
Aula atual: "${ctx.lessonTitle}"
Aulas anteriores desta unidade: ${ctx.previousLessonTitles?.join(' / ') || '(esta é a primeira)'}
Público: ${opts.audience || 'adultos brasileiros com dificuldade de aprender'}

Gere os blocos desta aula.`;

  const { data, provider } = await generateJson({
    system, user: userMsg, temperature: 0.75, retries: 2,
    onNote: (m) => { if (opts.onNote) opts.onNote(m); },
  });
  data._provider = provider;
  return data;
}

module.exports = { generateLessonBlocks };
