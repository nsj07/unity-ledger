import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_VOICE_AI_SETTINGS } from '../services/voiceAi/storage';
import {
    CapabilityReport,
    DownloadProgress,
    VoiceAiSettings,
} from '../services/voiceAi/types';

export interface VoiceAiState {
    isInitialized: boolean;
    isProbing: boolean;
    settings: VoiceAiSettings;
    capabilities: CapabilityReport | null;
    download: DownloadProgress;
    isModelLoadedInMemory: boolean;
    lastError: string | null;
}

const initialDownload: DownloadProgress = {
    status: 'idle',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    modelId: null,
    runtime: null,
    message: undefined,
    error: null,
};

const initialState: VoiceAiState = {
    isInitialized: false,
    isProbing: false,
    settings: { ...DEFAULT_VOICE_AI_SETTINGS },
    capabilities: null,
    download: initialDownload,
    isModelLoadedInMemory: false,
    lastError: null,
};

const voiceAiSlice = createSlice({
    name: 'voiceAi',
    initialState,
    reducers: {
        setVoiceAiProbing(state, action: PayloadAction<boolean>) {
            state.isProbing = action.payload;
        },
        setVoiceAiInitialized(
            state,
            action: PayloadAction<{
                settings: VoiceAiSettings;
                capabilities: CapabilityReport;
            }>
        ) {
            state.settings = action.payload.settings;
            state.capabilities = action.payload.capabilities;
            state.isInitialized = true;
            state.isProbing = false;
        },
        updateVoiceAiSettings(state, action: PayloadAction<Partial<VoiceAiSettings>>) {
            state.settings = {
                ...state.settings,
                ...action.payload,
            };
        },
        setVoiceAiCapabilities(state, action: PayloadAction<CapabilityReport>) {
            state.capabilities = action.payload;
        },
        setVoiceAiDownload(state, action: PayloadAction<Partial<DownloadProgress>>) {
            state.download = {
                ...state.download,
                ...action.payload,
            };
        },
        resetVoiceAiDownload(state) {
            state.download = initialDownload;
        },
        setModelLoadedInMemory(state, action: PayloadAction<boolean>) {
            state.isModelLoadedInMemory = action.payload;
        },
        setVoiceAiError(state, action: PayloadAction<string | null>) {
            state.lastError = action.payload;
        },
    },
});

export const {
    setVoiceAiProbing,
    setVoiceAiInitialized,
    updateVoiceAiSettings,
    setVoiceAiCapabilities,
    setVoiceAiDownload,
    resetVoiceAiDownload,
    setModelLoadedInMemory,
    setVoiceAiError,
} = voiceAiSlice.actions;

/**
 * Computes whether a valid local model is actually ready on the current device
 * for the configured runtime.
 */
export function selectHasReadyLocalModel(state: any): boolean {
    const voiceAi: VoiceAiState | undefined = state?.voiceAi;
    if (!voiceAi?.capabilities) return false;

    const { settings, capabilities } = voiceAi;
    const runtime = settings.activeRuntime;
    const target = settings.activeModelPathOrTag || settings.activeModelId;
    if (!runtime || !target) return false;

    switch (runtime) {
        case 'llama_rn': {
            if (!capabilities.nativeLlamaAvailable) return false;
            return capabilities.installedLocalModels.some(
                (m) =>
                    m.runtime === 'llama_rn' &&
                    (m.id === settings.activeModelId || m.pathOrTag === target)
            );
        }
        case 'ollama': {
            if (!capabilities.ollama.reachable) return false;
            return capabilities.ollama.models.some(
                (tag) => tag === target || tag.startsWith(`${target}:`)
            );
        }
        case 'lmstudio': {
            if (!capabilities.lmstudio.reachable) return false;
            return (
                capabilities.lmstudio.models.length > 0 &&
                capabilities.lmstudio.models.includes(target)
            );
        }
        case 'webllm': {
            if (!capabilities.webGpuAvailable) return false;
            return capabilities.installedLocalModels.some(
                (m) =>
                    m.runtime === 'webllm' &&
                    (m.id === settings.activeModelId || m.pathOrTag === target)
            );
        }
        default:
            return false;
    }
}

/**
 * Strict gate for showing Voice Mic entry buttons on Dashboard, Transactions, and New Transaction.
 * Only returns true when Voice AI is initialized, enabled by the user, Speech API is available,
 * and the configured Local AI model is verified ready on this device.
 */
export function selectIsVoiceEntryReadyAndEnabled(state: any): boolean {
    const voiceAi: VoiceAiState | undefined = state?.voiceAi;
    if (!voiceAi?.isInitialized || !voiceAi.settings.isEnabled) return false;
    if (!voiceAi.capabilities?.speechAvailable) return false;
    return selectHasReadyLocalModel(state);
}

export default voiceAiSlice.reducer;
