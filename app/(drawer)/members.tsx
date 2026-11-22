import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import InviteModal from '@/src/components/InviteModal';
import MemberControlModal, { HouseholdMemberItem } from '@/src/components/MemberControlModal';

export default function MembershipsScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const styles = createStyles(isDark);

    const { user, householdId, householdName, householdRole, householdMembers } = useSelector(
        (state: any) => state.auth
    );

    const isLeaderOrCoLeader = householdRole === 'leader' || householdRole === 'co-leader';
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [selectedMember, setSelectedMember] = useState<HouseholdMemberItem | null>(null);

    const getRoleBadge = (role: string) => {
        if (role === 'leader') return { label: 'Leader', bg: '#DBEAFE', text: '#1D4ED8' };
        if (role === 'co-leader') return { label: 'Co-Leader', bg: '#E0E7FF', text: '#4338CA' };
        return { label: 'Member', bg: '#F3F4F6', text: '#4B5563' };
    };

    const renderMember = ({ item }: { item: HouseholdMemberItem }) => {
        const isMe = item.uid === user?.uid;
        const canManage = isLeaderOrCoLeader && !isMe && item.role !== 'leader';
        const roleBadge = getRoleBadge(item.role);
        const isReadOnly = item.role === 'member' && item.access === 'read-only';

        return (
            <View style={styles.memberCard}>
                <View style={styles.memberLeft}>
                    <View style={[styles.avatar, item.role === 'leader' && styles.leaderAvatar]}>
                        <Text style={styles.avatarText}>
                            {item.displayName ? item.displayName[0].toUpperCase() : 'M'}
                        </Text>
                    </View>
                    <View style={styles.memberInfo}>
                        <Text style={styles.memberName} numberOfLines={1}>
                            {item.displayName} {isMe ? '(You)' : ''}
                        </Text>
                        <View style={styles.badgesRow}>
                            <View style={[styles.badge, { backgroundColor: roleBadge.bg }]}>
                                <Text style={[styles.badgeText, { color: roleBadge.text }]}>
                                    {roleBadge.label}
                                </Text>
                            </View>
                            {item.role === 'member' && (
                                <View
                                    style={[
                                        styles.badge,
                                        { backgroundColor: isReadOnly ? '#FEF3C7' : '#D1FAE5' },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.badgeText,
                                            { color: isReadOnly ? '#B45309' : '#047857' },
                                        ]}
                                    >
                                        {isReadOnly ? 'Read-Only' : 'Full Access'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {canManage ? (
                    <TouchableOpacity
                        style={styles.manageBtn}
                        onPress={() => setSelectedMember(item)}
                    >
                        <Text style={styles.manageBtnText}>Manage</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.title}>{householdName || 'Household'} Members</Text>
                    <Text style={styles.subtitle}>
                        {householdMembers?.length || 0}{' '}
                        {(householdMembers?.length || 0) === 1 ? 'member' : 'members'} in this household
                    </Text>
                </View>

                {isLeaderOrCoLeader ? (
                    <TouchableOpacity
                        style={styles.inviteBtn}
                        onPress={() => setShowInviteModal(true)}
                    >
                        <IconSymbol name="person.badge.plus" size={18} color="#FFFFFF" />
                        <Text style={styles.inviteBtnText}>Invite</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <FlatList
                data={householdMembers}
                keyExtractor={(item) => item.uid}
                renderItem={renderMember}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No members found in this household.</Text>
                }
            />

            {isLeaderOrCoLeader && householdId && user?.uid ? (
                <InviteModal
                    visible={showInviteModal}
                    onClose={() => setShowInviteModal(false)}
                    householdId={householdId}
                    householdName={householdName || 'My Household'}
                    userId={user.uid}
                    userName={user.displayName || 'Household Leader'}
                />
            ) : null}

            {householdId ? (
                <MemberControlModal
                    visible={!!selectedMember}
                    member={selectedMember}
                    householdId={householdId}
                    onClose={() => setSelectedMember(null)}
                />
            ) : null}
        </View>
    );
}

const createStyles = (isDark: boolean) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: isDark ? '#111827' : '#F7F9FC',
        },
        headerRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#374151' : '#E5E7EB',
        },
        title: {
            fontSize: 20,
            fontWeight: '800',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        subtitle: {
            fontSize: 13,
            color: isDark ? '#9CA3AF' : '#6B7280',
            marginTop: 2,
        },
        inviteBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#3B82F6',
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 10,
            gap: 6,
        },
        inviteBtnText: {
            color: '#FFFFFF',
            fontWeight: '700',
            fontSize: 14,
        },
        listContent: {
            padding: 20,
            paddingBottom: 40,
        },
        memberCard: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.05,
            shadowRadius: 8,
            elevation: 2,
        },
        memberLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
            marginRight: 10,
        },
        avatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#6366F1',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        leaderAvatar: {
            backgroundColor: '#2563EB',
        },
        avatarText: {
            color: '#FFFFFF',
            fontSize: 18,
            fontWeight: '700',
        },
        memberInfo: {
            flex: 1,
        },
        memberName: {
            fontSize: 16,
            fontWeight: '700',
            color: isDark ? '#F9FAFB' : '#111827',
            marginBottom: 6,
        },
        badgesRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
        },
        badge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
        },
        badgeText: {
            fontSize: 11,
            fontWeight: '700',
        },
        manageBtn: {
            backgroundColor: isDark ? '#374151' : '#EFF6FF',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
        },
        manageBtnText: {
            color: isDark ? '#93C5FD' : '#2563EB',
            fontWeight: '700',
            fontSize: 13,
        },
        emptyText: {
            textAlign: 'center',
            color: isDark ? '#9CA3AF' : '#6B7280',
            marginTop: 40,
            fontSize: 15,
        },
    });
