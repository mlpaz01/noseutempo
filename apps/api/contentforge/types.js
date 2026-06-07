/**
 * NoSeuTempo ContentForge — tipos de blocos
 *
 * Blocos LÚDICOS e ADAPTATIVOS para pessoas com dificuldade de aprender.
 * O mesmo conteúdo pode ser entregue em formatos diferentes (conceito →
 * exemplo → jogo → desafio de voz) até o aluno demonstrar compreensão.
 *
 * Categorias de uso:
 *   personal_ia   — IA pessoal, assistentes, prompts
 *   estudos       — técnicas de estudo, memória, aprendizagem
 *   produtividade — foco, gestão de tempo, organização
 *   neurodiversidade — TDAH, dislexia, TEA, hiperfoco
 *   carreira      — entrevistas, currículo, networking, crescimento
 *   dev_humano    — inteligência emocional, comunicação, autoconhecimento
 *   idiomas       — espanhol, inglês, outros idiomas (origem da marca)
 */

// Bloco de texto simples com imagem opcional (não assusta o aluno)
const CONCEPT    = "concept";
// Exemplo do mundo real com situação + aprendizado
const EXAMPLE    = "example";
// Múltipla escolha rápida (1 pergunta, sem pressão)
const QUICK_CHECK = "quick_check";
// Múltipla escolha elaborada com explicação rica
const MULTI_CHOICE = "multiple_choice";
// Verdadeiro ou falso (baixa ansiedade)
const TRUE_FALSE  = "true_false";
// Complete a lacuna com banco de palavras (arrastar)
const FILL_BLANK  = "fill_blank";
// Ordenar itens arrastando (visual, sem texto denso)
const DRAG_ORDER  = "drag_order";
// Conectar pares (matching game)
const MATCH_PAIRS = "match_pairs";
// Escolha de cenário (você decide) — mais narrativo
const SCENARIO    = "scenario_choice";
// Reflexão pessoal — sem certo/errado, estimula vínculo
const REFLECTION  = "reflection";
// Desafio de voz (Momento Papo) — falar em voz alta
const VOICE_CHALLENGE = "voice_challenge";
// Missão prática — tarefa offline para fazer no mundo real
const MISSION     = "mission";

module.exports = {
  CONCEPT, EXAMPLE, QUICK_CHECK, MULTI_CHOICE, TRUE_FALSE,
  FILL_BLANK, DRAG_ORDER, MATCH_PAIRS, SCENARIO, REFLECTION,
  VOICE_CHALLENGE, MISSION,
};
