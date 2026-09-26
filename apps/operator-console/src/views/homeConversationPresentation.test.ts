import { requiresVoiceConfirmation } from './homeConversationPresentation';

describe('home conversation presentation', () => {
  it('only enables voice confirmation capture for a true confirm/cancel clarification', () => {
    expect(requiresVoiceConfirmation({ type: 'clarification', message: '¿Confirmas?', clarification: { question: '¿Confirmas?', options: [{ id: 'confirm', label: 'Sí', kind: 'device' }, { id: 'cancel', label: 'No', kind: 'device' }] } })).toBe(true);
    expect(requiresVoiceConfirmation({ type: 'clarification', message: 'Elige una luz', clarification: { question: 'Elige una luz', options: [{ id: 'lamp', label: 'Lámpara', kind: 'device' }] } })).toBe(false);
    expect(requiresVoiceConfirmation({ type: 'answer', message: 'Todo listo' })).toBe(false);
  });
});
