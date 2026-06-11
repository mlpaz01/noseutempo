'use strict';

const TURMINHA_STYLE = [
  'Use the recurring NoSeuTempo cast as the visual base for every explanatory image and video.',
  'Overall look: warm 3D animated educational series, soft rounded forms, calm expressions, inclusive Brazilian classroom energy, gentle teal/violet/amber accents, no harsh contrast, no scary faces.',
  'Caua: Brazilian boy, about 9 years old, warm medium-brown skin, short curly dark hair, curious eyes, gentle smile, teal hoodie with a small clock patch, comfortable sneakers, often carrying a notebook. He is the learner-protagonist.',
  'Carol: Brazilian adult learning guide, curly dark hair, black rounded glasses, beige sweater, warm smile, calm mentor posture. She explains with patience and care.',
  'Geni: cute small white-and-purple robot assistant, glossy black face screen, glowing cyan eyes and smile, small antenna, kind helper pose. Geni supports without taking over the scene.',
  'Bia: Brazilian girl, about 9 years old, dark skin, braided hair with teal clips, yellow cardigan, creative and confident, often using colored pencils or drawing cards.',
  'Leo: Brazilian boy, about 10 years old, light-brown skin, straight dark hair, blue overshirt, thoughtful and observant, often using a tablet or organizing cards.',
  'Nina: Brazilian child, about 8 years old, light skin, wavy auburn hair, lavender jacket, playful and gentle, often holding flashcards or small learning props.',
  'Character rules: keep the same cast recognizable across scenes; prefer Caua plus one helper for simple explanations, and include Carol or Geni when the scene needs guidance. Do not invent random new lead characters unless the lesson explicitly needs a background extra.',
  'Avoid readable text, logos, watermarks, photorealism, distorted hands, clutter, chaotic movement, or dramatic lighting.'
].join('\n');

const TURMINHA_ASSETS = {
  referenceSheet: '/assets/turminha/turminha-referencia-v1.png',
  characters: ['Caua', 'Carol', 'Geni', 'Bia', 'Leo', 'Nina'],
};

function turminhaPrompt(extra) {
  return [TURMINHA_STYLE, extra || ''].filter(Boolean).join('\n');
}

module.exports = {
  TURMINHA_STYLE,
  TURMINHA_ASSETS,
  turminhaPrompt,
};
