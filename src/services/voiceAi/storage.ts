import AsyncStorage from '@react-native-async-storage/async-storage';
import { VoiceAiSettings } from './types';

const SETTINGS_STORAGE_KEY = '@unity_ledger/voice_ai_settings_v1';

export const DEFAULT_VOICE_AI_SETTINGS: VoiceAiSettings = {
    isEnabled: false,
    userDisabled: false,
    speechLocale: 'en-IN',
    activeRuntime: null,
    activeModelId: null,
    activeModelPathOrTag: null,
    customModelPath: null,
    customModelName: null,
    ollamaBaseUrl: 'http://localhost:11434',
    lmStudioBaseUrl: 'http://localhost:1234',
    wizardCompleted: false,
};

export const VoiceAiStorage = {
    async loadSettings(): Promise<VoiceAiSettings> {
        try {
            const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
            if (!raw) return { ...DEFAULT_VOICE_AI_SETTINGS };
            const parsed = JSON.parse(raw);
            return {
                ...DEFAULT_VOICE_AI_SETTINGS,
                ...parsed,
            };
        } catch (err) {
            console.warn('[VoiceAiStorage] Failed to load settings:', err);
            return { ...DEFAULT_VOICE_AI_SETTINGS };
        }
    },

    async saveSettings(next: VoiceAiSettings): Promise<void> {
        try {
            await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
        } catch (err) {
            console.warn('[VoiceAiStorage] Failed to save settings:', err);
        }
    },

    async patchSettings(patch: Partial<VoiceAiSettings>): Promise<VoiceAiSettings> {
        const current = await VoiceAiStorage.loadSettings();
        const updated: VoiceAiSettings = {
            ...current,
            ...patch,
        };
        await VoiceAiStorage.saveSettings(updated);
        return updated;
    },
};
