export type RuntimeKind = 'llama_rn' | 'ollama' | 'lmstudio' | 'webllm';

export type ModelTier = 'lite' | 'balanced' | 'alternative' | 'custom';

export type TransactionType = 'Expense' | 'Income' | 'Transfer';

export interface ModelSpec {
    id: string;
    name: string;
    tier: ModelTier;
    recommended?: boolean;
    license: string;
    description: string;
    approxSizeMb: number;
    minRamGb: number;
    ggufFileName: string;
    ggufDownloadUrl: string;
    webllmModelId: string;
    webllmModelIdF32: string;
    ollamaTag: string;
}

export type DownloadStatus =
    | 'idle'
    | 'downloading'
    | 'paused'
    | 'completed'
    | 'error'
    | 'cancelled';

export interface DownloadProgress {
    status: DownloadStatus;
    progress: number; // 0..1
    downloadedBytes: number;
    totalBytes: number;
    modelId: string | null;
    runtime?: RuntimeKind | null;
    message?: string;
    error?: string | null;
}

export interface DesktopServerProbe {
    reachable: boolean;
    corsBlocked: boolean;
    models: string[];
    baseUrl: string;
    error?: string;
}

export interface InstalledLocalModel {
    id: string;
    name: string;
    runtime: RuntimeKind;
    pathOrTag: string;
    sizeBytes?: number;
}

export interface CapabilityReport {
    platform: 'ios' | 'android' | 'web';
    speechAvailable: boolean;
    speechPermissionGranted: boolean;
    supportsOnDeviceSpeech: boolean;
    nativeLlamaAvailable: boolean;
    webGpuAvailable: boolean;
    webGpuSupportsF16?: boolean;
    isMobileWeb?: boolean;
    freeDiskBytes: number | null;
    ollama: DesktopServerProbe;
    lmstudio: DesktopServerProbe;
    installedLocalModels: InstalledLocalModel[];
}

export interface VoiceAiSettings {
    isEnabled: boolean;
    userDisabled?: boolean;
    speechLocale: string;
    activeRuntime: RuntimeKind | null;
    activeModelId: string | null;
    activeModelPathOrTag: string | null;
    customModelPath: string | null;
    customModelName: string | null;
    ollamaBaseUrl: string;
    lmStudioBaseUrl: string;
    wizardCompleted: boolean;
}

export interface ParsedTransactionDraft {
    type: TransactionType;
    amount: string;
    accountId: string;
    toAccountId: string;
    categoryId: string;
    subcategoryName: string;
    transactionDateMs: number;
    note: string;
    rawTranscript: string;
    latencyMs?: number;
    warnings?: string[];
}

export interface HouseholdAccountRef {
    id: string;
    name: string;
    type?: string;
    balance?: number;
}

export interface HouseholdCategoryRef {
    id: string;
    name: string;
    type: string;
    subcategories?: string[];
}

export interface LlmJsonCompletionRequest {
    systemPrompt: string;
    userPrompt: string;
    jsonSchema: Record<string, any>;
    temperature?: number;
    maxTokens?: number;
}
