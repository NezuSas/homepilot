type Translate = (key: string, options?: Record<string, unknown>) => string;

// The API stores a fixed English sentence: Scene "<name>" executed via <source>. Status: <status>
const SUMMARY_PATTERN = /^Scene "(.*)" executed via (scene|automation|manual)\. Status: (success|partial|failed)$/s;
// Routines run by an automation or an assistant command are named after what they do.
const AUTOMATION_SCENE_PATTERN = /^\[Auto\] (\w+)$/;
const ASSISTANT_SCENE_PATTERN = /^Assistant Chat: (.*)$/s;

/** Renders a stored execution summary in the interface language, or returns it unchanged when it is not recognised. */
export function localizeExecutionSummary(summary: string, t: Translate): string {
  const match = SUMMARY_PATTERN.exec(summary);
  if (!match) return summary;
  const [, rawName, source, status] = match;
  const automation = AUTOMATION_SCENE_PATTERN.exec(rawName);
  const assistant = ASSISTANT_SCENE_PATTERN.exec(rawName);
  const name = automation
    ? t('execution_logs.summary_auto_name', { command: t(`automations.builder.commands.${automation[1]}`, { defaultValue: automation[1] }) })
    : assistant
      ? t('execution_logs.summary_assistant_name', { request: assistant[1] })
      : rawName;
  return t('execution_logs.summary', {
    name,
    source: t(`execution_logs.source_${source}`),
    status: t(`execution_logs.status_${status}`),
  });
}
