import pluginJson from '../plugin.json';
import { LEGACY_STORAGE_KEY, loadSettings, saveSettings, STORAGE_KEY } from './settings';

describe('AI settings storage', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('stores the choice under a key namespaced with the plugin id', () => {
    expect(STORAGE_KEY).toBe(`${pluginJson.id}.ai`);
    saveSettings({ llmModel: 'base' });
    expect(localStorage.getItem('dkhoa-sensorfloormap-panel.ai')).toBe('{"llmModel":"base"}');
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(loadSettings()).toEqual({ llmModel: 'base' });
  });

  it('moves a choice saved under the old key to the new key', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, '{"llmModel":"base"}');

    expect(loadSettings()).toEqual({ llmModel: 'base' });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"llmModel":"base"}');
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    // Still there on the next read, now from the new key.
    expect(loadSettings()).toEqual({ llmModel: 'base' });
  });

  it('prefers the new key over a leftover old one', () => {
    localStorage.setItem(STORAGE_KEY, '{"llmModel":"large"}');
    localStorage.setItem(LEGACY_STORAGE_KEY, '{"llmModel":"base"}');
    expect(loadSettings()).toEqual({ llmModel: 'large' });
  });

  it('keeps the old key when the new one cannot be written', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, '{"llmModel":"base"}');
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    expect(loadSettings()).toEqual({ llmModel: 'base' });
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBe('{"llmModel":"base"}');
  });

  it('falls back to the default for missing or invalid values', () => {
    expect(loadSettings()).toEqual({ llmModel: 'large' });
    localStorage.setItem(LEGACY_STORAGE_KEY, 'not json');
    expect(loadSettings()).toEqual({ llmModel: 'large' });
  });
});
