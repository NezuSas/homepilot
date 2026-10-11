import type { ConversationDeps } from './ConversationDeps';
import type { ConversationModules } from './ConversationModules';

/** Base class of the conversation collaborators: explicit dependencies plus their sibling collaborators. */
export abstract class ConversationCollaborator {
  constructor(
    protected readonly deps: ConversationDeps,
    protected readonly modules: ConversationModules
  ) {}
}
