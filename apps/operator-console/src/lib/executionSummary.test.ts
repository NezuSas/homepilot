import { localizeExecutionSummary } from './executionSummary';

const dictionary: Record<string, string> = {
  'execution_logs.summary': '{{name}} · {{source}} · {{status}}',
  'execution_logs.summary_auto_name': 'Automatización: {{command}}',
  'execution_logs.summary_assistant_name': 'Asistente: {{request}}',
  'execution_logs.source_scene': 'escena',
  'execution_logs.source_automation': 'automatización',
  'execution_logs.source_manual': 'manual',
  'execution_logs.status_success': 'correcta',
  'execution_logs.status_partial': 'parcial',
  'execution_logs.status_failed': 'fallida',
  'automations.builder.commands.turn_on': 'Encender',
};
const t = (key: string, options: Record<string, unknown> = {}) =>
  (dictionary[key] ?? String(options.defaultValue ?? key)).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name]));

describe('localizeExecutionSummary', () => {
  it('translates the stored sentence for a named scene', () => {
    expect(localizeExecutionSummary('Scene "Cine en casa" executed via scene. Status: success', t))
      .toBe('Cine en casa · escena · correcta');
  });

  it('names automation runs after the command they performed', () => {
    expect(localizeExecutionSummary('Scene "[Auto] turn_on" executed via automation. Status: partial', t))
      .toBe('Automatización: Encender · automatización · parcial');
  });

  it('names assistant runs after the request', () => {
    expect(localizeExecutionSummary('Scene "Assistant Chat: enciende sala 3" executed via manual. Status: failed', t))
      .toBe('Asistente: enciende sala 3 · manual · fallida');
  });

  it('leaves unrecognised text untouched', () => {
    expect(localizeExecutionSummary('Algo distinto', t)).toBe('Algo distinto');
  });
});
