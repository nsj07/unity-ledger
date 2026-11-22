import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import InviteModal from '@/src/components/InviteModal';
import MemberControlModal, { HouseholdMemberItem } from '@/src/components/MemberControlModal';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import { styles } from './index.styles';

// Premium Dashboard Entry
export default function DashboardScreen() {
  const { user, householdId, householdName, householdRole, householdAccess, householdMembers } =
    useSelector((state: any) => state.auth);
  const { accounts } = useSelector((state: any) => state.accounts);
  const { transactions } = useSelector((state: any) => state.transactions);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<HouseholdMemberItem | null>(null);

  const isLeaderOrCoLeader = householdRole === 'leader' || householdRole === 'co-leader';
  const isReadOnly = !isLeaderOrCoLeader && householdAccess === 'read-only';

  // Calculate Net balance
  const totalBalance = useMemo(() => {
    if (!accounts || accounts.length === 0) return 0;
    return accounts.reduce((acc: number, curr: any) => acc + (curr.balance || 0), 0);
  }, [accounts]);

  const renderTransactionItem = (item: any) => {
    const isExpense = item.type === 'Expense';
    const isTransfer = item.type === 'Transfer';
    const isInvest = item.type === 'Investment';

    let color = '#34C759'; // Income default
    let icon: IconSymbolName = 'arrow.down.left.circle.fill';

    if (isExpense) {
      color = '#FF3B30';
      icon = 'arrow.up.right.circle.fill';
    } else if (isTransfer) {
      color = '#FF9500';
      icon = 'arrow.left.arrow.right.circle.fill';
    } else if (isInvest) {
      color = '#007AFF';
      icon = 'chart.line.uptrend.xyaxis.circle.fill';
    }

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.txnCard}
        disabled={isReadOnly}
        activeOpacity={isReadOnly ? 1 : 0.75}
        onPress={() =>
          router.push({ pathname: '/new-transaction', params: { transactionId: item.id } })
        }
      >
        <View style={styles.txnLeft}>
          <IconSymbol name={icon} size={36} color={color} />
          <View style={styles.txnTextContainer}>
            <Text style={styles.txnCategory}>{item.subcategory_name || item.type}</Text>
            <Text style={styles.txnDate} numberOfLines={1}>
              {new Date(item.transaction_date || item.created_at).toLocaleDateString()}
              {item.note ? ` • ${item.note}` : ''}
            </Text>
          </View>
        </View>
        <Text style={[styles.txnAmount, { color }]}>
          {isExpense ? '-' : (isTransfer ? '' : '+')}₹{item.amount.toLocaleString()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Compact Greeting Row */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hello, {user?.displayName || 'User'}</Text>
          {isReadOnly ? (
            <View style={styles.readOnlyBadge}>
              <IconSymbol name="lock.fill" size={12} color="#B45309" />
              <Text style={styles.readOnlyBadgeText}>Read-Only</Text>
            </View>
          ) : null}
        </View>

        {/* Main Balance Card */}
        <View style={styles.cardWrapper}>
          <LinearGradient
            colors={['#1e3c72', '#2a5298']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <Text style={styles.balanceLabel}>Total Household Net Worth</Text>
            <Text style={styles.balanceAmount}>₹{totalBalance.toLocaleString()}</Text>

            {isLeaderOrCoLeader ? (
              <View style={[styles.cardFooter, { justifyContent: 'flex-end' }]}>
                <TouchableOpacity
                  style={styles.invitePillButton}
                  onPress={() => setShowInviteModal(true)}
                >
                  <IconSymbol name="person.badge.plus" size={16} color="#FFFFFF" />
                  <Text style={styles.invitePillText}>Invite</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </LinearGradient>
        </View>

        {/* Compact Household Members Strip */}
        <View style={styles.membersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Household Members ({householdMembers?.length || 0})
            </Text>
            <TouchableOpacity onPress={() => router.push('/(drawer)/members')}>
              <Text style={styles.seeAll}>Manage ›</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.membersStrip}
          >
            {(householdMembers || []).map((member: HouseholdMemberItem) => {
              const isMe = member.uid === user?.uid;
              const canManage = isLeaderOrCoLeader && !isMe && member.role !== 'leader';
              const roleLabel =
                member.role === 'leader'
                  ? 'Leader'
                  : member.role === 'co-leader'
                    ? 'Co-Leader'
                    : member.access === 'read-only'
                      ? 'Read-Only'
                      : 'Member';

              return (
                <TouchableOpacity
                  key={member.uid}
                  style={styles.memberChip}
                  disabled={!canManage}
                  onPress={() => setSelectedMember(member)}
                  activeOpacity={canManage ? 0.75 : 1}
                >
                  <View
                    style={[
                      styles.memberAvatar,
                      member.role === 'leader' && { backgroundColor: '#2563EB' },
                      member.role === 'co-leader' && { backgroundColor: '#4F46E5' },
                    ]}
                  >
                    <Text style={styles.memberAvatarText}>
                      {member.displayName ? member.displayName[0].toUpperCase() : 'M'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.memberChipName} numberOfLines={1}>
                      {member.displayName}
                      {isMe ? ' (You)' : ''}
                    </Text>
                    <Text
                      style={[
                        styles.memberChipRole,
                        member.role === 'member' && member.access === 'read-only' && { color: '#B45309' },
                      ]}
                    >
                      {roleLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Recent Transactions */}
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/(drawer)/transactions')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {transactions?.length > 0 ? (
            transactions.slice(0, 5).map(renderTransactionItem)
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No transactions yet.</Text>
              <Text style={styles.emptyStateSub}>
                {isReadOnly
                  ? 'You have read-only access to this household.'
                  : 'Tap + below to record your first transaction!'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button (hidden for Read-Only members) */}
      {!isReadOnly ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/new-transaction')}
          activeOpacity={0.85}
        >
          <IconSymbol name="plus" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}

      {/* Leader / Co-Leader Invite Popup */}
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

      {/* Quick Member Control Modal (for Leaders & Co-Leaders) */}
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
