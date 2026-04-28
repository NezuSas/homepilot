import { Device } from '../../devices/domain/types';
import { Scene } from '../../devices/domain/Scene';
import { AutomationRule } from '../../devices/domain/automation/types';
import { Room } from '../../topology/domain/types';

export type ResolutionReason = 
  | 'alias' 
  | 'exact' 
  | 'token' 
  | 'learned_preference' 
  | 'room_match'
  | 'fuzzy';

export interface ResolutionMatch<T> {
  entity: T;
  score: number;
  reason: ResolutionReason;
}

export type EntityResolutionResult<T> = 
  | { type: 'none' }
  | { type: 'single'; match: ResolutionMatch<T> }
  | { type: 'multiple'; matches: ResolutionMatch<T>[] };

export interface ResolvedEntities {
  devices: EntityResolutionResult<Device>;
  rooms: EntityResolutionResult<Room>;
  scenes: EntityResolutionResult<Scene>;
  automations: EntityResolutionResult<AutomationRule>;
}
