import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    CURATED_MODELS,
    formatBytes,
    SUPPORTED_SPEECH_LOCALES,
} from '@/src/services/voiceAi/modelCatalog';
import { SpeechService } from '@/src/services/voiceAi/speechService';
import {
    InstalledLocalModel,
    ParsedTransactionDraft,
    RuntimeKind,
} from '@/src/services/voiceAi/types';
import { VoiceAiOrchestrator } from '@/src/services/voiceAi/voiceAiOrchestrator';
import {
    selectHasReadyLocalModel,
    selectIsVoiceEntryReadyAndEnabled,
} from '@/src/store/voiceAiSlice';
import * as Clipboard from 'expo-clipboard';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

type ClientEnv = 'android_pwa' | 'ios_pwa' | 'windows' | 'mac' | 'linux';

function detectClientEnv(): ClientEnv {
    if (typeof navigator === 'undefined') return 'windows';
    const ua = (navigator.userAgent || '').toLowerCase();
    if (ua.includes('android')) return 'android_pwa';
    if (/iphone|ipad|ipod/.test(ua) || (ua.includes('mac') && (navigator.maxTouchPoints || 0) > 1)) {
        return 'ios_pwa';
    }
    if (ua.includes('mac')) return 'mac';
    if (ua.includes('linux')) return 'linux';
    return 'windows';
}

export default function VoiceAiSettingsSection() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const styles = createStyles(isDark);
    const dispatch = useDispatch();

    const voiceAi = useSelector((state: any) => state.voiceAi);
    const { accounts } = useSelector((state: any) => state.accounts);
    const { categories } = useSelector((state: any) => state.categories);
    const hasReadyModel = useSelector(selectHasReadyLocalModel);
    const isFullyReadyAndEnabled = useSelector(selectIsVoiceEntryReadyAndEnabled);

    const { settings, capabilities, download, isProbing, isModelLoadedInMemory } = voiceAi;

    const clientEnv = useMemo(() => detectClientEnv(), []);
    const isMobileWeb =
        Platform.OS === 'web' &&
        (clientEnv === 'android_pwa' ||
            clientEnv === 'ios_pwa' ||
            Boolean(capabilities?.isMobileWeb));

    const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
    const [webRuntimeTab, setWebRuntimeTab] = useState<'desktop' | 'webgpu'>(() => {
        if (settings.activeRuntime === 'ollama' || settings.activeRuntime === 'lmstudio') {
            return 'desktop';
        }
        if (settings.activeRuntime === 'webllm') return 'webgpu';
        return clientEnv === 'android_pwa' || clientEnv === 'ios_pwa' ? 'webgpu' : 'desktop';
    });

    // In-app confirmation modal (avoids window.confirm being silently blocked in Mobile PWAs)
    const [pendingConfirm, setPendingConfirm] = useState<{
        title: string;
        message: string;
        confirmLabel: string;
        destructive?: boolean;
        onConfirm: () => void;
    } | null>(null);
    const [inlineAlert, setInlineAlert] = useState<string | null>(null);

    // Step 2 voice test state
    const [isTestingMic, setIsTestingMic] = useState(false);
    const [micTestTranscript, setMicTestTranscript] = useState('');
    const [micStatusNote, setMicStatusNote] = useState<string | null>(null);

    // Desktop / Local Server URL inputs
    const [ollamaUrlInput, setOllamaUrlInput] = useState(
        settings.ollamaBaseUrl || 'http://localhost:11434'
    );
    const [lmStudioUrlInput, setLmStudioUrlInput] = useState(
        settings.lmStudioBaseUrl || 'http://localhost:1234'
    );
    const [copiedCmdLabel, setCopiedCmdLabel] = useState<string | null>(null);

    // Step 4 dry-run parse test state
    const [sampleInput, setSampleInput] = useState(
        'Spent 450 rupees on groceries from Bank Account yesterday'
    );
    const [isRunningTestParse, setIsRunningTestParse] = useState(false);
    const [testParseResult, setTestParseResult] = useState<ParsedTransactionDraft | null>(null);
    const [testParseError, setTestParseError] = useState<string | null>(null);

    const corsCommand = useMemo(() => {
        if (clientEnv === 'android_pwa') {
            return 'OLLAMA_ORIGINS="*" ollama serve';
        }
        if (clientEnv === 'ios_pwa') {
            return 'OLLAMA_HOST=0.0.0.0 OLLAMA_ORIGINS="*" ollama serve';
        }
        if (clientEnv === 'mac') {
            return 'launchctl setenv OLLAMA_ORIGINS "*"';
        }
        if (clientEnv === 'linux') {
            return 'OLLAMA_ORIGINS="*" ollama serve';
        }
        return '$env:OLLAMA_ORIGINS="*"; ollama serve';
    }, [clientEnv]);

    const handleCopy = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        setCopiedCmdLabel(label);
        setTimeout(() => setCopiedCmdLabel(null), 2200);
    };

    const handleRefreshProbe = async () => {
        const patched = await VoiceAiOrchestrator.saveSettingsPatch(dispatch, {
            ollamaBaseUrl: ollamaUrlInput.trim() || 'http://localhost:11434',
            lmStudioBaseUrl: lmStudioUrlInput.trim() || 'http://localhost:1234',
        });
        await VoiceAiOrchestrator.refreshCapabilities(dispatch, patched);
    };

    const handleToggleMasterEnable = async (nextVal: boolean) => {
        setInlineAlert(null);
        if (nextVal && !capabilities?.speechAvailable) {
            const msg = isMobileWeb
                ? 'Browser speech recognition is unavailable in this mobile browser. Open Unity Ledger in Chrome (Android) or Safari (iOS).'
                : 'Speech recognition is not available in this environment.';
            if (Platform.OS === 'web') setInlineAlert(msg);
            else Alert.alert('Speech Unavailable', msg);
            return;
        }
        if (nextVal && !hasReadyModel) {
            setActiveStep(3);
            return;
        }
        await VoiceAiOrchestrator.saveSettingsPatch(dispatch, {
            isEnabled: nextVal,
            userDisabled: !nextVal,
            wizardCompleted: nextVal ? true : settings.wizardCompleted,
        });
    };

    const handleSelectInstalledModel = async (item: InstalledLocalModel) => {
        await VoiceAiOrchestrator.saveSettingsPatch(dispatch, {
            activeRuntime: item.runtime,
            activeModelId: item.id,
            activeModelPathOrTag: item.pathOrTag,
        });
    };

    const handleTestMic = async () => {
        if (isTestingMic) {
            await SpeechService.stopListening();
            setIsTestingMic(false);
            return;
        }
        setMicStatusNote(null);
        setMicTestTranscript('');

        const perm = await SpeechService.requestPermissions();
        if (!perm.granted) {
            setMicStatusNote(perm.error || 'Permission was not granted.');
            return;
        }

        await VoiceAiOrchestrator.refreshCapabilities(dispatch, settings);
        setIsTestingMic(true);

        await SpeechService.startListening({
            locale: settings.speechLocale,
            onTranscript: (txt) => {
                setMicTestTranscript(txt);
            },
            onError: (err) => {
                setMicStatusNote(err);
                setIsTestingMic(false);
            },
            onEnd: () => {
                setIsTestingMic(false);
            },
        });
    };

    const handleDownloadOfflineSpeech = async () => {
        const res = await SpeechService.triggerOfflinePackDownload(settings.speechLocale);
        setMicStatusNote(res.message);
    };

    const confirmAndDownloadModel = (modelId: string, name: string, sizeMb: number, runtime: RuntimeKind) => {
        const startDownload = async () => {
            try {
                await VoiceAiOrchestrator.downloadAndActivateModel({
                    dispatch,
                    modelId,
                    runtime,
                    settings: {
                        ...settings,
                        ollamaBaseUrl: ollamaUrlInput.trim() || settings.ollamaBaseUrl,
                    },
                });
            } catch {
                // Error is reflected in download state
            }
        };

        const promptText =
            runtime === 'ollama'
                ? `Ask your local Ollama daemon to pull "${name}" (~${sizeMb} MB)? You can cancel anytime.`
                : runtime === 'webllm'
                  ? `Download "${name}" (~${sizeMb} MB) into your browser’s local WebGPU cache?`
                  : `Download "${name}" (~${sizeMb} MB) to this device? Wi-Fi is recommended.`;

        if (Platform.OS === 'web') {
            setPendingConfirm({
                title: 'Confirm Model Download',
                message: promptText,
                confirmLabel: runtime === 'ollama' ? 'Pull Model' : 'Download',
                onConfirm: () => {
                    setPendingConfirm(null);
                    startDownload();
                },
            });
            return;
        }

        Alert.alert('Confirm Model Download', promptText, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Download', onPress: startDownload },
        ]);
    };

    const handleDeleteInstalledModel = (item: InstalledLocalModel) => {
        const doDelete = async () => {
            try {
                await VoiceAiOrchestrator.removeInstalledModel({
                    dispatch,
                    modelId: item.id,
                    runtime: item.runtime,
                    pathOrTag: item.pathOrTag,
                    settings,
                });
            } catch (err: any) {
                const msg = err?.message || 'Could not remove model.';
                if (Platform.OS === 'web') setInlineAlert(msg);
                else Alert.alert('Delete Error', msg);
            }
        };

        const msg = `Remove "${item.name}" from local storage?`;
        if (Platform.OS === 'web') {
            setPendingConfirm({
                title: 'Remove Local Model',
                message: msg,
                confirmLabel: 'Delete',
                destructive: true,
                onConfirm: () => {
                    setPendingConfirm(null);
                    doDelete();
                },
            });
            return;
        }
        Alert.alert('Remove Local Model', msg, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]);
    };

    const handleImportLocalGguf = async () => {
        try {
            const ok = await VoiceAiOrchestrator.importLocalGgufModel(dispatch, settings);
            if (ok) {
                Alert.alert('Model Imported', 'Your .gguf file is ready to use!');
            }
        } catch (err: any) {
            Alert.alert('Import Failed', err?.message || 'Unable to import .gguf file.');
        }
    };

    const handleRunDryParse = async () => {
        setIsRunningTestParse(true);
        setTestParseError(null);
        setTestParseResult(null);
        try {
            const draft = await VoiceAiOrchestrator.parseTranscriptToDraft({
                transcript: sampleInput,
                accounts:
                    accounts?.length > 0
                        ? accounts
                        : [
                              { id: 'demo-cash', name: 'Cash', type: 'Cash' },
                              { id: 'demo-bank', name: 'Bank Account', type: 'Checking' },
                          ],
                categories:
                    categories?.length > 0
                        ? categories
                        : [
                              {
                                  id: 'demo-food',
                                  name: 'Food & Dining',
                                  type: 'Expense',
                                  subcategories: ['Groceries', 'Restaurants'],
                              },
                          ],
                settings,
            });
            setTestParseResult(draft);
        } catch (err: any) {
            setTestParseError(err?.message || 'Local parse test failed.');
        } finally {
            setIsRunningTestParse(false);
        }
    };

    const installedModels: InstalledLocalModel[] = capabilities?.installedLocalModels || [];
    const isDownloading = download.status === 'downloading' || download.status === 'paused';

    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        >
            {/* 1. Master Status & Enable Card */}
            <View style={styles.card}>
                <View style={styles.statusTopRow}>
                    <View style={styles.statusBadgeRow}>
                        <View
                            style={[
                                styles.statusDot,
                                {
                                    backgroundColor: isFullyReadyAndEnabled
                                        ? '#10B981'
                                        : hasReadyModel
                                          ? '#3B82F6'
                                          : '#F59E0B',
                                },
                            ]}
                        />
                        <Text style={styles.statusHeadline}>
                            {isFullyReadyAndEnabled
                                ? 'Voice Entry Active'
                                : hasReadyModel
                                  ? 'Local AI Ready (Disabled)'
                                  : 'Setup Needed for Voice Entry'}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.refreshBtn}
                        onPress={handleRefreshProbe}
                        disabled={isProbing}
                    >
                        {isProbing ? (
                            <ActivityIndicator size="small" color="#3B82F6" />
                        ) : (
                            <IconSymbol name="arrow.clockwise" size={18} color="#3B82F6" />
                        )}
                        <Text style={styles.refreshBtnText}>Re-check</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.cardSubtext}>
                    100% private & local. Voice buttons on Dashboard and Transactions appear only
                    when a local speech + open-source AI model is ready and enabled below.
                </Text>

                {inlineAlert ? (
                    <Text style={[styles.errorInlineText, { marginTop: 8 }]}>{inlineAlert}</Text>
                ) : null}

                <View style={styles.toggleRow}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={styles.toggleLabel}>Enable Voice Transaction Entry</Text>
                        <Text style={styles.toggleHint}>
                            {hasReadyModel
                                ? `Using ${settings.activeRuntime?.toUpperCase()} • ${settings.activeModelPathOrTag || settings.activeModelId}`
                                : 'Complete Step 3 below (or start Ollama) to enable this toggle.'}
                        </Text>
                    </View>
                    <Switch
                        value={Boolean(settings.isEnabled && hasReadyModel)}
                        onValueChange={handleToggleMasterEnable}
                        disabled={!hasReadyModel || !capabilities?.speechAvailable}
                        trackColor={{ false: '#6B7280', true: '#2563EB' }}
                    />
                </View>

                {isModelLoadedInMemory ? (
                    <View style={styles.memoryStrip}>
                        <Text style={styles.memoryText}>
                            Model loaded in memory (auto-unloads after 2m idle)
                        </Text>
                        <TouchableOpacity
                            onPress={() => VoiceAiOrchestrator.unloadMemory()}
                            style={styles.unloadChip}
                        >
                            <Text style={styles.unloadChipText}>Unload Now</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>

            {/* 2. Fast-Track Detected Local Models Card (if any model is already present) */}
            {installedModels.length > 0 ? (
                <View style={styles.card}>
                    <View style={styles.sectionTitleRow}>
                        <IconSymbol name="checkmark.circle.fill" size={20} color="#10B981" />
                        <Text style={styles.sectionTitle}>
                            Detected Models on Your Device ({installedModels.length})
                        </Text>
                    </View>
                    <Text style={styles.cardSubtext}>
                        Tap any model below to make it active—no extra download needed.
                    </Text>

                    <View style={{ gap: 8, marginTop: 10 }}>
                        {installedModels.map((item) => {
                            const isSelected =
                                settings.activeRuntime === item.runtime &&
                                (settings.activeModelPathOrTag === item.pathOrTag ||
                                    settings.activeModelId === item.id);
                            return (
                                <View
                                    key={`${item.runtime}-${item.pathOrTag}`}
                                    style={[
                                        styles.installedRow,
                                        isSelected && styles.installedRowActive,
                                    ]}
                                >
                                    <TouchableOpacity
                                        style={{ flex: 1 }}
                                        onPress={() => handleSelectInstalledModel(item)}
                                    >
                                        <Text style={styles.installedName}>{item.name}</Text>
                                        <Text style={styles.installedMeta}>
                                            Runtime: {item.runtime}
                                            {item.sizeBytes
                                                ? ` • ${formatBytes(item.sizeBytes)}`
                                                : ''}
                                        </Text>
                                    </TouchableOpacity>

                                    <View style={styles.installedActions}>
                                        {isSelected ? (
                                            <View style={styles.activePill}>
                                                <Text style={styles.activePillText}>Active</Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                style={styles.usePill}
                                                onPress={() => handleSelectInstalledModel(item)}
                                            >
                                                <Text style={styles.usePillText}>Use</Text>
                                            </TouchableOpacity>
                                        )}

                                        {item.runtime !== 'lmstudio' ? (
                                            <TouchableOpacity
                                                onPress={() => handleDeleteInstalledModel(item)}
                                                style={{ padding: 4 }}
                                            >
                                                <IconSymbol
                                                    name="trash.fill"
                                                    size={18}
                                                    color="#EF4444"
                                                />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
            ) : null}

            {/* 3. Step-by-Step User-Controlled Setup Wizard */}
            <View style={styles.card}>
                <View style={styles.sectionTitleRow}>
                    <IconSymbol name="sparkles" size={20} color="#3B82F6" />
                    <Text style={styles.sectionTitle}>Step-by-Step Guided Setup</Text>
                </View>
                <Text style={styles.cardSubtext}>
                    You control every step—nothing is downloaded or enabled without your approval.
                </Text>

                {/* Stepper Pills */}
                <View style={styles.stepperRow}>
                    {[
                        { num: 1 as const, label: '1. Check' },
                        { num: 2 as const, label: '2. Voice' },
                        { num: 3 as const, label: '3. AI Model' },
                        { num: 4 as const, label: '4. Test' },
                    ].map((s) => {
                        const active = activeStep === s.num;
                        return (
                            <TouchableOpacity
                                key={s.num}
                                style={[styles.stepPill, active && styles.stepPillActive]}
                                onPress={() => setActiveStep(s.num)}
                            >
                                <Text
                                    style={[
                                        styles.stepPillText,
                                        active && styles.stepPillTextActive,
                                    ]}
                                >
                                    {s.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* STEP 1: System & Capability Check */}
                {activeStep === 1 ? (
                    <View style={styles.stepBody}>
                        <Text style={styles.stepTitle}>Step 1: Device & Environment Check</Text>

                        {isMobileWeb ? (
                            <View style={styles.mobilePwaBanner}>
                                <IconSymbol name="globe" size={18} color="#2563EB" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.mobilePwaTitle}>
                                        Mobile PWA Detected (
                                        {clientEnv === 'ios_pwa' ? 'iOS' : 'Android'})
                                    </Text>
                                    <Text style={styles.mobilePwaSub}>
                                        In a Mobile PWA, local AI runs directly in your phone’s
                                        browser via WebGPU (recommended: Lite 0.5B model ~398 MB) or
                                        connects to a local/Wi-Fi Ollama server.
                                    </Text>
                                </View>
                            </View>
                        ) : null}

                        <View style={styles.checkItem}>
                            <IconSymbol
                                name={
                                    capabilities?.speechAvailable
                                        ? 'checkmark.circle.fill'
                                        : 'exclamationmark.triangle.fill'
                                }
                                size={20}
                                color={capabilities?.speechAvailable ? '#10B981' : '#F59E0B'}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.checkLabel}>
                                    {Platform.OS === 'web'
                                        ? isMobileWeb
                                            ? 'Mobile Browser Speech Recognition'
                                            : 'Browser Web Speech API'
                                        : 'OS Native Speech Recognizer'}
                                </Text>
                                <Text style={styles.checkSub}>
                                    {capabilities?.speechAvailable
                                        ? 'Supported and ready for voice-to-text.'
                                        : isMobileWeb
                                          ? clientEnv === 'ios_pwa'
                                              ? 'Enable Dictation in iOS Settings › General › Keyboard, and open in Safari.'
                                              : 'Use Chrome on Android and ensure Google Speech Services is enabled.'
                                          : Platform.OS === 'web'
                                            ? 'Not supported in this browser (Firefox lacks full Web Speech API). Use Chrome, Edge, or Safari.'
                                            : 'Requires an Expo Development Build (npx expo run:android / run:ios) on mobile.'}
                                </Text>
                            </View>
                        </View>

                        {Platform.OS !== 'web' ? (
                            <View style={styles.checkItem}>
                                <IconSymbol
                                    name={
                                        capabilities?.nativeLlamaAvailable
                                            ? 'checkmark.circle.fill'
                                            : 'exclamationmark.triangle.fill'
                                    }
                                    size={20}
                                    color={
                                        capabilities?.nativeLlamaAvailable ? '#10B981' : '#F59E0B'
                                    }
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.checkLabel}>
                                        On-Device GGUF Engine (llama.rn)
                                    </Text>
                                    <Text style={styles.checkSub}>
                                        {capabilities?.nativeLlamaAvailable
                                            ? `Native C++ engine active • Free storage: ${formatBytes(capabilities.freeDiskBytes)}`
                                            : 'Currently running in Expo Go. Build a Development Client (npx expo run:android or npx expo run:ios) to run local GGUF models.'}
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <>
                                <View style={styles.checkItem}>
                                    <IconSymbol
                                        name={
                                            capabilities?.webGpuAvailable
                                                ? 'checkmark.circle.fill'
                                                : 'exclamationmark.triangle.fill'
                                        }
                                        size={20}
                                        color={
                                            capabilities?.webGpuAvailable ? '#10B981' : '#F59E0B'
                                        }
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.checkLabel}>
                                            {isMobileWeb
                                                ? 'On-Device Mobile WebGPU AI'
                                                : 'In-Browser WebGPU Acceleration'}
                                        </Text>
                                        <Text style={styles.checkSub}>
                                            {capabilities?.webGpuAvailable
                                                ? `WebGPU ready (${capabilities.webGpuSupportsF16 ? 'FP16' : 'FP32 fallback'}) • Cache headroom: ${formatBytes(capabilities.freeDiskBytes)}`
                                                : isMobileWeb
                                                  ? clientEnv === 'ios_pwa'
                                                      ? 'WebGPU is off on this iOS Safari version. Update iOS or enable WebGPU in Settings › Apps › Safari › Advanced › Feature Flags, OR use a Wi-Fi Ollama server in Step 3.'
                                                      : 'WebGPU is unavailable on this Android Chrome/GPU. Update Chrome (or enable chrome://flags/#enable-unsafe-webgpu), OR use Termux / Wi-Fi Ollama in Step 3.'
                                                  : 'WebGPU unavailable in this browser — use Desktop Ollama/LM Studio or Chrome/Edge.'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.checkItem}>
                                    <IconSymbol
                                        name={
                                            capabilities?.ollama?.reachable ||
                                            capabilities?.lmstudio?.reachable
                                                ? 'checkmark.circle.fill'
                                                : 'cpu'
                                        }
                                        size={20}
                                        color={
                                            capabilities?.ollama?.reachable ||
                                            capabilities?.lmstudio?.reachable
                                                ? '#10B981'
                                                : '#6B7280'
                                        }
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.checkLabel}>
                                            {isMobileWeb
                                                ? 'Local / Wi-Fi AI Server (Optional Fallback)'
                                                : 'Desktop AI Server (Ollama / LM Studio)'}
                                        </Text>
                                        <Text style={styles.checkSub}>
                                            {capabilities?.ollama?.reachable
                                                ? `Ollama connected (${capabilities.ollama.models.length} model(s) found)`
                                                : capabilities?.lmstudio?.reachable
                                                  ? `LM Studio connected (${capabilities.lmstudio.models.length} model(s) found)`
                                                  : isMobileWeb
                                                    ? 'Optional: connect to Ollama on Android (Termux) or your PC/Mac over Wi-Fi in Step 3.'
                                                    : 'Not detected yet — can be connected in Step 3.'}
                                        </Text>
                                    </View>
                                </View>
                            </>
                        )}

                        <TouchableOpacity
                            style={styles.primaryStepBtn}
                            onPress={() => setActiveStep(2)}
                        >
                            <Text style={styles.primaryStepBtnText}>
                                Continue to Step 2 (Voice Check) →
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {/* STEP 2: Microphone & Speech Language */}
                {activeStep === 2 ? (
                    <View style={styles.stepBody}>
                        <Text style={styles.stepTitle}>
                            Step 2: Microphone Permission & Recognition Language
                        </Text>

                        <Text style={styles.fieldCaption}>Select Speech Language</Text>
                        <View style={styles.localeWrap}>
                            {SUPPORTED_SPEECH_LOCALES.map((loc) => {
                                const selected = settings.speechLocale === loc.code;
                                return (
                                    <TouchableOpacity
                                        key={loc.code}
                                        style={[
                                            styles.localeChip,
                                            selected && styles.localeChipActive,
                                        ]}
                                        onPress={() =>
                                            VoiceAiOrchestrator.saveSettingsPatch(dispatch, {
                                                speechLocale: loc.code,
                                            })
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.localeChipText,
                                                selected && styles.localeChipTextActive,
                                            ]}
                                        >
                                            {loc.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.testMicBox}>
                            <TouchableOpacity
                                style={[
                                    styles.micTestBtn,
                                    isTestingMic && { backgroundColor: '#EF4444' },
                                ]}
                                onPress={handleTestMic}
                            >
                                <IconSymbol
                                    name={isTestingMic ? 'stop.fill' : 'mic.fill'}
                                    size={18}
                                    color="#FFFFFF"
                                />
                                <Text style={styles.micTestBtnText}>
                                    {isTestingMic
                                        ? 'Stop Microphone Test'
                                        : 'Grant Permission & Test Mic'}
                                </Text>
                            </TouchableOpacity>

                            {Platform.OS === 'android' ? (
                                <TouchableOpacity
                                    style={styles.secondaryActionBtn}
                                    onPress={handleDownloadOfflineSpeech}
                                >
                                    <IconSymbol
                                        name="arrow.down.circle.fill"
                                        size={16}
                                        color="#2563EB"
                                    />
                                    <Text style={styles.secondaryActionText}>
                                        Request Android Offline Voice Pack ({settings.speechLocale})
                                    </Text>
                                </TouchableOpacity>
                            ) : null}

                            {micTestTranscript ? (
                                <Text style={styles.micTranscriptPreview}>
                                    Heard: “{micTestTranscript}”
                                </Text>
                            ) : null}
                            {micStatusNote ? (
                                <Text style={styles.micNoteText}>{micStatusNote}</Text>
                            ) : null}
                        </View>

                        <TouchableOpacity
                            style={styles.primaryStepBtn}
                            onPress={() => setActiveStep(3)}
                        >
                            <Text style={styles.primaryStepBtnText}>
                                Continue to Step 3 (Choose AI Model) →
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {/* STEP 3: Model Selection, Download, or Ollama Setup */}
                {activeStep === 3 ? (
                    <View style={styles.stepBody}>
                        <Text style={styles.stepTitle}>
                            Step 3: Set Up a Small Open-Source AI Model
                        </Text>

                        {/* Live Download Progress Banner */}
                        {isDownloading || download.status === 'error' ? (
                            <View style={styles.downloadProgressBox}>
                                <View style={styles.downloadHeaderRow}>
                                    <Text style={styles.downloadTitle}>
                                        {download.status === 'paused'
                                            ? 'Download Paused'
                                            : download.status === 'error'
                                              ? 'Setup Error'
                                              : `Downloading (${Math.round(download.progress * 100)}%)`}
                                    </Text>
                                    <Text style={styles.downloadBytes}>
                                        {download.totalBytes > 0
                                            ? `${formatBytes(download.downloadedBytes)} / ${formatBytes(download.totalBytes)}`
                                            : ''}
                                    </Text>
                                </View>

                                {download.status !== 'error' ? (
                                    <View style={styles.progressTrack}>
                                        <View
                                            style={[
                                                styles.progressFill,
                                                {
                                                    width: `${Math.max(
                                                        2,
                                                        Math.round(download.progress * 100)
                                                    )}%`,
                                                },
                                            ]}
                                        />
                                    </View>
                                ) : null}

                                <Text style={styles.downloadSubtext}>
                                    {download.error || download.message || 'Working...'}
                                </Text>

                                <View style={styles.downloadBtnsRow}>
                                    {Platform.OS !== 'web' && download.status === 'downloading' ? (
                                        <TouchableOpacity
                                            style={styles.smallCtrlBtn}
                                            onPress={() =>
                                                VoiceAiOrchestrator.pauseActiveDownload(dispatch)
                                            }
                                        >
                                            <Text style={styles.smallCtrlBtnText}>Pause</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                    {Platform.OS !== 'web' && download.status === 'paused' ? (
                                        <TouchableOpacity
                                            style={styles.smallCtrlBtn}
                                            onPress={() =>
                                                VoiceAiOrchestrator.resumeActiveDownload(
                                                    dispatch,
                                                    settings,
                                                    download.modelId
                                                )
                                            }
                                        >
                                            <Text style={styles.smallCtrlBtnText}>Resume</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                    <TouchableOpacity
                                        style={[styles.smallCtrlBtn, { borderColor: '#EF4444' }]}
                                        onPress={() =>
                                            VoiceAiOrchestrator.cancelActiveDownload(dispatch)
                                        }
                                    >
                                        <Text style={[styles.smallCtrlBtnText, { color: '#EF4444' }]}>
                                            Cancel
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : null}

                        {Platform.OS === 'web' ? (
                            <>
                                {/* Web Runtime Switcher */}
                                <View style={styles.runtimeTabsRow}>
                                    <TouchableOpacity
                                        style={[
                                            styles.runtimeTab,
                                            webRuntimeTab === 'webgpu' && styles.runtimeTabActive,
                                        ]}
                                        onPress={() => setWebRuntimeTab('webgpu')}
                                    >
                                        <Text
                                            style={[
                                                styles.runtimeTabText,
                                                webRuntimeTab === 'webgpu' &&
                                                    styles.runtimeTabTextActive,
                                            ]}
                                        >
                                            {isMobileWeb
                                                ? 'On-Device Mobile AI (WebGPU)'
                                                : 'In-Browser (WebGPU)'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.runtimeTab,
                                            webRuntimeTab === 'desktop' && styles.runtimeTabActive,
                                        ]}
                                        onPress={() => setWebRuntimeTab('desktop')}
                                    >
                                        <Text
                                            style={[
                                                styles.runtimeTabText,
                                                webRuntimeTab === 'desktop' &&
                                                    styles.runtimeTabTextActive,
                                            ]}
                                        >
                                            {isMobileWeb
                                                ? 'Local / Wi-Fi Server'
                                                : 'Desktop AI (Ollama / LM Studio)'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {webRuntimeTab === 'desktop' ? (
                                    <View style={styles.guideBox}>
                                        <Text style={styles.guideHeading}>
                                            {isMobileWeb
                                                ? clientEnv === 'android_pwa'
                                                    ? 'Connect Ollama on Android (Termux) or Home Wi-Fi PC'
                                                    : 'Connect to Ollama on Your Home Wi-Fi PC / Mac'
                                                : 'Connect Ollama or LM Studio on Your Computer'}
                                        </Text>
                                        {isMobileWeb ? (
                                            <>
                                                <Text style={styles.guideStep}>
                                                    {clientEnv === 'android_pwa'
                                                        ? '1. On Android: Install Termux (F-Droid) and run Ollama locally on http://localhost:11434, OR run Ollama on your PC/Mac on the same Wi-Fi.'
                                                        : '1. On your PC/Mac on the same Wi-Fi, install Ollama from ollama.com/download and start it listening on your LAN IP.'}
                                                </Text>
                                                <Text style={styles.guideStep}>
                                                    2. Start Ollama with browser access enabled:
                                                </Text>
                                            </>
                                        ) : (
                                            <>
                                                <Text style={styles.guideStep}>
                                                    1. Install Ollama from{' '}
                                                    <Text
                                                        style={styles.linkText}
                                                        onPress={() =>
                                                            Linking.openURL(
                                                                'https://ollama.com/download'
                                                            )
                                                        }
                                                    >
                                                        ollama.com/download
                                                    </Text>{' '}
                                                    (free & open-source).
                                                </Text>
                                                <Text style={styles.guideStep}>
                                                    2. Allow your browser to connect to localhost
                                                    (CORS) by running this command for{' '}
                                                    {clientEnv.toUpperCase()}:
                                                </Text>
                                            </>
                                        )}
                                        <View style={styles.codeCopyRow}>
                                            <Text style={styles.codeText} numberOfLines={1}>
                                                {corsCommand}
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.copyBtn}
                                                onPress={() => handleCopy(corsCommand, 'cors')}
                                            >
                                                <IconSymbol
                                                    name="doc.on.doc"
                                                    size={14}
                                                    color="#FFFFFF"
                                                />
                                                <Text style={styles.copyBtnText}>
                                                    {copiedCmdLabel === 'cors' ? 'Copied!' : 'Copy'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={styles.fieldCaption}>Ollama Endpoint URL</Text>
                                        <View style={styles.endpointRow}>
                                            <TextInput
                                                style={styles.endpointInput}
                                                value={ollamaUrlInput}
                                                onChangeText={setOllamaUrlInput}
                                                placeholder="http://localhost:11434"
                                                placeholderTextColor="#9CA3AF"
                                            />
                                            <TouchableOpacity
                                                style={styles.probeBtn}
                                                onPress={handleRefreshProbe}
                                            >
                                                <Text style={styles.probeBtnText}>
                                                    Test Connection
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={styles.fieldCaption}>
                                            LM Studio Endpoint URL (Optional)
                                        </Text>
                                        <TextInput
                                            style={styles.endpointInput}
                                            value={lmStudioUrlInput}
                                            onChangeText={setLmStudioUrlInput}
                                            placeholder="http://localhost:1234"
                                            placeholderTextColor="#9CA3AF"
                                        />

                                        {capabilities?.ollama?.reachable ? (
                                            <View style={{ marginTop: 12, gap: 8 }}>
                                                <Text style={styles.guideHeading}>
                                                    3. Pull a Recommended Small Model into Ollama
                                                    (1-Click)
                                                </Text>
                                                {CURATED_MODELS.map((spec) => {
                                                    const alreadyInOllama =
                                                        capabilities.ollama.models.some(
                                                            (m: string) =>
                                                                m === spec.ollamaTag ||
                                                                m.startsWith(`${spec.ollamaTag}`)
                                                        );
                                                    return (
                                                        <View
                                                            key={spec.id}
                                                            style={styles.catalogCard}
                                                        >
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={styles.catalogTitle}>
                                                                    {spec.name}{' '}
                                                                    {spec.recommended
                                                                        ? '★ Recommended'
                                                                        : ''}
                                                                </Text>
                                                                <Text style={styles.catalogDesc}>
                                                                    {spec.description}
                                                                </Text>
                                                                <Text style={styles.catalogMeta}>
                                                                    Ollama tag: {spec.ollamaTag} • ~
                                                                    {spec.approxSizeMb} MB
                                                                </Text>
                                                            </View>
                                                            <TouchableOpacity
                                                                style={[
                                                                    styles.downloadBtn,
                                                                    alreadyInOllama && {
                                                                        backgroundColor: '#10B981',
                                                                    },
                                                                ]}
                                                                disabled={isDownloading}
                                                                onPress={() =>
                                                                    alreadyInOllama
                                                                        ? VoiceAiOrchestrator.saveSettingsPatch(
                                                                              dispatch,
                                                                              {
                                                                                  activeRuntime:
                                                                                      'ollama',
                                                                                  activeModelId:
                                                                                      spec.id,
                                                                                  activeModelPathOrTag:
                                                                                      spec.ollamaTag,
                                                                              }
                                                                          )
                                                                        : confirmAndDownloadModel(
                                                                              spec.id,
                                                                              spec.name,
                                                                              spec.approxSizeMb,
                                                                              'ollama'
                                                                          )
                                                                }
                                                            >
                                                                <Text style={styles.downloadBtnText}>
                                                                    {alreadyInOllama
                                                                        ? 'Select'
                                                                        : 'Pull Model'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        ) : null}
                                    </View>
                                ) : (
                                    /* WebGPU Browser Catalog */
                                    <View style={{ gap: 10, marginTop: 8 }}>
                                        <Text style={styles.cardSubtext}>
                                            {isMobileWeb
                                                ? 'Runs directly on your phone inside the PWA via WebGPU (no extra apps). Pick Qwen 2.5 0.5B (Lite, ~398 MB) first for best stability on mobile browser memory.'
                                                : 'Runs directly inside your browser via WebGPU with zero external software. Model weights are cached locally in browser storage.'}
                                        </Text>
                                        {!capabilities?.webGpuAvailable ? (
                                            <View style={styles.mobileWarnBox}>
                                                <Text style={styles.mobileWarnText}>
                                                    {clientEnv === 'ios_pwa'
                                                        ? 'WebGPU is currently disabled in your iOS Safari. Enable WebGPU in Settings › Apps › Safari › Advanced › Feature Flags (or update iOS), then tap Re-check above.'
                                                        : clientEnv === 'android_pwa'
                                                          ? 'WebGPU is unavailable in your Android browser. Update Chrome to the latest version (or enable chrome://flags/#enable-unsafe-webgpu), or switch to the Local / Wi-Fi Server tab.'
                                                          : 'WebGPU is not available in this browser. Try Chrome/Edge 113+ or switch to Desktop AI (Ollama).'}
                                                </Text>
                                            </View>
                                        ) : null}
                                        {CURATED_MODELS.map((spec) => {
                                            const cachedEntry = installedModels.find(
                                                (m) =>
                                                    m.runtime === 'webllm' &&
                                                    (m.pathOrTag === spec.webllmModelId ||
                                                        m.pathOrTag === spec.webllmModelIdF32)
                                            );
                                            const isRecommendedForDevice = isMobileWeb
                                                ? spec.tier === 'lite'
                                                : Boolean(spec.recommended);
                                            return (
                                                <View key={spec.id} style={styles.catalogCard}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.catalogTitle}>
                                                            {spec.name}{' '}
                                                            {isRecommendedForDevice
                                                                ? isMobileWeb
                                                                    ? '★ Best for Mobile'
                                                                    : '★'
                                                                : ''}
                                                        </Text>
                                                        <Text style={styles.catalogDesc}>
                                                            {spec.description}
                                                        </Text>
                                                        <Text style={styles.catalogMeta}>
                                                            License: {spec.license} • ~
                                                            {spec.approxSizeMb} MB
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.downloadBtn,
                                                            cachedEntry && {
                                                                backgroundColor: '#10B981',
                                                            },
                                                            !capabilities?.webGpuAvailable && {
                                                                opacity: 0.45,
                                                            },
                                                        ]}
                                                        disabled={
                                                            isDownloading ||
                                                            !capabilities?.webGpuAvailable
                                                        }
                                                        onPress={() =>
                                                            cachedEntry
                                                                ? VoiceAiOrchestrator.saveSettingsPatch(
                                                                      dispatch,
                                                                      {
                                                                          activeRuntime: 'webllm',
                                                                          activeModelId: spec.id,
                                                                          activeModelPathOrTag:
                                                                              cachedEntry.pathOrTag,
                                                                      }
                                                                  )
                                                                : confirmAndDownloadModel(
                                                                      spec.id,
                                                                      spec.name,
                                                                      spec.approxSizeMb,
                                                                      'webllm'
                                                                  )
                                                        }
                                                    >
                                                        <Text style={styles.downloadBtnText}>
                                                            {cachedEntry ? 'Cached ✓' : 'Download'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </>
                        ) : (
                            /* Mobile Native GGUF Catalog */
                            <View style={{ gap: 10 }}>
                                {CURATED_MODELS.map((spec) => {
                                    const installed = installedModels.find(
                                        (m) => m.runtime === 'llama_rn' && m.id === spec.id
                                    );
                                    return (
                                        <View key={spec.id} style={styles.catalogCard}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.catalogTitle}>
                                                    {spec.name} {spec.recommended ? '★' : ''}
                                                </Text>
                                                <Text style={styles.catalogDesc}>
                                                    {spec.description}
                                                </Text>
                                                <Text style={styles.catalogMeta}>
                                                    {spec.license} • ~{spec.approxSizeMb} MB •{' '}
                                                    {spec.minRamGb}+ GB RAM
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[
                                                    styles.downloadBtn,
                                                    installed && { backgroundColor: '#10B981' },
                                                ]}
                                                disabled={isDownloading}
                                                onPress={() =>
                                                    installed
                                                        ? handleSelectInstalledModel(installed)
                                                        : confirmAndDownloadModel(
                                                              spec.id,
                                                              spec.name,
                                                              spec.approxSizeMb,
                                                              'llama_rn'
                                                          )
                                                }
                                            >
                                                <Text style={styles.downloadBtnText}>
                                                    {installed ? 'Ready ✓' : 'Download'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}

                                <TouchableOpacity
                                    style={styles.secondaryActionBtn}
                                    onPress={handleImportLocalGguf}
                                >
                                    <IconSymbol name="folder.fill" size={16} color="#2563EB" />
                                    <Text style={styles.secondaryActionText}>
                                        Use Existing .gguf Model File on Phone
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.primaryStepBtn, !hasReadyModel && { opacity: 0.5 }]}
                            disabled={!hasReadyModel}
                            onPress={() => setActiveStep(4)}
                        >
                            <Text style={styles.primaryStepBtnText}>
                                Continue to Step 4 (Verify & Enable) →
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {/* STEP 4: Sample Parse Verification & Final Enable */}
                {activeStep === 4 ? (
                    <View style={styles.stepBody}>
                        <Text style={styles.stepTitle}>
                            Step 4: Test Local Parsing & Enable Voice Entry
                        </Text>
                        <Text style={styles.cardSubtext}>
                            Run a quick local test phrase to verify your model extracts transaction
                            fields accurately on this device.
                        </Text>

                        <Text style={styles.fieldCaption}>Sample Phrase</Text>
                        <TextInput
                            style={styles.endpointInput}
                            value={sampleInput}
                            onChangeText={setSampleInput}
                        />

                        <TouchableOpacity
                            style={[
                                styles.secondaryActionBtn,
                                (!hasReadyModel || isRunningTestParse) && { opacity: 0.5 },
                            ]}
                            disabled={!hasReadyModel || isRunningTestParse}
                            onPress={handleRunDryParse}
                        >
                            {isRunningTestParse ? (
                                <ActivityIndicator size="small" color="#2563EB" />
                            ) : (
                                <IconSymbol name="bolt.fill" size={16} color="#2563EB" />
                            )}
                            <Text style={styles.secondaryActionText}>
                                {isRunningTestParse
                                    ? 'Running Local Model...'
                                    : 'Run Local Test Parse'}
                            </Text>
                        </TouchableOpacity>

                        {testParseResult ? (
                            <View style={styles.testResultCard}>
                                <Text style={styles.testResultTitle}>
                                    ✓ Parsed in {testParseResult.latencyMs} ms
                                </Text>
                                <Text style={styles.testResultLine}>
                                    Type: {testParseResult.type} • Amount: ₹
                                    {testParseResult.amount || '0'}
                                </Text>
                                <Text style={styles.testResultLine}>
                                    Subcategory: {testParseResult.subcategoryName || '(general)'} •
                                    Note: {testParseResult.note || '(none)'}
                                </Text>
                            </View>
                        ) : null}

                        {testParseError ? (
                            <Text style={styles.errorInlineText}>{testParseError}</Text>
                        ) : null}

                        <TouchableOpacity
                            style={[
                                styles.primaryStepBtn,
                                { backgroundColor: '#10B981' },
                                (!hasReadyModel || !capabilities?.speechAvailable) && {
                                    opacity: 0.5,
                                },
                            ]}
                            disabled={!hasReadyModel || !capabilities?.speechAvailable}
                            onPress={() => handleToggleMasterEnable(true)}
                        >
                            <Text style={styles.primaryStepBtnText}>
                                {isFullyReadyAndEnabled
                                    ? '✓ Voice Entry Enabled & Active'
                                    : 'Enable Voice Transaction Entry'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>

            {/* In-App Confirmation Modal (reliable on Mobile PWAs where window.confirm can be blocked) */}
            <Modal
                visible={!!pendingConfirm}
                transparent
                animationType="fade"
                onRequestClose={() => setPendingConfirm(null)}
            >
                <Pressable
                    style={styles.confirmOverlay}
                    onPress={() => setPendingConfirm(null)}
                >
                    <View
                        style={styles.confirmCard}
                        onStartShouldSetResponder={() => true}
                    >
                        <Text style={styles.confirmTitle}>
                            {pendingConfirm?.title || 'Confirm'}
                        </Text>
                        <Text style={styles.confirmMessage}>
                            {pendingConfirm?.message || ''}
                        </Text>
                        <View style={styles.confirmActionsRow}>
                            <TouchableOpacity
                                style={styles.confirmCancelBtn}
                                onPress={() => setPendingConfirm(null)}
                            >
                                <Text style={styles.confirmCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.confirmOkBtn,
                                    pendingConfirm?.destructive && { backgroundColor: '#EF4444' },
                                ]}
                                onPress={() => pendingConfirm?.onConfirm()}
                            >
                                <Text style={styles.confirmOkText}>
                                    {pendingConfirm?.confirmLabel || 'Confirm'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </ScrollView>
    );
}

const createStyles = (isDark: boolean) =>
    StyleSheet.create({
        container: {
            paddingBottom: 44,
            gap: 16,
        },
        card: {
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
        },
        statusTopRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        statusBadgeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flex: 1,
        },
        statusDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
        },
        statusHeadline: {
            fontSize: 17,
            fontWeight: '800',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        refreshBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 12,
            backgroundColor: isDark ? '#111827' : '#EFF6FF',
        },
        refreshBtnText: {
            fontSize: 12,
            fontWeight: '700',
            color: '#3B82F6',
        },
        cardSubtext: {
            fontSize: 13,
            lineHeight: 19,
            color: isDark ? '#9CA3AF' : '#4B5563',
        },
        toggleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: isDark ? '#374151' : '#F3F4F6',
        },
        toggleLabel: {
            fontSize: 15,
            fontWeight: '700',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        toggleHint: {
            fontSize: 12,
            color: isDark ? '#9CA3AF' : '#6B7280',
            marginTop: 2,
        },
        memoryStrip: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: isDark ? '#111827' : '#F3F4F6',
        },
        memoryText: {
            fontSize: 12,
            color: isDark ? '#D1D5DB' : '#4B5563',
            flex: 1,
        },
        unloadChip: {
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
            backgroundColor: '#3B82F6',
        },
        unloadChipText: {
            fontSize: 11,
            fontWeight: '700',
            color: '#FFFFFF',
        },
        sectionTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
        },
        sectionTitle: {
            fontSize: 16,
            fontWeight: '800',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        installedRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
        },
        installedRowActive: {
            borderColor: '#3B82F6',
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.14)' : '#EFF6FF',
        },
        installedName: {
            fontSize: 14,
            fontWeight: '700',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        installedMeta: {
            fontSize: 12,
            color: isDark ? '#9CA3AF' : '#6B7280',
            marginTop: 2,
        },
        installedActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        activePill: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: '#10B981',
        },
        activePillText: {
            fontSize: 11,
            fontWeight: '700',
            color: '#FFFFFF',
        },
        usePill: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: '#3B82F6',
        },
        usePillText: {
            fontSize: 11,
            fontWeight: '700',
            color: '#FFFFFF',
        },
        stepperRow: {
            flexDirection: 'row',
            gap: 6,
            marginTop: 14,
            marginBottom: 14,
        },
        stepPill: {
            flex: 1,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: isDark ? '#111827' : '#F3F4F6',
            alignItems: 'center',
        },
        stepPillActive: {
            backgroundColor: '#3B82F6',
        },
        stepPillText: {
            fontSize: 12,
            fontWeight: '700',
            color: isDark ? '#9CA3AF' : '#6B7280',
        },
        stepPillTextActive: {
            color: '#FFFFFF',
        },
        stepBody: {
            gap: 12,
            paddingTop: 4,
        },
        stepTitle: {
            fontSize: 15,
            fontWeight: '800',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        checkItem: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
        },
        checkLabel: {
            fontSize: 14,
            fontWeight: '700',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        checkSub: {
            fontSize: 12,
            lineHeight: 17,
            color: isDark ? '#9CA3AF' : '#6B7280',
            marginTop: 2,
        },
        primaryStepBtn: {
            marginTop: 6,
            paddingVertical: 13,
            borderRadius: 12,
            backgroundColor: '#2563EB',
            alignItems: 'center',
        },
        primaryStepBtnText: {
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: '700',
        },
        fieldCaption: {
            fontSize: 12,
            fontWeight: '700',
            color: isDark ? '#9CA3AF' : '#4B5563',
            marginTop: 4,
        },
        localeWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        localeChip: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#D1D5DB',
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
        },
        localeChipActive: {
            backgroundColor: '#3B82F6',
            borderColor: '#3B82F6',
        },
        localeChipText: {
            fontSize: 13,
            fontWeight: '600',
            color: isDark ? '#D1D5DB' : '#374151',
        },
        localeChipTextActive: {
            color: '#FFFFFF',
        },
        testMicBox: {
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            gap: 10,
        },
        micTestBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 12,
            borderRadius: 10,
            backgroundColor: '#3B82F6',
        },
        micTestBtnText: {
            color: '#FFFFFF',
            fontWeight: '700',
            fontSize: 14,
        },
        secondaryActionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 11,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#3B82F6',
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
        },
        secondaryActionText: {
            color: isDark ? '#93C5FD' : '#1D4ED8',
            fontSize: 13,
            fontWeight: '700',
        },
        micTranscriptPreview: {
            fontSize: 13,
            fontWeight: '600',
            color: '#10B981',
        },
        micNoteText: {
            fontSize: 12,
            color: isDark ? '#FCD34D' : '#B45309',
        },
        downloadProgressBox: {
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? '#111827' : '#EFF6FF',
            borderWidth: 1,
            borderColor: '#3B82F6',
            gap: 8,
        },
        downloadHeaderRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        downloadTitle: {
            fontSize: 13,
            fontWeight: '700',
            color: isDark ? '#F9FAFB' : '#1E3A8A',
        },
        downloadBytes: {
            fontSize: 12,
            fontWeight: '600',
            color: isDark ? '#93C5FD' : '#2563EB',
        },
        progressTrack: {
            height: 8,
            borderRadius: 4,
            backgroundColor: isDark ? '#374151' : '#DBEAFE',
            overflow: 'hidden',
        },
        progressFill: {
            height: '100%',
            backgroundColor: '#2563EB',
        },
        downloadSubtext: {
            fontSize: 12,
            color: isDark ? '#D1D5DB' : '#374151',
        },
        downloadBtnsRow: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 8,
        },
        smallCtrlBtn: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#3B82F6',
        },
        smallCtrlBtnText: {
            fontSize: 12,
            fontWeight: '700',
            color: '#3B82F6',
        },
        runtimeTabsRow: {
            flexDirection: 'row',
            backgroundColor: isDark ? '#111827' : '#E5E7EB',
            borderRadius: 10,
            padding: 3,
        },
        runtimeTab: {
            flex: 1,
            paddingVertical: 9,
            alignItems: 'center',
            borderRadius: 8,
        },
        runtimeTabActive: {
            backgroundColor: isDark ? '#374151' : '#FFFFFF',
        },
        runtimeTabText: {
            fontSize: 12,
            fontWeight: '600',
            color: isDark ? '#9CA3AF' : '#6B7280',
        },
        runtimeTabTextActive: {
            color: isDark ? '#F9FAFB' : '#111827',
            fontWeight: '700',
        },
        guideBox: {
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            gap: 8,
        },
        guideHeading: {
            fontSize: 14,
            fontWeight: '700',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        guideStep: {
            fontSize: 13,
            lineHeight: 18,
            color: isDark ? '#D1D5DB' : '#374151',
        },
        linkText: {
            color: '#3B82F6',
            fontWeight: '700',
            textDecorationLine: 'underline',
        },
        codeCopyRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0F172A',
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 10,
            gap: 8,
        },
        codeText: {
            color: '#E2E8F0',
            fontSize: 12,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            flex: 1,
        },
        copyBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: '#2563EB',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
        },
        copyBtnText: {
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: '700',
        },
        endpointRow: {
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
        },
        endpointInput: {
            flex: 1,
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#D1D5DB',
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            color: isDark ? '#F9FAFB' : '#111827',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 10,
            fontSize: 13,
        },
        probeBtn: {
            backgroundColor: '#2563EB',
            paddingHorizontal: 12,
            paddingVertical: 11,
            borderRadius: 10,
        },
        probeBtnText: {
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '700',
        },
        catalogCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
        },
        catalogTitle: {
            fontSize: 14,
            fontWeight: '700',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        catalogDesc: {
            fontSize: 12,
            lineHeight: 17,
            color: isDark ? '#9CA3AF' : '#4B5563',
            marginTop: 2,
        },
        catalogMeta: {
            fontSize: 11,
            fontWeight: '600',
            color: isDark ? '#60A5FA' : '#2563EB',
            marginTop: 4,
        },
        downloadBtn: {
            backgroundColor: '#2563EB',
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 10,
        },
        downloadBtnText: {
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '700',
        },
        testResultCard: {
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
            borderWidth: 1,
            borderColor: '#10B981',
            gap: 4,
        },
        testResultTitle: {
            fontSize: 13,
            fontWeight: '800',
            color: '#10B981',
        },
        testResultLine: {
            fontSize: 12,
            color: isDark ? '#E5E7EB' : '#065F46',
        },
        errorInlineText: {
            fontSize: 12,
            fontWeight: '600',
            color: '#EF4444',
        },
        mobilePwaBanner: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.14)' : '#EFF6FF',
            borderWidth: 1,
            borderColor: isDark ? '#3B82F6' : '#BFDBFE',
        },
        mobilePwaTitle: {
            fontSize: 13,
            fontWeight: '800',
            color: isDark ? '#93C5FD' : '#1E3A8A',
        },
        mobilePwaSub: {
            fontSize: 12,
            lineHeight: 17,
            color: isDark ? '#D1D5DB' : '#1E40AF',
            marginTop: 2,
        },
        mobileWarnBox: {
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FFFBEB',
            borderWidth: 1,
            borderColor: isDark ? '#F59E0B' : '#FDE68A',
        },
        mobileWarnText: {
            fontSize: 12,
            lineHeight: 17,
            fontWeight: '600',
            color: isDark ? '#FCD34D' : '#92400E',
        },
        confirmOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        confirmCard: {
            width: '100%',
            maxWidth: 380,
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderRadius: 18,
            padding: 20,
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
        },
        confirmTitle: {
            fontSize: 17,
            fontWeight: '800',
            color: isDark ? '#F9FAFB' : '#111827',
            marginBottom: 8,
        },
        confirmMessage: {
            fontSize: 14,
            lineHeight: 20,
            color: isDark ? '#D1D5DB' : '#4B5563',
            marginBottom: 18,
        },
        confirmActionsRow: {
            flexDirection: 'row',
            gap: 10,
        },
        confirmCancelBtn: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: isDark ? '#374151' : '#F3F4F6',
            alignItems: 'center',
        },
        confirmCancelText: {
            fontSize: 14,
            fontWeight: '700',
            color: isDark ? '#E5E7EB' : '#4B5563',
        },
        confirmOkBtn: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: '#2563EB',
            alignItems: 'center',
        },
        confirmOkText: {
            fontSize: 14,
            fontWeight: '700',
            color: '#FFFFFF',
        },
    });
