export type Msg =
  | { type: 'toggle-classic' }
  | { type: 'get-state' }
  | { type: 'open-options' }
  | { type: 'refresh-badge' };

export interface TabState { active: boolean; supported: boolean; classic: boolean }
