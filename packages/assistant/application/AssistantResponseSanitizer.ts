const MAX_RESPONSE_CHARACTERS = 420;
const MAX_RESPONSE_SENTENCES = 4;

function limitSentences(text: string): string {
  let sentenceCount = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (!/[.!?]/.test(text[index])) continue;
    if (index + 1 < text.length && !/\s/.test(text[index + 1])) continue;

    sentenceCount += 1;
    if (sentenceCount === MAX_RESPONSE_SENTENCES) return text.slice(0, index + 1).trim();
  }

  return text;
}

export function sanitizeAssistantResponse(text: string): string {
  const normalized = text
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+([,.!?;:])/g, '$1')
      .trim())
    .filter(Boolean)
    .join('\n');
  const focused = limitSentences(normalized);

  if (focused.length <= MAX_RESPONSE_CHARACTERS) return focused;

  const shortened = focused.slice(0, MAX_RESPONSE_CHARACTERS - 1);
  const lastWordBoundary = Math.max(shortened.lastIndexOf(' '), shortened.lastIndexOf('\n'));
  return `${shortened.slice(0, Math.max(lastWordBoundary, MAX_RESPONSE_CHARACTERS - 40)).trim()}…`;
}
