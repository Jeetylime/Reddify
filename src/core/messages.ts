import type { PlatformId } from './platforms';

export type Msg =
  | { type: 'toggle-classic' }
  | { type: 'get-state' }
  | { type: 'open-options'; section?: string }
  | { type: 'refresh-badge' }
  | { type: 'fetch-json'; url: string };

export interface TabState { active: boolean; supported: boolean; classic: boolean; platform?: PlatformId }
