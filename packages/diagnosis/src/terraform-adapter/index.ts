import type { TerraformAdapter } from './types.js';
export type { TerraformAdapter, TerraformWorkspaceSummary } from './types.js';
export { RealTerraformAdapter, TerraformApiError } from './real.js';

let currentAdapter: TerraformAdapter | null = null;

export function setTerraformAdapter(adapter: TerraformAdapter): void {
  currentAdapter = adapter;
}

export function getTerraformAdapter(): TerraformAdapter | null {
  return currentAdapter;
}
