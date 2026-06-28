const MAX_RESPONSE_CHARACTERS = 420;
const MAX_RESPONSE_SENTENCES = 4;

export function sanitizeAssistantResponse(text: string): string {
  const withoutEmoji = text
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s*\n\s*/g, ' ')
    .trim();

  const sentences = withoutEmoji.split(/(?<=[.!?])\s+/).filter(Boolean);
  const focused = sentences.slice(0, MAX_RESPONSE_SENTENCES).join(' ');
  if (focused.length <= MAX_RESPONSE_CHARACTERS) return focused;

  const shortened = focused.slice(0, MAX_RESPONSE_CHARACTERS - 1);
  const lastWordBoundary = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, Math.max(lastWordBoundary, MAX_RESPONSE_CHARACTERS - 40)).trim()}…`;
}
