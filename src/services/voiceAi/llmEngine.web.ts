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

let webllmEngine: any = null;
let loadedWebllmModelId: string | null = null;
let activeAbortController: AbortController | null = null;
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

function normalizeBaseUrl(url: string, fallback: string): string {
    const trimmed = (url || fallback).trim().replace(/\/+$/, '');
    return trimmed || fallback;
}

async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = 1000
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
}

async function probeOllama(baseUrl: string): Promise<DesktopServerProbe> {
    const normalized = normalizeBaseUrl(baseUrl, 'http://localhost:11434');
    try {
        const res = await fetchWithTimeout(`${normalized}/api/tags`, { method: 'GET' }, 950);
        if (!res.ok) {
            return {
                reachable: false,
                corsBlocked: false,
                models: [],
                baseUrl: normalized,
                error: `HTTP ${res.status}`,
            };
        }
        const data = await res.json();
        const models: string[] = Array.isArray(data?.models)
            ? data.models.map((m: any) => String(m?.name || m?.model || '')).filter(Boolean)
            : [];
        return {
            reachable: true,
            corsBlocked: false,
            models,
            baseUrl: normalized,
        };
    } catch (err: any) {
        const isHttpsOrigin =
            typeof window !== 'undefined' && window.location?.protocol === 'https:';
        return {
            reachable: false,
            corsBlocked: isHttpsOrigin && normalized.startsWith('http://localhost'),
            models: [],
            baseUrl: normalized,
            error: err?.message || 'Unreachable',
        };
    }
}

async function probeLmStudio(baseUrl: string): Promise<DesktopServerProbe> {
    const normalized = normalizeBaseUrl(baseUrl, 'http://localhost:1234');
    try {
        const res = await fetchWithTimeout(`${normalized}/v1/models`, { method: 'GET' }, 950);
        if (!res.ok) {
            return {
                reachable: false,
                corsBlocked: false,
                models: [],
                baseUrl: normalized,
                error: `HTTP ${res.status}`,
            };
        }
        const data = await res.json();
        const models: string[] = Array.isArray(data?.data)
            ? data.data.map((m: any) => String(m?.id || '')).filter(Boolean)
            : [];
        return {
            reachable: true,
            corsBlocked: false,
            models,
            baseUrl: normalized,
        };
    } catch (err: any) {
        const isHttpsOrigin =
            typeof window !== 'undefined' && window.location?.protocol === 'https:';
        return {
            reachable: false,
            corsBlocked: isHttpsOrigin && normalized.startsWith('http://localhost'),
            models: [],
            baseUrl: normalized,
            error: err?.message || 'Unreachable',
        };
    }
}

function isMobileWebBrowser(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
}

async function checkWebGpuSupport(): Promise<{ available: boolean; supportsF16: boolean }> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        return { available: false, supportsF16: false };
    }
    try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (!adapter) return { available: false, supportsF16: false };
        const supportsF16 = Boolean(adapter.features?.has?.('shader-f16'));
        return { available: true, supportsF16 };
    } catch {
        return { available: false, supportsF16: false };
    }
}

async function getBrowserFreeBytes(): Promise<number | null> {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
    try {
        const est = await navigator.storage.estimate();
        if (typeof est.quota === 'number' && typeof est.usage === 'number') {
            return Math.max(0, est.quota - est.usage);
        }
        return null;
    } catch {
        return null;
    }
}

async function detectCachedWebllmModels(): Promise<InstalledLocalModel[]> {
    if (typeof caches === 'undefined') return [];
    try {
        // Fast check first: see if any webllm cache bucket even exists before lazy-importing @mlc-ai/web-llm
        const cacheKeys = await caches.keys();
        const hasAnyWebllmCache = cacheKeys.some((k) => k.toLowerCase().includes('webllm'));
        if (!hasAnyWebllmCache) return [];

        const webllm = await import('@mlc-ai/web-llm');
        const found: InstalledLocalModel[] = [];
        for (const spec of CURATED_MODELS) {
            const candidateIds = [spec.webllmModelId, spec.webllmModelIdF32];
            for (const mlcId of candidateIds) {
                const cached = await webllm.hasModelInCache(mlcId);
                if (cached) {
                    found.push({
                        id: spec.id,
                        name: spec.name,
                        runtime: 'webllm',
                        pathOrTag: mlcId,
                        sizeBytes: spec.approxSizeMb * 1024 * 1024,
                    });
                    break;
                }
            }
        }
        return found;
    } catch {
        return [];
    }
}

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
        const isMobileWeb = isMobileWebBrowser();
        const [gpuCheck, freeDiskBytes, ollama, lmstudio] = await Promise.all([
            checkWebGpuSupport(),
            getBrowserFreeBytes(),
            probeOllama(settings.ollamaBaseUrl),
            probeLmStudio(settings.lmStudioBaseUrl),
        ]);

        const installedLocalModels: InstalledLocalModel[] = [];

        for (const tag of ollama.models) {
            installedLocalModels.push({
                id: `ollama:${tag}`,
                name: `${tag} (Ollama)`,
                runtime: 'ollama',
                pathOrTag: tag,
            });
        }

        for (const id of lmstudio.models) {
            installedLocalModels.push({
                id: `lmstudio:${id}`,
                name: `${id} (LM Studio)`,
                runtime: 'lmstudio',
                pathOrTag: id,
            });
        }

        if (gpuCheck.available) {
            const cachedWebModels = await detectCachedWebllmModels();
            installedLocalModels.push(...cachedWebModels);
        }

        return {
            platform: 'web',
            nativeLlamaAvailable: false,
            webGpuAvailable: gpuCheck.available,
            webGpuSupportsF16: gpuCheck.supportsF16,
            isMobileWeb,
            freeDiskBytes,
            ollama,
            lmstudio,
            installedLocalModels,
        };
    },

    async downloadModel(params: {
        modelId: string;
        runtime: RuntimeKind;
        settings: VoiceAiSettings;
        onProgress: (p: DownloadProgress) => void;
    }): Promise<{ pathOrTag: string }> {
        const { modelId, runtime, settings, onProgress } = params;
        const spec = getModelSpecById(modelId);
        if (!spec) {
            throw new Error(`Unknown model ID "${modelId}".`);
        }

        if (runtime === 'ollama') {
            const baseUrl = normalizeBaseUrl(settings.ollamaBaseUrl, 'http://localhost:11434');
            activeAbortController?.abort();
            const controller = new AbortController();
            activeAbortController = controller;

            onProgress({
                status: 'downloading',
                progress: 0.01,
                downloadedBytes: 0,
                totalBytes: spec.approxSizeMb * 1024 * 1024,
                modelId,
                runtime: 'ollama',
                message: `Requesting Ollama to pull ${spec.ollamaTag}...`,
                error: null,
            });

            try {
                const res = await fetch(`${baseUrl}/api/pull`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: spec.ollamaTag, stream: true }),
                    signal: controller.signal,
                });

                if (!res.ok || !res.body) {
                    throw new Error(`Ollama pull failed with HTTP ${res.status}.`);
                }

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const evt = JSON.parse(line);
                            if (evt.error) {
                                throw new Error(evt.error);
                            }
                            const total = Number(evt.total) || spec.approxSizeMb * 1024 * 1024;
                            const completed = Number(evt.completed) || 0;
                            const ratio = total > 0 ? Math.min(0.99, completed / total) : 0.1;
                            onProgress({
                                status: 'downloading',
                                progress: ratio,
                                downloadedBytes: completed,
                                totalBytes: total,
                                modelId,
                                runtime: 'ollama',
                                message: evt.status || 'Downloading via Ollama...',
                                error: null,
                            });
                        } catch (parseErr: any) {
                            if (parseErr?.message && !parseErr.message.includes('JSON')) {
                                throw parseErr;
                            }
                        }
                    }
                }

                activeAbortController = null;
                onProgress({
                    status: 'completed',
                    progress: 1,
                    downloadedBytes: spec.approxSizeMb * 1024 * 1024,
                    totalBytes: spec.approxSizeMb * 1024 * 1024,
                    modelId,
                    runtime: 'ollama',
                    message: `${spec.ollamaTag} is ready in Ollama.`,
                    error: null,
                });
                return { pathOrTag: spec.ollamaTag };
            } catch (err: any) {
                activeAbortController = null;
                if (err?.name === 'AbortError') {
                    onProgress({
                        status: 'cancelled',
                        progress: 0,
                        downloadedBytes: 0,
                        totalBytes: 0,
                        modelId: null,
                        runtime: 'ollama',
                        message: 'Ollama download cancelled.',
                        error: null,
                    });
                    throw new Error('Download cancelled.');
                }
                onProgress({
                    status: 'error',
                    progress: 0,
                    downloadedBytes: 0,
                    totalBytes: 0,
                    modelId,
                    runtime: 'ollama',
                    error: err?.message || 'Failed to pull model via Ollama.',
                });
                throw err;
            }
        }

        if (runtime === 'webllm') {
            const gpuCheck = await checkWebGpuSupport();
            if (!gpuCheck.available) {
                throw new Error(
                    'WebGPU is not available in this browser. Update Chrome (Android) / Safari (iOS) or connect to a Local/Wi-Fi Ollama server.'
                );
            }

            const targetMlcId = gpuCheck.supportsF16
                ? spec.webllmModelId
                : spec.webllmModelIdF32;
            const approxTotal = spec.approxSizeMb * 1024 * 1024;
            onProgress({
                status: 'downloading',
                progress: 0.01,
                downloadedBytes: 0,
                totalBytes: approxTotal,
                modelId,
                runtime: 'webllm',
                message: `Initializing WebGPU (${gpuCheck.supportsF16 ? 'FP16' : 'FP32'} mode)...`,
                error: null,
            });

            try {
                const webllm = await import('@mlc-ai/web-llm');
                if (webllmEngine && loadedWebllmModelId !== targetMlcId) {
                    await webllmEngine.unload();
                    webllmEngine = null;
                    loadedWebllmModelId = null;
                }

                const engine = await webllm.CreateMLCEngine(targetMlcId, {
                    initProgressCallback: (report) => {
                        const p = Math.max(0, Math.min(1, report.progress || 0));
                        onProgress({
                            status: p >= 1 ? 'completed' : 'downloading',
                            progress: p,
                            downloadedBytes: Math.round(p * approxTotal),
                            totalBytes: approxTotal,
                            modelId,
                            runtime: 'webllm',
                            message: report.text || 'Downloading model weights to browser cache...',
                            error: null,
                        });
                    },
                });

                webllmEngine = engine;
                loadedWebllmModelId = targetMlcId;
                notifyMemoryState(true);
                resetIdleTimer();

                onProgress({
                    status: 'completed',
                    progress: 1,
                    downloadedBytes: approxTotal,
                    totalBytes: approxTotal,
                    modelId,
                    runtime: 'webllm',
                    message: `${spec.name} cached in browser and ready.`,
                    error: null,
                });

                return { pathOrTag: targetMlcId };
            } catch (err: any) {
                onProgress({
                    status: 'error',
                    progress: 0,
                    downloadedBytes: 0,
                    totalBytes: 0,
                    modelId,
                    runtime: 'webllm',
                    error: err?.message || 'Failed to download WebGPU model.',
                });
                throw err;
            }
        }

        throw new Error(`Unsupported download runtime "${runtime}" on Web.`);
    },

    async pauseDownload(): Promise<void> {
        // Browser Cache / Ollama streaming pulls support cancel & restart rather than mid-chunk pause
    },

    async resumeDownload(
        _onProgress: (p: DownloadProgress) => void
    ): Promise<{ pathOrTag: string } | null> {
        return null;
    },

    async cancelDownload(): Promise<void> {
        if (activeAbortController) {
            activeAbortController.abort();
            activeAbortController = null;
        }
        if (webllmEngine) {
            try {
                await webllmEngine.unload();
            } catch {
                // ignore
            }
            webllmEngine = null;
            loadedWebllmModelId = null;
            notifyMemoryState(false);
        }
    },

    async pickLocalModelFile(): Promise<{
        name: string;
        uri: string;
        sizeBytes?: number;
    } | null> {
        return null;
    },

    async deleteModel(params: {
        modelId: string;
        runtime: RuntimeKind;
        pathOrTag?: string;
        settings: VoiceAiSettings;
    }): Promise<void> {
        const { modelId, runtime, pathOrTag, settings } = params;
        const spec = getModelSpecById(modelId);

        if (runtime === 'webllm') {
            const targetId = pathOrTag || spec?.webllmModelId;
            if (!targetId) return;
            if (loadedWebllmModelId === targetId && webllmEngine) {
                await LlmEngine.unloadFromMemory();
            }
            const webllm = await import('@mlc-ai/web-llm');
            await webllm.deleteModelAllInfoInCache(targetId);
            return;
        }

        if (runtime === 'ollama') {
            const targetTag = pathOrTag || spec?.ollamaTag;
            if (!targetTag) return;
            const baseUrl = normalizeBaseUrl(settings.ollamaBaseUrl, 'http://localhost:11434');
            const res = await fetch(`${baseUrl}/api/delete`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: targetTag }),
            });
            if (!res.ok) {
                throw new Error(`Ollama delete returned HTTP ${res.status}.`);
            }
        }
    },

    async generateJson(
        req: LlmJsonCompletionRequest,
        settings: VoiceAiSettings
    ): Promise<{ text: string; latencyMs: number }> {
        const startMs = Date.now();
        const runtime = settings.activeRuntime;
        const spec = getModelSpecById(settings.activeModelId);

        if (runtime === 'ollama') {
            const baseUrl = normalizeBaseUrl(settings.ollamaBaseUrl, 'http://localhost:11434');
            const modelTag = settings.activeModelPathOrTag || spec?.ollamaTag;
            if (!modelTag) throw new Error('No Ollama model selected in Settings.');

            const res = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelTag,
                    messages: [
                        { role: 'system', content: req.systemPrompt },
                        { role: 'user', content: req.userPrompt },
                    ],
                    format: req.jsonSchema,
                    stream: false,
                    keep_alive: '5m',
                    options: {
                        temperature: req.temperature ?? 0.1,
                        num_predict: req.maxTokens ?? 220,
                    },
                }),
            });

            if (!res.ok) {
                const errBody = await res.text().catch(() => '');
                throw new Error(
                    `Ollama chat failed (HTTP ${res.status})${errBody ? `: ${errBody}` : ''}`
                );
            }

            const data = await res.json();
            const content = data?.message?.content || '';
            return {
                text: content,
                latencyMs: Date.now() - startMs,
            };
        }

        if (runtime === 'lmstudio') {
            const baseUrl = normalizeBaseUrl(settings.lmStudioBaseUrl, 'http://localhost:1234');
            const modelId = settings.activeModelPathOrTag || settings.activeModelId;
            if (!modelId) throw new Error('No LM Studio model selected in Settings.');

            const makeBody = (useStrictSchema: boolean) =>
                JSON.stringify({
                    model: modelId,
                    messages: [
                        { role: 'system', content: req.systemPrompt },
                        { role: 'user', content: req.userPrompt },
                    ],
                    temperature: req.temperature ?? 0.1,
                    max_tokens: req.maxTokens ?? 220,
                    response_format: useStrictSchema
                        ? {
                              type: 'json_schema',
                              json_schema: {
                                  name: 'transaction_extraction',
                                  strict: true,
                                  schema: req.jsonSchema,
                              },
                          }
                        : { type: 'json_object' },
                });

            let res = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: makeBody(true),
            });

            if (!res.ok) {
                res = await fetch(`${baseUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: makeBody(false),
                });
            }

            if (!res.ok) {
                throw new Error(`LM Studio completion failed (HTTP ${res.status}).`);
            }

            const data = await res.json();
            const content = data?.choices?.[0]?.message?.content || '';
            return {
                text: content,
                latencyMs: Date.now() - startMs,
            };
        }

        if (runtime === 'webllm') {
            const targetModelId = settings.activeModelPathOrTag || spec?.webllmModelId;
            if (!targetModelId) {
                throw new Error('No WebGPU browser model selected in Settings.');
            }

            const webllm = await import('@mlc-ai/web-llm');
            if (!webllmEngine || loadedWebllmModelId !== targetModelId) {
                if (webllmEngine) {
                    await webllmEngine.unload();
                }
                webllmEngine = await webllm.CreateMLCEngine(targetModelId);
                loadedWebllmModelId = targetModelId;
                notifyMemoryState(true);
            }

            resetIdleTimer();

            const reply = await webllmEngine.chat.completions.create({
                messages: [
                    { role: 'system', content: req.systemPrompt },
                    { role: 'user', content: req.userPrompt },
                ],
                temperature: req.temperature ?? 0.1,
                max_tokens: req.maxTokens ?? 220,
                response_format: {
                    type: 'json_object',
                    schema: JSON.stringify(req.jsonSchema),
                },
            });

            const content = reply?.choices?.[0]?.message?.content || '';
            return {
                text: content,
                latencyMs: Date.now() - startMs,
            };
        }

        throw new Error('Local AI runtime is not configured yet. Open Settings › Voice & Local AI.');
    },

    async unloadFromMemory(): Promise<void> {
        if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
        }
        if (webllmEngine) {
            try {
                await webllmEngine.unload();
            } catch {
                // ignore
            }
            webllmEngine = null;
            loadedWebllmModelId = null;
        }
        notifyMemoryState(false);
    },
};
