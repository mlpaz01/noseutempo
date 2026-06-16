'use strict';

const TURMINHA_STYLE = [
  'Use Geni IA as the recurring NoSeuTempo visual creator and learning guide for every explanatory image and video.',
  'Overall look: warm 3D animated educational helper, soft rounded forms, calm expressions, gentle teal/violet/amber accents, no harsh contrast, no scary faces.',
  'Geni: cute small white-and-teal robot assistant, glossy black face screen, glowing cyan eyes and smile, small antenna, kind helper pose, expressive hands, warm teacher energy.',
  'Geni creates the learning scene instead of a group cast: she can point, hold a card, project a simple visual, arrange objects on a table, or show a calm metaphor in the background.',
  'When a human learner is needed, keep them generic and secondary, never the visual identity. The main recurring character is always Geni.',
  'Character rules: keep Geni recognizable across scenes; do not use the old Turminha group/cast as the base. Do not invent a new mascot.',
  'Avoid readable text, logos, watermarks, photorealism, distorted hands, clutter, chaotic movement, dramatic lighting, or crowded classroom scenes.'
].join('\n');

const TURMINHA_ASSETS = {
  referenceSheet: '/assets/geni-ia-maos-sem-fundo-v2.png',
  characters: ['Geni'],
};

function turminhaPrompt(extra) {
  return [TURMINHA_STYLE, extra || ''].filter(Boolean).join('\n');
}

module.exports = {
  TURMINHA_STYLE,
  TURMINHA_ASSETS,
  turminhaPrompt,
};
