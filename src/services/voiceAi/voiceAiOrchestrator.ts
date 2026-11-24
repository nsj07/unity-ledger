import { Dispatch } from '@reduxjs/toolkit';
import {
    resetVoiceAiDownload,
    setModelLoadedInMemory,
    setVoiceAiCapabilities,
    setVoiceAiDownload,
    setVoiceAiError,
    setVoiceAiInitialized,
    setVoiceAiProbing,
    updateVoiceAiSettings,
} from '../../store/voiceAiSlice';
import { LlmEngine } from './llmEngine';
import { SpeechService } from './speechService';
import { VoiceAiStorage } from './storage';
import {
    buildLlmPromptRequest,
    hydrateTransactionDraft,
    safeParseLlmJson,
} from './transactionParser';
import {
    CapabilityReport,
    HouseholdAccountRef,
    HouseholdCategoryRef,
    InstalledLocalModel,
    ParsedTransactionDraft,
    RuntimeKind,
    VoiceAiSettings,
} from './types';

function pickPreferredDetectedModel(
    models: InstalledLocalModel[]
): InstalledLocalModel | null {
    if (models.length === 0) return null;
    // Prefer balanced Qwen 1.5B, then Qwen/Llama/Gemma models, then first available
    return (
        models.find((m) => /qwen2\.5.*1\.5b/i.test(m.name) || m.id === 'qwen2.5-1.5b') ||
        models.find((m) => /qwen|llama|gemma|phi|mistral/i.test(m.name)) ||
        models[0]
    );
}

async function buildFullCapabilities(settings: VoiceAiSettings): Promise<CapabilityReport> {
    const [speechCaps, llmCaps] = await Promise.all([
        SpeechService.getCapabilities(),
        LlmEngine.probeCapabilities(settings),
    ]);

    return {
        ...llmCaps,
        speechAvailable: speechCaps.available,
        speechPermissionGranted: speechCaps.permissionGranted,
        supportsOnDeviceSpeech: speechCaps.supportsOnDevice,
    };
}

export const VoiceAiOrchestrator = {
    async initialize(dispatch: Dispatch): Promise<void> {
        dispatch(setVoiceAiProbing(true));
        LlmEngine.setMemoryStateListener((loaded) => {
            dispatch(setModelLoadedInMemory(loaded));
        });

        try {
            let settings = await VoiceAiStorage.loadSettings();
            const capabilities = await buildFullCapabilities(settings);

            // Auto-configure & make Voice Entry available immediately for users who ALREADY
            // have local models available on Mobile or Desktop (unless they explicitly turned it off).
            const hasConfiguredValidModel =
                settings.activeRuntime &&
                settings.activeModelPathOrTag &&
                capabilities.installedLocalModels.some(
                    (m) =>
                        m.runtime === settings.activeRuntime &&
                        (m.pathOrTag === settings.activeModelPathOrTag ||
                            m.id === settings.activeModelId)
                );

            if (!hasConfiguredValidModel && capabilities.installedLocalModels.length > 0) {
                const canRunDetected = capabilities.installedLocalModels.filter((m) =>
                    m.runtime === 'llama_rn' ? capabilities.nativeLlamaAvailable : true
                );
                const preferred = pickPreferredDetectedModel(canRunDetected);
                if (preferred) {
                    const shouldAutoEnable =
                        !settings.userDisabled && capabilities.speechAvailable;
                    settings = await VoiceAiStorage.patchSettings({
                        activeRuntime: preferred.runtime,
                        activeModelId: preferred.id,
                        activeModelPathOrTag: preferred.pathOrTag,
                        isEnabled: shouldAutoEnable ? true : settings.isEnabled,
                    });
                }
            }

            dispatch(setVoiceAiInitialized({ settings, capabilities }));
        } catch (err: any) {
            dispatch(setVoiceAiError(err?.message || 'Failed to probe local AI capabilities.'));
            dispatch(setVoiceAiProbing(false));
        }
    },

    async refreshCapabilities(
        dispatch: Dispatch,
        currentSettings: VoiceAiSettings
    ): Promise<CapabilityReport> {
        dispatch(setVoiceAiProbing(true));
        try {
            const capabilities = await buildFullCapabilities(currentSettings);
            dispatch(setVoiceAiCapabilities(capabilities));
            dispatch(setVoiceAiProbing(false));
            return capabilities;
        } catch (err: any) {
            dispatch(setVoiceAiProbing(false));
            throw err;
        }
    },

    async saveSettingsPatch(
        dispatch: Dispatch,
        patch: Partial<VoiceAiSettings>
    ): Promise<VoiceAiSettings> {
        const next = await VoiceAiStorage.patchSettings(patch);
        dispatch(updateVoiceAiSettings(patch));
        return next;
    },

    async downloadAndActivateModel(params: {
        dispatch: Dispatch;
        modelId: string;
        runtime: RuntimeKind;
        settings: VoiceAiSettings;
    }): Promise<CapabilityReport> {
        const { dispatch, modelId, runtime, settings } = params;
        dispatch(setVoiceAiError(null));

        const { pathOrTag } = await LlmEngine.downloadModel({
            modelId,
            runtime,
            settings,
            onProgress: (p) => {
                dispatch(setVoiceAiDownload(p));
            },
        });

        const updatedSettings = await VoiceAiStorage.patchSettings({
            activeRuntime: runtime,
            activeModelId: modelId,
            activeModelPathOrTag: pathOrTag,
        });
        dispatch(
            updateVoiceAiSettings({
                activeRuntime: runtime,
                activeModelId: modelId,
                activeModelPathOrTag: pathOrTag,
            })
        );

        const capabilities = await buildFullCapabilities(updatedSettings);
        dispatch(setVoiceAiCapabilities(capabilities));
        return capabilities;
    },

    async pauseActiveDownload(dispatch: Dispatch): Promise<void> {
        await LlmEngine.pauseDownload();
        dispatch(setVoiceAiDownload({ status: 'paused', message: 'Download paused.' }));
    },

    async resumeActiveDownload(
        dispatch: Dispatch,
        settings: VoiceAiSettings,
        modelId: string | null
    ): Promise<void> {
        const res = await LlmEngine.resumeDownload((p) => {
            dispatch(setVoiceAiDownload(p));
        });
        if (res && modelId) {
            const updated = await VoiceAiStorage.patchSettings({
                activeRuntime: 'llama_rn',
                activeModelId: modelId,
                activeModelPathOrTag: res.pathOrTag,
            });
            dispatch(
                updateVoiceAiSettings({
                    activeRuntime: 'llama_rn',
                    activeModelId: modelId,
                    activeModelPathOrTag: res.pathOrTag,
                })
            );
            const caps = await buildFullCapabilities(updated);
            dispatch(setVoiceAiCapabilities(caps));
        }
    },

    async cancelActiveDownload(dispatch: Dispatch): Promise<void> {
        await LlmEngine.cancelDownload();
        dispatch(resetVoiceAiDownload());
    },

    async importLocalGgufModel(
        dispatch: Dispatch,
        settings: VoiceAiSettings
    ): Promise<boolean> {
        const picked = await LlmEngine.pickLocalModelFile();
        if (!picked) return false;

        const customId = `custom:${picked.name}`;
        const updated = await VoiceAiStorage.patchSettings({
            activeRuntime: 'llama_rn',
            activeModelId: customId,
            activeModelPathOrTag: picked.uri,
            customModelPath: picked.uri,
            customModelName: picked.name,
        });
        dispatch(
            updateVoiceAiSettings({
                activeRuntime: 'llama_rn',
                activeModelId: customId,
                activeModelPathOrTag: picked.uri,
                customModelPath: picked.uri,
                customModelName: picked.name,
            })
        );

        const caps = await buildFullCapabilities(updated);
        dispatch(setVoiceAiCapabilities(caps));
        return true;
    },

    async removeInstalledModel(params: {
        dispatch: Dispatch;
        modelId: string;
        runtime: RuntimeKind;
        pathOrTag?: string;
        settings: VoiceAiSettings;
    }): Promise<void> {
        const { dispatch, modelId, runtime, pathOrTag, settings } = params;
        await LlmEngine.deleteModel({ modelId, runtime, pathOrTag, settings });

        const isDeletingActive =
            settings.activeRuntime === runtime &&
            (settings.activeModelId === modelId ||
                (pathOrTag && settings.activeModelPathOrTag === pathOrTag));

        let nextSettings = settings;
        if (isDeletingActive) {
            nextSettings = await VoiceAiStorage.patchSettings({
                isEnabled: false,
                activeModelId: null,
                activeModelPathOrTag: null,
                customModelPath:
                    settings.customModelPath === pathOrTag ? null : settings.customModelPath,
                customModelName:
                    settings.customModelPath === pathOrTag ? null : settings.customModelName,
            });
            dispatch(
                updateVoiceAiSettings({
                    isEnabled: false,
                    activeModelId: null,
                    activeModelPathOrTag: null,
                    customModelPath: nextSettings.customModelPath,
                    customModelName: nextSettings.customModelName,
                })
            );
        }

        dispatch(resetVoiceAiDownload());
        const caps = await buildFullCapabilities(nextSettings);
        dispatch(setVoiceAiCapabilities(caps));
    },

    async parseTranscriptToDraft(params: {
        transcript: string;
        accounts: HouseholdAccountRef[];
        categories: HouseholdCategoryRef[];
        settings: VoiceAiSettings;
        currentDraft?: ParsedTransactionDraft | null;
    }): Promise<ParsedTransactionDraft> {
        const { transcript, accounts, categories, settings, currentDraft } = params;
        if (!transcript.trim()) {
            throw new Error('Please speak or enter a transaction description first.');
        }

        const promptReq = buildLlmPromptRequest({
            transcript,
            accounts,
            categories,
            currentDraft,
        });

        const { text, latencyMs } = await LlmEngine.generateJson(promptReq, settings);
        const rawJson = safeParseLlmJson(text);

        return hydrateTransactionDraft({
            rawJson,
            transcript,
            accounts,
            categories,
            currentDraft,
            latencyMs,
        });
    },

    async unloadMemory(): Promise<void> {
        await LlmEngine.unloadFromMemory();
    },
};
