import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, TurboModuleRegistry } from 'react-native';
import { CURATED_MODELS, getModelSpecById } from './modelCatalog';
import {
    CapabilityReport,
    DesktopServerProbe,
    DownloadProgress,
    InstalledLocalModel,
    LlmJsonCompletionRequest,
    RuntimeKind,
    VoiceAiSettings,
} from './types';

const IDLE_UNLOAD_MS = 2 * 60 * 1000; // 2 minutes
const MIN_VALID_GGUF_BYTES = 10 * 1024 * 1024; // 10 MB sanity floor

let activeLlamaContext: any = null;
let loadedModelUri: string | null = null;
let activeDownloadTask: FileSystem.DownloadResumable | null = null;
let activeDownloadMeta: {
    modelId: string;
    partUri: string;
    finalUri: string;
    totalBytes: number;
} | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let memoryStateListener: ((loaded: boolean) => void) | null = null;

function notifyMemoryState(loaded: boolean) {
    memoryStateListener?.(loaded);
}

function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        LlmEngine.unloadFromMemory().catch(() => {});
    }, IDLE_UNLOAD_MS);
}

function isNativeLlamaPresent(): boolean {
    try {
        return Boolean(TurboModuleRegistry.get('RNLlama'));
    } catch {
        return false;
    }
}

function getNativeLlamaModule(): any | null {
    if (!isNativeLlamaPresent()) return null;
    try {
        // Lazy require so Expo Go never fails at bundle load time.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('llama.rn');
    } catch {
        return null;
    }
}

function getModelsDirUri(): string | null {
    if (!FileSystem.documentDirectory) return null;
    return `${FileSystem.documentDirectory}ai-models/`;
}

async function ensureModelsDir(): Promise<string> {
    const dir = getModelsDirUri();
    if (!dir) {
        throw new Error('Device document directory is unavailable.');
    }
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
}

const emptyDesktopProbe: DesktopServerProbe = {
    reachable: false,
    corsBlocked: false,
    models: [],
    baseUrl: '',
};

export const LlmEngine = {
    setMemoryStateListener(fn: ((loaded: boolean) => void) | null) {
        memoryStateListener = fn;
    },

    async probeCapabilities(
        settings: VoiceAiSettings
    ): Promise<
        Omit<
            CapabilityReport,
            'speechAvailable' | 'speechPermissionGranted' | 'supportsOnDeviceSpeech'
        >
    > {
        const nativeLlamaAvailable = isNativeLlamaPresent();
        let freeDiskBytes: number | null = null;
        try {
            freeDiskBytes = await FileSystem.getFreeDiskStorageAsync();
        } catch {
            freeDiskBytes = null;
        }

        const installedLocalModels: InstalledLocalModel[] = [];
        const dir = getModelsDirUri();

        if (dir) {
            try {
                const dirInfo = await FileSystem.getInfoAsync(dir);
                if (dirInfo.exists && dirInfo.isDirectory) {
                    const files = await FileSystem.readDirectoryAsync(dir);
                    for (const fileName of files) {
                        if (!fileName.toLowerCase().endsWith('.gguf')) continue;
                        const fullUri = `${dir}${fileName}`;
                        const fInfo = await FileSystem.getInfoAsync(fullUri);
                        if (!fInfo.exists || (fInfo.size ?? 0) < MIN_VALID_GGUF_BYTES) continue;

                        const matchedSpec = CURATED_MODELS.find(
                            (m) => m.ggufFileName.toLowerCase() === fileName.toLowerCase()
                        );
                        if (matchedSpec) {
                            installedLocalModels.push({
                                id: matchedSpec.id,
                                name: matchedSpec.name,
                                runtime: 'llama_rn',
                                pathOrTag: fullUri,
                                sizeBytes: fInfo.size,
                            });
                        } else {
                            installedLocalModels.push({
                                id: `custom:${fileName}`,
                                name: `${fileName} (Imported)`,
                                runtime: 'llama_rn',
                                pathOrTag: fullUri,
                                sizeBytes: fInfo.size,
                            });
                        }
                    }
                }
            } catch {
                // ignore directory read errors
            }
        }

        if (settings.customModelPath) {
            const alreadyListed = installedLocalModels.some(
                (m) => m.pathOrTag === settings.customModelPath
            );
            if (!alreadyListed) {
                try {
                    const cInfo = await FileSystem.getInfoAsync(settings.customModelPath);
                    if (cInfo.exists && (cInfo.size ?? 0) >= MIN_VALID_GGUF_BYTES) {
                        const displayName =
                            settings.customModelName ||
                            settings.customModelPath.split('/').pop() ||
                            'Custom GGUF';
                        installedLocalModels.push({
                            id: `custom:${displayName}`,
                            name: `${displayName} (Custom)`,
                            runtime: 'llama_rn',
                            pathOrTag: settings.customModelPath,
                            sizeBytes: cInfo.size,
                        });
                    }
                } catch {
                    // ignore
                }
            }
        }

        return {
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            nativeLlamaAvailable,
            webGpuAvailable: false,
            freeDiskBytes,
            ollama: emptyDesktopProbe,
            lmstudio: emptyDesktopProbe,
            installedLocalModels,
        };
    },

    async downloadModel(params: {
        modelId: string;
        runtime: RuntimeKind;
        settings: VoiceAiSettings;
        onProgress: (p: DownloadProgress) => void;
    }): Promise<{ pathOrTag: string }> {
        const { modelId, onProgress } = params;
        const spec = getModelSpecById(modelId);
        if (!spec) {
            throw new Error(`Unknown model "${modelId}".`);
        }

        const dir = await ensureModelsDir();
        const finalUri = `${dir}${spec.ggufFileName}`;
        const partUri = `${finalUri}.part`;
        const approxTotal = spec.approxSizeMb * 1024 * 1024;

        await FileSystem.deleteAsync(partUri, { idempotent: true }).catch(() => {});

        activeDownloadMeta = {
            modelId,
            partUri,
            finalUri,
            totalBytes: approxTotal,
        };

        onProgress({
            status: 'downloading',
            progress: 0.01,
            downloadedBytes: 0,
            totalBytes: approxTotal,
            modelId,
            runtime: 'llama_rn',
            message: `Starting download of ${spec.name}...`,
            error: null,
        });

        const task = FileSystem.createDownloadResumable(
            spec.ggufDownloadUrl,
            partUri,
            {},
            (data) => {
                const total =
                    data.totalBytesExpectedToWrite > 0
                        ? data.totalBytesExpectedToWrite
                        : approxTotal;
                const written = data.totalBytesWritten;
                const ratio = total > 0 ? Math.min(0.99, written / total) : 0;
                onProgress({
                    status: 'downloading',
                    progress: ratio,
                    downloadedBytes: written,
                    totalBytes: total,
                    modelId,
                    runtime: 'llama_rn',
                    message: 'Downloading GGUF model to device storage...',
                    error: null,
                });
            }
        );

        activeDownloadTask = task;

        try {
            const result = await task.downloadAsync();
            if (!result || (result.status !== 200 && result.status !== 206)) {
                throw new Error(
                    result
                        ? `Download failed with HTTP status ${result.status}.`
                        : 'Download was interrupted.'
                );
            }

            await FileSystem.deleteAsync(finalUri, { idempotent: true }).catch(() => {});
            await FileSystem.moveAsync({ from: partUri, to: finalUri });

            activeDownloadTask = null;
            activeDownloadMeta = null;

            onProgress({
                status: 'completed',
                progress: 1,
                downloadedBytes: approxTotal,
                totalBytes: approxTotal,
                modelId,
                runtime: 'llama_rn',
                message: `${spec.name} saved on device.`,
                error: null,
            });

            return { pathOrTag: finalUri };
        } catch (err: any) {
            if (!activeDownloadTask) {
                // Cancelled by user
                throw new Error('Download cancelled.');
            }
            onProgress({
                status: 'error',
                progress: 0,
                downloadedBytes: 0,
                totalBytes: approxTotal,
                modelId,
                runtime: 'llama_rn',
                error: err?.message || 'Model download failed.',
            });
            throw err;
        }
    },

    async pauseDownload(): Promise<void> {
        if (activeDownloadTask) {
            await activeDownloadTask.pauseAsync();
        }
    },

    async resumeDownload(
        onProgress: (p: DownloadProgress) => void
    ): Promise<{ pathOrTag: string } | null> {
        if (!activeDownloadTask || !activeDownloadMeta) return null;
        const meta = activeDownloadMeta;
        onProgress({
            status: 'downloading',
            modelId: meta.modelId,
            runtime: 'llama_rn',
            progress: 0,
            downloadedBytes: 0,
            totalBytes: meta.totalBytes,
            message: 'Resuming download...',
            error: null,
        });

        const result = await activeDownloadTask.resumeAsync();
        if (!result || (result.status !== 200 && result.status !== 206)) {
            throw new Error('Failed to resume model download.');
        }

        await FileSystem.deleteAsync(meta.finalUri, { idempotent: true }).catch(() => {});
        await FileSystem.moveAsync({ from: meta.partUri, to: meta.finalUri });

        activeDownloadTask = null;
        activeDownloadMeta = null;

        onProgress({
            status: 'completed',
            progress: 1,
            downloadedBytes: meta.totalBytes,
            totalBytes: meta.totalBytes,
            modelId: meta.modelId,
            runtime: 'llama_rn',
            message: 'Model download completed.',
            error: null,
        });

        return { pathOrTag: meta.finalUri };
    },

    async cancelDownload(): Promise<void> {
        const task = activeDownloadTask;
        const meta = activeDownloadMeta;
        activeDownloadTask = null;
        activeDownloadMeta = null;

        if (task) {
            try {
                await task.pauseAsync();
            } catch {
                // ignore
            }
        }
        if (meta?.partUri) {
            await FileSystem.deleteAsync(meta.partUri, { idempotent: true }).catch(() => {});
        }
    },

    async pickLocalModelFile(): Promise<{
        name: string;
        uri: string;
        sizeBytes?: number;
    } | null> {
        const res = await DocumentPicker.getDocumentAsync({
            type: '*/*',
            copyToCacheDirectory: true,
            multiple: false,
        });

        if (res.canceled || !res.assets || res.assets.length === 0) {
            return null;
        }

        const asset = res.assets[0];
        const safeName = (asset.name || 'custom-model.gguf').replace(/[^a-zA-Z0-9._-]/g, '_');
        if (!safeName.toLowerCase().endsWith('.gguf')) {
            throw new Error('Please select a valid .gguf model file.');
        }

        const dir = await ensureModelsDir();
        const destUri = `${dir}${safeName}`;
        if (asset.uri !== destUri) {
            await FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => {});
            await FileSystem.copyAsync({ from: asset.uri, to: destUri });
            await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => {});
        }

        const info = await FileSystem.getInfoAsync(destUri);
        return {
            name: safeName,
            uri: destUri,
            sizeBytes: info.exists ? info.size : asset.size,
        };
    },

    async deleteModel(params: {
        modelId: string;
        runtime: RuntimeKind;
        pathOrTag?: string;
        settings: VoiceAiSettings;
    }): Promise<void> {
        const { modelId, pathOrTag } = params;
        const dir = getModelsDirUri();
        const spec = getModelSpecById(modelId);
        const targetUri =
            pathOrTag || (dir && spec ? `${dir}${spec.ggufFileName}` : null);
        if (!targetUri) return;

        if (loadedModelUri === targetUri) {
            await LlmEngine.unloadFromMemory();
        }
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
    },

    async generateJson(
        req: LlmJsonCompletionRequest,
        settings: VoiceAiSettings
    ): Promise<{ text: string; latencyMs: number }> {
        const llamaMod = getNativeLlamaModule();
        if (!llamaMod?.initLlama) {
            throw new Error(
                'Native llama.rn engine is unavailable. Build and run an Expo Development Build (npx expo run:android or npx expo run:ios).'
            );
        }

        const dir = getModelsDirUri();
        const spec = getModelSpecById(settings.activeModelId);
        const modelUri =
            settings.activeModelPathOrTag ||
            settings.customModelPath ||
            (dir && spec ? `${dir}${spec.ggufFileName}` : null);

        if (!modelUri) {
            throw new Error('No on-device GGUF model is configured. Set one up in Settings.');
        }

        const info = await FileSystem.getInfoAsync(modelUri);
        if (!info.exists) {
            throw new Error('Selected GGUF model file was not found on device storage.');
        }

        const startMs = Date.now();

        if (!activeLlamaContext || loadedModelUri !== modelUri) {
            if (activeLlamaContext) {
                try {
                    await activeLlamaContext.release();
                } catch {
                    // ignore
                }
            }
            activeLlamaContext = await llamaMod.initLlama({
                model: modelUri,
                n_ctx: 2048,
                n_gpu_layers: Platform.OS === 'ios' ? 99 : 0,
                use_mmap: true,
            });
            loadedModelUri = modelUri;
            notifyMemoryState(true);
        } else {
            try {
                await activeLlamaContext.clearCache(false);
            } catch {
                // ignore
            }
        }

        resetIdleTimer();

        const result = await activeLlamaContext.completion({
            messages: [
                { role: 'system', content: req.systemPrompt },
                { role: 'user', content: req.userPrompt },
            ],
            n_predict: req.maxTokens ?? 220,
            temperature: req.temperature ?? 0.1,
            response_format: {
                type: 'json_schema',
                json_schema: {
                    strict: true,
                    schema: req.jsonSchema,
                },
            },
        });

        return {
            text: result?.content || result?.text || '',
            latencyMs: Date.now() - startMs,
        };
    },

    async unloadFromMemory(): Promise<void> {
        if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
        }
        if (activeLlamaContext) {
            try {
                await activeLlamaContext.release();
            } catch {
                // ignore
            }
            activeLlamaContext = null;
            loadedModelUri = null;
        }
        notifyMemoryState(false);
    },
};
