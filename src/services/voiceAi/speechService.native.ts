import { Platform } from 'react-native';
import type { SpeechRecognitionCallbacks } from './speechService.web';

function getNativeSpeechModule(): any | null {
    try {
        // Lazy require so opening the app inside Expo Go (without a custom Dev Build) never crashes at startup.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('expo-speech-recognition');
        return mod?.ExpoSpeechRecognitionModule || null;
    } catch {
        return null;
    }
}

let activeSubscriptions: { remove: () => void }[] = [];

function clearSubscriptions() {
    for (const sub of activeSubscriptions) {
        try {
            sub.remove();
        } catch {
            // ignore
        }
    }
    activeSubscriptions = [];
}

export const SpeechService = {
    async getCapabilities(): Promise<{
        available: boolean;
        permissionGranted: boolean;
        supportsOnDevice: boolean;
    }> {
        const mod = getNativeSpeechModule();
        if (!mod) {
            return {
                available: false,
                permissionGranted: false,
                supportsOnDevice: false,
            };
        }

        try {
            const available = Boolean(mod.isRecognitionAvailable?.());
            const supportsOnDevice = Boolean(mod.supportsOnDeviceRecognition?.());
            const perm = await mod.getPermissionsAsync();
            return {
                available,
                permissionGranted: Boolean(perm?.granted),
                supportsOnDevice,
            };
        } catch {
            return {
                available: false,
                permissionGranted: false,
                supportsOnDevice: false,
            };
        }
    },

    async requestPermissions(): Promise<{ granted: boolean; error?: string }> {
        const mod = getNativeSpeechModule();
        if (!mod) {
            return {
                granted: false,
                error:
                    'Native speech recognition module is not loaded. Run an Expo Development Build (npx expo run:android or npx expo run:ios).',
            };
        }

        try {
            const res = await mod.requestPermissionsAsync();
            if (res?.granted) {
                return { granted: true };
            }
            return {
                granted: false,
                error:
                    'Microphone or Speech Recognition permission was not granted. Please enable it in system Settings.',
            };
        } catch (err: any) {
            return {
                granted: false,
                error: err?.message || 'Failed to request speech recognition permissions.',
            };
        }
    },

    async triggerOfflinePackDownload(
        locale = 'en-IN'
    ): Promise<{ ok: boolean; message: string }> {
        const mod = getNativeSpeechModule();
        if (!mod) {
            return { ok: false, message: 'Native speech module unavailable.' };
        }
        if (Platform.OS !== 'android' || !mod.androidTriggerOfflineModelDownload) {
            return {
                ok: false,
                message:
                    'On iOS, offline voice packs are managed automatically under Settings › General › Keyboard › Dictation Languages.',
            };
        }
        try {
            const res = await mod.androidTriggerOfflineModelDownload({ locale });
            return {
                ok: true,
                message: res?.message || `Offline speech pack status: ${res?.status || 'requested'}.`,
            };
        } catch (err: any) {
            return {
                ok: false,
                message: err?.message || 'Could not trigger offline speech pack download.',
            };
        }
    },

    async startListening(callbacks: SpeechRecognitionCallbacks): Promise<void> {
        const mod = getNativeSpeechModule();
        if (!mod) {
            callbacks.onError(
                'Native speech recognition requires an Expo Development Build.'
            );
            callbacks.onEnd();
            return;
        }

        clearSubscriptions();
        let accumulatedFinal = '';

        try {
            const perm = await mod.getPermissionsAsync();
            if (!perm?.granted) {
                const req = await mod.requestPermissionsAsync();
                if (!req?.granted) {
                    callbacks.onError('Microphone permission is required for voice entry.');
                    callbacks.onEnd();
                    return;
                }
            }

            const resultSub = mod.addListener('result', (event: any) => {
                const topTranscript = event?.results?.[0]?.transcript || '';
                const isFinal = Boolean(event?.isFinal);
                if (isFinal) {
                    accumulatedFinal = `${accumulatedFinal} ${topTranscript}`.trim();
                    callbacks.onTranscript(accumulatedFinal, true);
                } else {
                    const combined = `${accumulatedFinal} ${topTranscript}`.trim();
                    callbacks.onTranscript(combined, false);
                }
            });

            const errorSub = mod.addListener('error', (event: any) => {
                const code = event?.error || 'unknown';
                if (code === 'aborted') return;
                if (code === 'no-speech' || code === 'speech-timeout') {
                    callbacks.onError('No speech detected. Tap the mic to try again.');
                } else {
                    callbacks.onError(event?.message || `Speech recognition error (${code}).`);
                }
            });

            const endSub = mod.addListener('end', () => {
                clearSubscriptions();
                callbacks.onEnd();
            });

            activeSubscriptions.push(resultSub, errorSub, endSub);

            mod.start({
                lang: callbacks.locale || 'en-IN',
                interimResults: true,
                continuous: false,
                addsPunctuation: true,
                contextualStrings: [
                    'rupees',
                    'Expense',
                    'Income',
                    'Transfer',
                    'Groceries',
                    'Cash',
                    'Bank Account',
                    'Savings',
                ],
            });
        } catch (err: any) {
            clearSubscriptions();
            callbacks.onError(err?.message || 'Could not start speech recognition.');
            callbacks.onEnd();
        }
    },

    async stopListening(): Promise<void> {
        const mod = getNativeSpeechModule();
        try {
            mod?.stop?.();
        } catch {
            // ignore
        }
    },

    abortListening(): void {
        const mod = getNativeSpeechModule();
        clearSubscriptions();
        try {
            mod?.abort?.();
        } catch {
            // ignore
        }
    },
};
