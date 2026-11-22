import React, { useEffect, useState, useCallback } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Share,
    Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { InvitationService } from '@/src/services/InvitationService';

interface InviteModalProps {
    visible: boolean;
    onClose: () => void;
    householdId: string;
    householdName: string;
    userId: string;
    userName: string;
}

export default function InviteModal({
    visible,
    onClose,
    householdId,
    householdName,
    userId,
    userName,
}: InviteModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formattedCode, setFormattedCode] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<number | null>(null);
    const [shareMessage, setShareMessage] = useState<string>('');
    const [copiedTarget, setCopiedTarget] = useState<'code' | 'message' | null>(null);

    const requestNewCode = useCallback(async () => {
        if (!householdId || !userId) return;
        setLoading(true);
        setError(null);
        setCopiedTarget(null);

        const res = await InvitationService.createInvitation({
            householdId,
            householdName,
            userId,
            userName,
        });

        setLoading(false);
        if (res.error) {
            setError(res.error);
        } else {
            setFormattedCode(res.formattedCode || null);
            setExpiresAt(res.expiresAt || null);
            setShareMessage(res.shareMessage || '');
        }
    }, [householdId, householdName, userId, userName]);

    useEffect(() => {
        if (!visible || !householdId || !userId) return;

        let isMounted = true;
        InvitationService.createInvitation({
            householdId,
            householdName,
            userId,
            userName,
        }).then((res) => {
            if (!isMounted) return;
            setLoading(false);
            if (res.error) {
                setError(res.error);
                setFormattedCode(null);
            } else {
                setError(null);
                setFormattedCode(res.formattedCode || null);
                setExpiresAt(res.expiresAt || null);
                setShareMessage(res.shareMessage || '');
            }
        });

        return () => {
            isMounted = false;
        };
    }, [visible, householdId, householdName, userId, userName]);

    const handleClose = () => {
        setCopiedTarget(null);
        setFormattedCode(null);
        setError(null);
        onClose();
    };

    const isLoadingCode = loading || (visible && !formattedCode && !error);

    const handleCopy = async (text: string, target: 'code' | 'message') => {
        if (!text) return;
        await Clipboard.setStringAsync(text);
        setCopiedTarget(target);
        setTimeout(() => setCopiedTarget((prev) => (prev === target ? null : prev)), 2500);
    };

    const handleShare = async () => {
        if (!shareMessage) return;
        if (Platform.OS === 'web') {
            await handleCopy(shareMessage, 'message');
            return;
        }
        try {
            await Share.share({
                message: shareMessage,
                title: `Join ${householdName || 'Household'} on Unity Ledger`,
            });
        } catch {
            await handleCopy(shareMessage, 'message');
        }
    };

    const formattedExpiry = expiresAt
        ? new Date(expiresAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : '';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.headerRow}>
                        <View style={styles.headerTitleWrap}>
                            <IconSymbol name="person.badge.plus" size={22} color="#3B82F6" />
                            <Text style={styles.title}>Invite to Household</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <IconSymbol name="xmark.circle.fill" size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>
                        Share this unique code to invite one person to{' '}
                        <Text style={styles.bold}>{householdName || 'your household'}</Text>.
                    </Text>

                    {isLoadingCode ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text style={styles.loadingText}>Generating unique invite code...</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity style={styles.retryBtn} onPress={requestNewCode}>
                                <Text style={styles.retryBtnText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : formattedCode ? (
                        <>
                            <View style={styles.codeBox}>
                                <Text style={styles.codeLabel}>INVITATION CODE</Text>
                                <Text style={styles.codeText} selectable>
                                    {formattedCode}
                                </Text>
                                <View style={styles.badgeRow}>
                                    <Text style={styles.badgeText}>Single-use</Text>
                                    <Text style={styles.badgeDot}>•</Text>
                                    <Text style={styles.badgeText}>Expires {formattedExpiry}</Text>
                                </View>
                            </View>

                            <View style={styles.previewBox}>
                                <Text style={styles.previewLabel}>Shareable Message</Text>
                                <Text style={styles.previewText} selectable>
                                    {shareMessage}
                                </Text>
                            </View>

                            <View style={styles.actionsRow}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.secondaryBtn]}
                                    onPress={() => handleCopy(formattedCode, 'code')}
                                >
                                    <IconSymbol
                                        name={copiedTarget === 'code' ? 'checkmark' : 'doc.on.doc'}
                                        size={18}
                                        color="#1D4ED8"
                                    />
                                    <Text style={styles.secondaryBtnText}>
                                        {copiedTarget === 'code' ? 'Code Copied!' : 'Copy Code'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.primaryBtn]}
                                    onPress={handleShare}
                                >
                                    <IconSymbol
                                        name={copiedTarget === 'message' ? 'checkmark' : 'square.and.arrow.up'}
                                        size={18}
                                        color="#FFFFFF"
                                    />
                                    <Text style={styles.primaryBtnText}>
                                        {copiedTarget === 'message'
                                            ? 'Message Copied!'
                                            : Platform.OS === 'web'
                                              ? 'Copy Message'
                                              : 'Share Invite'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.newCodeLink} onPress={requestNewCode}>
                                <Text style={styles.newCodeLinkText}>Generate Another Code</Text>
                            </TouchableOpacity>
                        </>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 12,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    headerTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 19,
        fontWeight: '800',
        color: '#111827',
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 16,
    },
    bold: {
        fontWeight: '700',
        color: '#111827',
    },
    loadingBox: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: '#6B7280',
    },
    errorBox: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        gap: 12,
    },
    errorText: {
        color: '#B91C1C',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    retryBtn: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 8,
    },
    retryBtnText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
    codeBox: {
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 14,
        alignItems: 'center',
        marginBottom: 14,
    },
    codeLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#3B82F6',
        letterSpacing: 1.2,
        marginBottom: 6,
    },
    codeText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1E3A8A',
        letterSpacing: 3,
        fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
    },
    badgeText: {
        fontSize: 12,
        color: '#4B5563',
        fontWeight: '600',
    },
    badgeDot: {
        color: '#9CA3AF',
    },
    previewBox: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    previewLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6B7280',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    previewText: {
        fontSize: 13,
        color: '#374151',
        lineHeight: 19,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 6,
    },
    primaryBtn: {
        backgroundColor: '#3B82F6',
    },
    secondaryBtn: {
        backgroundColor: '#DBEAFE',
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
    secondaryBtnText: {
        color: '#1D4ED8',
        fontWeight: '700',
        fontSize: 14,
    },
    newCodeLink: {
        marginTop: 14,
        alignItems: 'center',
    },
    newCodeLinkText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        textDecorationLine: 'underline',
    },
});
