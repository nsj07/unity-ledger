import { ModelSpec } from './types';

export const CURATED_MODELS: ModelSpec[] = [
    {
        id: 'qwen2.5-0.5b',
        name: 'Qwen 2.5 0.5B Instruct (Lite)',
        tier: 'lite',
        license: 'Apache 2.0',
        description:
            'Ultra-fast & compact (~398 MB). Great for older phones, low-RAM devices, or quick browser setup.',
        approxSizeMb: 398,
        minRamGb: 2,
        ggufFileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
        ggufDownloadUrl:
            'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
        webllmModelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
        webllmModelIdF32: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
        ollamaTag: 'qwen2.5:0.5b',
    },
    {
        id: 'qwen2.5-1.5b',
        name: 'Qwen 2.5 1.5B Instruct (Balanced)',
        tier: 'balanced',
        recommended: true,
        license: 'Apache 2.0',
        description:
            'Recommended default (~986 MB). Best accuracy for ₹ shorthand, relative dates ("yesterday"), and category matching.',
        approxSizeMb: 986,
        minRamGb: 4,
        ggufFileName: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
        ggufDownloadUrl:
            'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
        webllmModelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
        webllmModelIdF32: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
        ollamaTag: 'qwen2.5:1.5b',
    },
    {
        id: 'llama3.2-1b',
        name: 'Llama 3.2 1B Instruct',
        tier: 'alternative',
        license: 'Llama 3.2 Community',
        description:
            'Meta’s mobile-first 1B model (~775 MB). Strong general English extraction across mobile and desktop.',
        approxSizeMb: 775,
        minRamGb: 3,
        ggufFileName: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        ggufDownloadUrl:
            'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        webllmModelId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        webllmModelIdF32: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
        ollamaTag: 'llama3.2:1b',
    },
];

export const SUPPORTED_SPEECH_LOCALES = [
    { code: 'en-IN', label: 'English (India)' },
    { code: 'en-US', label: 'English (US)' },
    { code: 'en-GB', label: 'English (UK)' },
    { code: 'hi-IN', label: 'Hindi / Hinglish (India)' },
] as const;

export function getModelSpecById(id: string | null | undefined): ModelSpec | null {
    if (!id) return null;
    return CURATED_MODELS.find((m) => m.id === id) || null;
}

export function formatBytes(bytes: number | null | undefined): string {
    if (bytes == null || isNaN(bytes) || bytes < 0) return 'Unknown';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const val = bytes / Math.pow(1024, idx);
    return `${val >= 100 ? Math.round(val) : val.toFixed(val >= 10 ? 1 : 2)} ${units[idx]}`;
}
