'use strict';
/**
 * NoSeuTempo ContentForge — PLANNER
 *
 * Usa Gemini para planejar a estrutura do curso em unidades + aulas.
 * O prompt foi reconfigurado para o DNA do NoSeuTempo:
 *   - Aprendizagem lúdica e adaptativa
 *   - Pessoas neurodivergentes (TDAH, dislexia, baixa memória curto prazo)
 *   - Vínculos emocionais com o conteúdo
 *   - Progressão "um passo de cada vez"
 */

const { generateJson } = require('./llm');

const CATEGORIAS = {
  personal_ia:      'IA pessoal — prompts, assistentes, automações com IA',
  estudos:          'Técnicas de estudo — memória, foco, aprendizagem acelerada',
  produtividade:    'Produtividade — gestão de tempo, organização, foco profundo',
  neurodiversidade: 'Neurodiversidade — TDAH, dislexia, TEA, hiperfoco',
  carreira:         'Carreira — entrevistas, currículo, networking, crescimento',
  dev_humano:       'Desenvolvimento humano — inteligência emocional, comunicação',
  idiomas:          'Idiomas — espanhol, inglês e outros com método acolhedor',
};

/**
 * @param {object} opts
 * @param {string} opts.topic         - Tema do curso (ex: "Como usar IA no dia a dia")
 * @param {string} opts.category      - Categoria (personal_ia | estudos | ...)
 * @param {string} opts.audience      - Público-alvo
 * @param {number} opts.duration      - Duração total estimada em minutos
 * @param {string} opts.difficulty    - basico | intermediario | avancado
 * @param {string} opts.geminiKey     - API key do Gemini
 * @param {number} [opts.numUnits]    - Número de unidades (padrão automático)
 * @param {Function} [opts.onProgress]
 */
async function plan(opts) {
  const numUnits = opts.numUnits ?? (opts.duration <= 30 ? 3 : opts.duration <= 60 ? 4 : 5);
  const lessonsPer = 3;
  const catDesc  = CATEGORIAS[opts.category] || opts.category || 'Aprendizagem personalizada';

  const system = `Você é um designer instrucional especialista em microaprendizagem lúdica e adaptativa para o NoSeuTempo — uma plataforma de aprendizagem personalizada feita para pessoas que já tentaram aprender antes e não conseguiram.

CONTEXTO DA PLATAFORMA:
- Público: pessoas com TDAH, dislexia, baixa memória de curto prazo, ansiedade de aprendizagem
- Valores: sem pressão, no seu ritmo, acolhedor, celebra cada passo
- Estilo: lúdico, visual, com personagens e situações do cotidiano
- Categorias: ${catDesc}

FILOSOFIA PEDAGÓGICA:
1. "Um passo de cada vez" — cada aula tem UM conceito central, não mais
2. "Repetição com variação" — o mesmo conteúdo volta em formatos lúdicos diferentes
3. "Sem certo/errado absoluto" — erros geram aprendizado, não punição
4. "Vínculo emocional" — histórias, personagens e situações que tocam a pessoa
5. "Memória externa" — barra de progresso sempre visível, nunca se perde

ESTRUTURA OBRIGATÓRIA DE CADA AULA:
Cada aula deve seguir esta progressão em 3 fases:
FASE 1 - ENTRADA (escuta e vê): concept + audio_vocab
FASE 2 - PRÁTICA (escreve e joga): fill_blank + drag_order + match_pairs
FASE 3 - PRODUÇÃO (fala e avalia): voice_challenge + reflection + mission (última aula)

TIPOS DE AULA por posição na unidade:
- Aula 1: foco em apresentação do vocabulário (mais concept e audio_vocab)
- Aula 2: foco em prática interativa (mais fill_blank, drag_order, match_pairs)
- Aula 3 (última): foco em produção e missão (mais voice_challenge, scenario_choice, mission)

Sua tarefa: planejar a estrutura ALTO NÍVEL do curso em unidades e aulas curtas (2-4 min cada).

Retorne APENAS JSON válido neste formato:
{
  "title": "Título acolhedor e motivador do curso",
  "description": "2-3 linhas: o que a pessoa vai conseguir fazer, sem jargão técnico",
  "coverImageQuery": "english keywords for unsplash photo search",
  "tagline": "Uma frase curta estilo 'Aprenda X no seu jeito'",
  "category": "${opts.category || 'estudos'}",
  "units": [
    {
      "title": "Título curto da unidade (máx 5 palavras)",
      "description": "1 linha sobre o que será aprendido — foco no BENEFÍCIO prático",
      "icon": "🧠 | 🎯 | 💡 | 🗣️ | 🎮 | 🌱 | ⚡ | 🤝 | 🔥 | 📚",
      "motivação": "1 frase que empolgue o aluno antes de começar esta unidade",
      "lessonTitles": ["Título aula 1", "Título aula 2", "Título aula 3"]
    }
  ]
}

Requisitos OBRIGATÓRIOS:
- EXATAMENTE ${numUnits} unidades
- EXATAMENTE ${lessonsPer} aulas por unidade
- Títulos de aulas ESPECÍFICOS e CONVIDATIVOS (não genéricos)
- Progressão: da curiosidade → compreensão → prática → confiança
- Dificuldade: ${opts.difficulty}
- Idioma: pt-BR
- Tom: acolhedor, encorajador, nunca técnico/académico`;

  const userMsg = `Crie o planejamento do curso:
Tema: ${opts.topic}
Categoria: ${catDesc}
Público-alvo: ${opts.audience || 'adultos brasileiros que querem aprender de forma acessível'}
Duração total estimada: ${opts.duration} minutos`;

  if (opts.onProgress) await opts.onProgress(5, 'Planejando a estrutura do curso…');

  const { data: outline, provider } = await generateJson({
    system, user: userMsg, temperature: 0.6, retries: 2,
    onNote: (m) => { if (opts.onNote) opts.onNote(m); },
  });

  if (opts.onProgress) await opts.onProgress(15, `Estrutura criada: ${outline.title} (via ${provider})`);
  return outline;
}

module.exports = { plan, CATEGORIAS };
