import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SpeechService } from '@/src/services/voiceAi/speechService';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface VoiceCaptureSheetProps {
    visible: boolean;
    mode: 'create' | 'refine';
    locale: string;
    activeModelLabel: string;
    isParsing: boolean;
    parseError: string | null;
    onSubmitTranscript: (transcript: string) => void;
    onClose: () => void;
}

const CREATE_EXAMPLES = [
    '"Spent 450 rupees on groceries from Bank Account yesterday"',
    '"Transferred 5000 from Bank Account to Savings"',
    '"Received 65000 salary in Bank Account"',
];

const REFINE_EXAMPLES = [
    '"Change amount to 520 and account to Cash"',
    '"Set category to Food & Dining and add note lunch with team"',
];

export default function VoiceCaptureSheet(props: VoiceCaptureSheetProps) {
    if (!props.visible) return null;
    return <VoiceCaptureSheetInner {...props} />;
}

function VoiceCaptureSheetInner({
    mode,
    locale,
    activeModelLabel,
    isParsing,
    parseError,
    onSubmitTranscript,
    onClose,
}: VoiceCaptureSheetProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const styles = createStyles(isDark);

    const [transcript, setTranscript] = useState('');
    const [isListening, setIsListening] = useState(true);
    const [speechError, setSpeechError] = useState<string | null>(null);
    const [pulseAnim] = useState(() => new Animated.Value(1));

    const latestTranscriptRef = useRef('');
    const userEditedManuallyRef = useRef(false);
    const autoSubmittedRef = useRef(false);
    const onSubmitRef = useRef(onSubmitTranscript);

    useEffect(() => {
        onSubmitRef.current = onSubmitTranscript;
    }, [onSubmitTranscript]);

    useEffect(() => {
        if (!isListening) {
            pulseAnim.setValue(1);
            return;
        }
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.18,
                    duration: 650,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 650,
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [isListening, pulseAnim]);

    const beginListeningSession = useCallback(async () => {
        autoSubmittedRef.current = false;
        userEditedManuallyRef.current = false;

        await SpeechService.startListening({
            locale,
            onTranscript: (text, isFinal) => {
                latestTranscriptRef.current = text;
                setTranscript(text);
                if (isFinal && Platform.OS !== 'web' && text.trim() && !autoSubmittedRef.current) {
                    autoSubmittedRef.current = true;
                    setIsListening(false);
                    onSubmitRef.current(text.trim());
                }
            },
            onError: (msg) => {
                setSpeechError(msg);
                setIsListening(false);
            },
            onEnd: () => {
                setIsListening(false);
                if (
                    Platform.OS !== 'web' &&
                    latestTranscriptRef.current.trim() &&
                    !userEditedManuallyRef.current &&
                    !autoSubmittedRef.current
                ) {
                    autoSubmittedRef.current = true;
                    onSubmitRef.current(latestTranscriptRef.current.trim());
                }
            },
        });
    }, [locale]);

    useEffect(() => {
        beginListeningSession();
        return () => {
            SpeechService.abortListening();
        };
    }, [beginListeningSession]);

    const handleToggleMic = async () => {
        if (isParsing) return;
        if (isListening) {
            autoSubmittedRef.current = true;
            await SpeechService.stopListening();
            setIsListening(false);
        } else {
            setSpeechError(null);
            setTranscript('');
            latestTranscriptRef.current = '';
            setIsListening(true);
            await beginListeningSession();
        }
    };

    const handleParsePress = async () => {
        const clean = transcript.trim();
        if (!clean || isParsing) return;
        autoSubmittedRef.current = true;
        if (isListening) {
            await SpeechService.stopListening();
            setIsListening(false);
        }
        onSubmitTranscript(clean);
    };

    const handleDismiss = () => {
        SpeechService.abortListening();
        setIsListening(false);
        onClose();
    };

    const examples = mode === 'refine' ? REFINE_EXAMPLES : CREATE_EXAMPLES;
    const combinedError = parseError || speechError;

    return (
        <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={handleDismiss}
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <Pressable style={styles.backdrop} onPress={isParsing ? undefined : handleDismiss} />
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                    <View style={styles.handleBar} />

                    <View style={styles.headerRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>
                                {mode === 'refine' ? 'Speak to Edit Draft' : 'Add Transaction by Voice'}
                            </Text>
                            <View style={styles.metaRow}>
                                <IconSymbol name="cpu" size={13} color="#3B82F6" />
                                <Text style={styles.metaText} numberOfLines={1}>
                                    Local AI: {activeModelLabel} • {locale}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={handleDismiss}
                            disabled={isParsing}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <IconSymbol name="xmark.circle.fill" size={26} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    {/* Pulsing Mic Control */}
                    <View style={styles.micStage}>
                        {isParsing ? (
                            <View style={styles.parsingCircle}>
                                <ActivityIndicator size="large" color="#3B82F6" />
                            </View>
                        ) : (
                            <Animated.View
                                style={[
                                    styles.micPulseRing,
                                    isListening && styles.micPulseRingActive,
                                    { transform: [{ scale: pulseAnim }] },
                                ]}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.micButton,
                                        isListening ? styles.micButtonActive : styles.micButtonIdle,
                                    ]}
                                    onPress={handleToggleMic}
                                    activeOpacity={0.8}
                                >
                                    <IconSymbol
                                        name={isListening ? 'stop.fill' : 'mic.fill'}
                                        size={30}
                                        color="#FFFFFF"
                                    />
                                </TouchableOpacity>
                            </Animated.View>
                        )}
                        <Text style={styles.stageStatusText}>
                            {isParsing
                                ? 'Parsing locally on your device...'
                                : isListening
                                  ? 'Listening... speak naturally (tap to pause)'
                                  : 'Microphone paused — tap mic to re-speak or edit text below'}
                        </Text>
                    </View>

                    {/* Live / Editable Transcript Box */}
                    <View style={styles.transcriptBoxWrap}>
                        <Text style={styles.transcriptLabel}>Recognized Text (Editable)</Text>
                        <TextInput
                            style={styles.transcriptInput}
                            value={transcript}
                            onChangeText={(val) => {
                                userEditedManuallyRef.current = true;
                                latestTranscriptRef.current = val;
                                setTranscript(val);
                            }}
                            placeholder={
                                mode === 'refine'
                                    ? 'Say what to change, e.g., "Make amount 600 from Cash"...'
                                    : 'Say e.g., "Spent 450 on groceries from Bank Account"...'
                            }
                            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                            multiline
                            editable={!isParsing}
                        />
                    </View>

                    {combinedError ? (
                        <View style={styles.errorBanner}>
                            <IconSymbol
                                name="exclamationmark.triangle.fill"
                                size={16}
                                color={isDark ? '#FCA5A5' : '#DC2626'}
                            />
                            <Text style={styles.errorText}>{combinedError}</Text>
                        </View>
                    ) : null}

                    {/* Quick Hint Examples */}
                    <View style={styles.examplesBox}>
                        <Text style={styles.examplesTitle}>Try saying:</Text>
                        {examples.map((ex, idx) => (
                            <Text key={idx} style={styles.exampleItem}>
                                • {ex}
                            </Text>
                        ))}
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={handleDismiss}
                            disabled={isParsing}
                        >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.parseBtn,
                                (!transcript.trim() || isParsing) && styles.parseBtnDisabled,
                            ]}
                            onPress={handleParsePress}
                            disabled={!transcript.trim() || isParsing}
                        >
                            <IconSymbol name="sparkles" size={18} color="#FFFFFF" />
                            <Text style={styles.parseBtnText}>
                                {isParsing
                                    ? 'Parsing...'
                                    : isListening
                                      ? 'Stop & Parse'
                                      : 'Parse with Local AI'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const createStyles = (isDark: boolean) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0, 0, 0, 0.58)',
        },
        backdrop: {
            flex: 1,
        },
        sheet: {
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 10,
            maxWidth: 640,
            width: '100%',
            alignSelf: 'center',
        },
        handleBar: {
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: isDark ? '#4B5563' : '#D1D5DB',
            alignSelf: 'center',
            marginBottom: 12,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 12,
        },
        title: {
            fontSize: 20,
            fontWeight: '800',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        metaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            marginTop: 4,
        },
        metaText: {
            fontSize: 12,
            fontWeight: '600',
            color: isDark ? '#93C5FD' : '#2563EB',
            flexShrink: 1,
        },
        micStage: {
            alignItems: 'center',
            paddingVertical: 14,
        },
        micPulseRing: {
            width: 84,
            height: 84,
            borderRadius: 42,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.14)' : '#EFF6FF',
        },
        micPulseRingActive: {
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
        },
        micButton: {
            width: 66,
            height: 66,
            borderRadius: 33,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 6,
        },
        micButtonActive: {
            backgroundColor: '#EF4444',
        },
        micButtonIdle: {
            backgroundColor: '#3B82F6',
        },
        parsingCircle: {
            width: 72,
            height: 72,
            borderRadius: 36,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? '#111827' : '#EFF6FF',
        },
        stageStatusText: {
            marginTop: 10,
            fontSize: 13,
            fontWeight: '600',
            color: isDark ? '#D1D5DB' : '#4B5563',
            textAlign: 'center',
        },
        transcriptBoxWrap: {
            marginTop: 6,
        },
        transcriptLabel: {
            fontSize: 12,
            fontWeight: '700',
            color: isDark ? '#9CA3AF' : '#6B7280',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
        },
        transcriptInput: {
            minHeight: 74,
            maxHeight: 130,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#D1D5DB',
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            color: isDark ? '#F9FAFB' : '#111827',
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
            textAlignVertical: 'top',
        },
        errorBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 10,
            padding: 10,
            borderRadius: 10,
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
            borderWidth: 1,
            borderColor: isDark ? '#EF4444' : '#FECACA',
        },
        errorText: {
            flex: 1,
            fontSize: 12,
            fontWeight: '600',
            color: isDark ? '#FCA5A5' : '#B91C1C',
        },
        examplesBox: {
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            backgroundColor: isDark ? '#111827' : '#F3F4F6',
            gap: 3,
        },
        examplesTitle: {
            fontSize: 11,
            fontWeight: '700',
            color: isDark ? '#9CA3AF' : '#6B7280',
            textTransform: 'uppercase',
            marginBottom: 2,
        },
        exampleItem: {
            fontSize: 12,
            color: isDark ? '#D1D5DB' : '#4B5563',
        },
        actionsRow: {
            flexDirection: 'row',
            gap: 12,
            marginTop: 16,
        },
        cancelBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: isDark ? '#374151' : '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
        },
        cancelBtnText: {
            fontSize: 15,
            fontWeight: '700',
            color: isDark ? '#E5E7EB' : '#4B5563',
        },
        parseBtn: {
            flex: 2,
            flexDirection: 'row',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: '#2563EB',
            alignItems: 'center',
            justifyContent: 'center',
        },
        parseBtnDisabled: {
            opacity: 0.5,
        },
        parseBtnText: {
            fontSize: 15,
            fontWeight: '700',
            color: '#FFFFFF',
        },
    });
