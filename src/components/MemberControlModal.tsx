import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Alert,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { HouseholdService } from '@/src/services/HouseholdService';

export interface HouseholdMemberItem {
    uid: string;
    displayName: string;
    role: 'leader' | 'co-leader' | 'member';
    access: 'read-write' | 'read-only';
}

interface MemberControlModalProps {
    visible: boolean;
    member: HouseholdMemberItem | null;
    householdId: string;
    onClose: () => void;
}

export default function MemberControlModal({
    visible,
    member,
    householdId,
    onClose,
}: MemberControlModalProps) {
    const [selectedRole, setSelectedRole] = useState<'member' | 'co-leader' | null>(null);
    const [selectedAccess, setSelectedAccess] = useState<'read-write' | 'read-only' | null>(null);
    const [saving, setSaving] = useState(false);

    if (!member) return null;

    const currentRole: 'member' | 'co-leader' =
        selectedRole ?? (member.role === 'co-leader' ? 'co-leader' : 'member');
    const currentAccess: 'read-write' | 'read-only' =
        currentRole === 'co-leader'
            ? 'read-write'
            : (selectedAccess ?? (member.access === 'read-only' ? 'read-only' : 'read-write'));

    const handleClose = () => {
        setSelectedRole(null);
        setSelectedAccess(null);
        onClose();
    };

    const handleSave = async () => {
        setSaving(true);
        const res = await HouseholdService.updateMemberPermissions(householdId, member.uid, {
            role: currentRole,
            access: currentAccess,
        });
        setSaving(false);

        if (res.error) {
            Alert.alert('Update Failed', res.error);
        } else {
            handleClose();
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.headerRow}>
                        <View style={styles.titleWrap}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>
                                    {member.displayName ? member.displayName[0].toUpperCase() : 'M'}
                                </Text>
                            </View>
                            <View style={{ flexShrink: 1 }}>
                                <Text style={styles.title} numberOfLines={1}>
                                    {member.displayName}
                                </Text>
                                <Text style={styles.subtitle}>Manage role & access</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={handleClose} disabled={saving}>
                            <IconSymbol name="xmark.circle.fill" size={24} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionLabel}>Household Role</Text>
                    <View style={styles.optionRow}>
                        <TouchableOpacity
                            style={[styles.optionCard, currentRole === 'member' && styles.optionCardActive]}
                            onPress={() => setSelectedRole('member')}
                            disabled={saving}
                        >
                            <Text style={[styles.optionTitle, currentRole === 'member' && styles.optionTitleActive]}>
                                Member
                            </Text>
                            <Text style={styles.optionDesc}>Standard household member</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.optionCard, currentRole === 'co-leader' && styles.optionCardActive]}
                            onPress={() => {
                                setSelectedRole('co-leader');
                                setSelectedAccess('read-write');
                            }}
                            disabled={saving}
                        >
                            <Text style={[styles.optionTitle, currentRole === 'co-leader' && styles.optionTitleActive]}>
                                Co-Leader
                            </Text>
                            <Text style={styles.optionDesc}>Full leader privileges & invites</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionLabel}>Data Permissions</Text>
                    {currentRole === 'co-leader' ? (
                        <View style={styles.infoBanner}>
                            <Text style={styles.infoBannerText}>
                                Co-Leaders automatically have full Add, Update, and Delete permissions plus member management.
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.optionRow}>
                            <TouchableOpacity
                                style={[
                                    styles.optionCard,
                                    currentAccess === 'read-write' && styles.optionCardActive,
                                ]}
                                onPress={() => setSelectedAccess('read-write')}
                                disabled={saving}
                            >
                                <Text
                                    style={[
                                        styles.optionTitle,
                                        currentAccess === 'read-write' && styles.optionTitleActive,
                                    ]}
                                >
                                    Full Access
                                </Text>
                                <Text style={styles.optionDesc}>Can add, edit & delete</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.optionCard,
                                    currentAccess === 'read-only' && styles.optionCardWarnActive,
                                ]}
                                onPress={() => setSelectedAccess('read-only')}
                                disabled={saving}
                            >
                                <Text
                                    style={[
                                        styles.optionTitle,
                                        currentAccess === 'read-only' && styles.optionTitleWarnActive,
                                    ]}
                                >
                                    Read-Only
                                </Text>
                                <Text style={styles.optionDesc}>View only, cannot modify</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={handleClose}
                            disabled={saving}
                        >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save Changes</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
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
        marginBottom: 16,
    },
    titleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
    },
    subtitle: {
        fontSize: 13,
        color: '#6B7280',
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginTop: 12,
        marginBottom: 8,
    },
    optionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    optionCard: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
    },
    optionCardActive: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    optionCardWarnActive: {
        borderColor: '#F59E0B',
        backgroundColor: '#FFFBEB',
    },
    optionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    optionTitleActive: {
        color: '#1D4ED8',
    },
    optionTitleWarnActive: {
        color: '#B45309',
    },
    optionDesc: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 16,
    },
    infoBanner: {
        backgroundColor: '#EFF6FF',
        borderRadius: 10,
        padding: 12,
    },
    infoBannerText: {
        fontSize: 13,
        color: '#1E40AF',
        lineHeight: 18,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 22,
    },
    cancelBtn: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#4B5563',
    },
    saveBtn: {
        flex: 1,
        backgroundColor: '#3B82F6',
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
