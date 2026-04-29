/**
 * AssistantContextBuilderPort
 * 
 * Port for building a home setup context for the LLM.
 */
export interface AssistantContextBuilderPort {
  build(userId?: string | null): Promise<string>;
  buildLlmHomeMap(userId?: string | null): Promise<string>;
  buildLightLlmHomeMap(userId?: string | null): Promise<string>;
}
