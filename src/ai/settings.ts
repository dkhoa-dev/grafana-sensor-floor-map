import pluginJson from '../plugin.json';

/** Which of the LLM app's two model tiers to use; the app maps each to a concrete model. */
export type LlmModel = 'base' | 'large';

export interface AiSettings {
  llmModel: LlmModel;
}

/** Prefixed with the plugin id, so the key cannot collide with another plugin's storage on the same origin. */
export const STORAGE_KEY = `${pluginJson.id}.ai`;
/** Key used up to 0.2.1. Read once and moved to STORAGE_KEY, so users keep their choice. */
export const LEGACY_STORAGE_KEY = 'sensor-floor-map.ai';

export const defaultSettings = (): AiSettings => ({ llmModel: 'large' });

function readStored(): string | null {
  const current = localStorage.getItem(STORAGE_KEY);
  if (current !== null) {
    return current;
  }
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy !== null) {
    try {
      localStorage.setItem(STORAGE_KEY, legacy);
      // Only after the copy succeeded, so a full storage never loses the old value.
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Keep reading the old key until the move can be written.
    }
  }
  return legacy;
}

export function loadSettings(): AiSettings {
  try {
    const stored = JSON.parse(readStored() ?? '{}');
    return stored.llmModel === 'base' || stored.llmModel === 'large'
      ? { llmModel: stored.llmModel }
      : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: AiSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this editor session only.
  }
}
