import { FollowUpResolverPort, ResolvedFollowUp } from './ports/FollowUpResolverPort';
import { AssistantMemoryState } from './ports/AssistantMemoryPort';

export class FollowUpResolver implements FollowUpResolverPort {
  /**
   * Resolves contextual references and aliases in the prompt.
   */
  public resolve(prompt: string, memory: AssistantMemoryState, language: string = 'es', aliases: Record<string, string> = {}): ResolvedFollowUp {
    let currentPrompt = prompt;
    let normalized = this.normalize(prompt);

    // 0. Resolve Aliases (e.g. "mi cuarto" -> "sala")
    for (const [alias, target] of Object.entries(aliases)) {
      if (normalized.includes(alias)) {
        // We use a case-insensitive replacement on the original prompt if possible
        const regex = new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        currentPrompt = currentPrompt.replace(regex, target);
        normalized = this.normalize(currentPrompt);
      }
    }

    // 1. Resolve "esas", "esos", "esa", "eso" (List queries)
    const listTriggers = [
      'esas', 'esos', 'esa', 'eso', 
      'y esas', 'y esos', 'y esa', 'y eso',
      'those', 'that one', 'them'
    ];

    if (listTriggers.some(t => normalized === t)) {
      if (memory.entities.length > 0) {
        const entityNames = memory.entities.map(e => e.name).join(', ');
        const resolvedPrompt = language === 'en' 
          ? `tell me about ${entityNames}` 
          : `cuéntame sobre ${entityNames}`;
        
        return {
          resolvedPrompt,
          handled: false,
          referencesMemory: true
        };
      }
    }

    // 2. Resolve indices "la primera", "la segunda", etc.
    const indexMatches = [
      { triggers: ['la primera', 'el primero', 'primera', 'primero'], index: 0 },
      { triggers: ['la segunda', 'el segundo', 'segunda', 'segundo'], index: 1 },
      { triggers: ['la tercera', 'el tercero', 'tercera', 'tercero'], index: 2 },
      { triggers: ['the first', 'first one'], index: 0 },
      { triggers: ['the second', 'second one'], index: 1 },
      { triggers: ['the third', 'third one'], index: 2 },
    ];

    for (const match of indexMatches) {
      if (match.triggers.some(t => normalized.includes(t))) {
        const entity = memory.entities[match.index];
        if (entity) {
          // Replace trigger with entity name in the CURRENT prompt to preserve rest of context
          let resolvedPrompt = currentPrompt;
          const sortedTriggers = [...match.triggers].sort((a, b) => b.length - a.length);
          
          for (const t of sortedTriggers) {
            const regex = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            if (regex.test(resolvedPrompt)) {
              resolvedPrompt = resolvedPrompt.replace(regex, entity.name);
              return {
                resolvedPrompt,
                handled: false,
                referencesMemory: true
              };
            }
          }
        }
      }
    }

    // 3. Resolve room queries "en qué cuarto está", "de qué cuarto son"
    const roomTriggers = [
      'en que cuarto esta', 'en que cuarto estan', 
      'de que cuarto son', 'de que cuarto es',
      'donde esta', 'donde estan',
      'in which room', 'what room', 'where is it'
    ];

    if (roomTriggers.some(t => normalized.includes(t))) {
      if (memory.entities.length > 0) {
        const entityNames = memory.entities.map(e => e.name).join(' y ');
        const resolvedPrompt = language === 'en'
          ? `room of ${entityNames}`
          : `cuarto de ${entityNames}`;
        
        return {
          resolvedPrompt,
          handled: false,
          referencesMemory: true
        };
      }
    }

    // 4. Resolve commands "apaga esa", "enciende la"
    const commandTriggers = [
      { triggers: ['apaga esa', 'apagala', 'apagalas', 'apaga eso', 'turn off that', 'turn it off', 'apagarla'], action: 'apaga' },
      { triggers: ['enciende esa', 'enciendela', 'enciendelas', 'enciende eso', 'prende esa', 'prendela', 'turn on that', 'turn it on', 'encenderla'], action: 'enciende' }
    ];

    for (const cmd of commandTriggers) {
      if (cmd.triggers.some(t => normalized.includes(t))) {
        if (memory.entities.length === 1) {
          return {
            resolvedPrompt: `${cmd.action} ${memory.entities[0].name}`,
            handled: false,
            referencesMemory: true
          };
        }
      }
    }

    return {
      resolvedPrompt: currentPrompt,
      handled: false,
      referencesMemory: false
    };
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[¿?¡!.,]/g, "")        // Remove punctuation
      .replace(/\s+/g, " ")            // Normalize spaces
      .trim();
  }
}
