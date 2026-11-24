export interface SpeechRecognitionCallbacks {
    locale?: string;
    onTranscript: (text: string, isFinal: boolean) => void;
    onError: (message: string) => void;
    onEnd: () => void;
}

function getBrowserSpeechConstructor(): any {
    if (typeof window === 'undefined') return null;
    return (
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition ||
        null
    );
}

function isMobileWebBrowser(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
}

let activeRecognition: any = null;
let accumulatedFinal = '';

export const SpeechService = {
    async getCapabilities(): Promise<{
        available: boolean;
        permissionGranted: boolean;
        supportsOnDevice: boolean;
    }> {
        const Ctor = getBrowserSpeechConstructor();
        const available = !!Ctor;
        let permissionGranted = false;

        if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
            try {
                const status = await navigator.permissions.query({
                    name: 'microphone' as PermissionName,
                });
                permissionGranted = status.state === 'granted';
            } catch {
                // Safari / browsers that don't support querying 'microphone' via Permissions API
                permissionGranted = false;
            }
        }

        return {
            available,
            permissionGranted,
            supportsOnDevice: false,
        };
    },

    async requestPermissions(): Promise<{ granted: boolean; error?: string }> {
        const Ctor = getBrowserSpeechConstructor();
        if (!Ctor) {
            return {
                granted: false,
                error: 'Web Speech API is not supported in this browser. Please try Chrome, Edge, or Safari.',
            };
        }

        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            return {
                granted: false,
                error: 'Microphone access requires a secure context (HTTPS or localhost).',
            };
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => t.stop());
            return { granted: true };
        } catch (err: any) {
            return {
                granted: false,
                error:
                    err?.name === 'NotAllowedError'
                        ? 'Microphone permission was denied in browser site settings.'
                        : err?.message || 'Unable to access microphone.',
            };
        }
    },

    async triggerOfflinePackDownload(
        _locale = 'en-IN'
    ): Promise<{ ok: boolean; message: string }> {
        return {
            ok: false,
            message: 'Browser speech recognition uses your browser’s built-in speech engine.',
        };
    },

    async startListening(callbacks: SpeechRecognitionCallbacks): Promise<void> {
        const Ctor = getBrowserSpeechConstructor();
        if (!Ctor) {
            callbacks.onError(
                'Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.'
            );
            callbacks.onEnd();
            return;
        }

        SpeechService.abortListening();
        accumulatedFinal = '';

        try {
            const recognition = new Ctor();
            activeRecognition = recognition;

            const isMobile = isMobileWebBrowser();
            recognition.lang = callbacks.locale || 'en-IN';
            recognition.interimResults = true;
            // Android Chrome & iOS Safari PWA work much more reliably with continuous=false
            recognition.continuous = !isMobile;
            recognition.maxAlternatives = 1;

            recognition.onresult = (event: any) => {
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const res = event.results[i];
                    const snippet = res[0]?.transcript || '';
                    if (res.isFinal) {
                        accumulatedFinal = `${accumulatedFinal} ${snippet}`.trim();
                    } else {
                        interim += snippet;
                    }
                }
                const combined = `${accumulatedFinal} ${interim}`.trim();
                callbacks.onTranscript(combined, !interim && !!accumulatedFinal);
            };

            recognition.onerror = (event: any) => {
                const code = event?.error || 'unknown';
                if (code === 'aborted') return;
                if (code === 'no-speech') {
                    callbacks.onError('No speech was heard. Tap the mic and try speaking again.');
                } else if (code === 'not-allowed' || code === 'service-not-allowed') {
                    callbacks.onError('Microphone permission is blocked. Allow microphone access in your browser.');
                } else {
                    callbacks.onError(`Speech recognition error (${code}).`);
                }
            };

            recognition.onend = () => {
                if (activeRecognition === recognition) {
                    activeRecognition = null;
                }
                callbacks.onEnd();
            };

            recognition.start();
        } catch (err: any) {
            activeRecognition = null;
            callbacks.onError(err?.message || 'Could not start browser speech recognition.');
            callbacks.onEnd();
        }
    },

    async stopListening(): Promise<void> {
        if (activeRecognition) {
            try {
                activeRecognition.stop();
            } catch {
                // ignore
            }
        }
    },

    abortListening(): void {
        if (activeRecognition) {
            const ref = activeRecognition;
            activeRecognition = null;
            try {
                ref.abort();
            } catch {
                // ignore
            }
        }
    },
};
