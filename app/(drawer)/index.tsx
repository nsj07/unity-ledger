import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, SafeAreaView, StatusBar, Modal } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import InviteModal from '@/src/components/InviteModal';
import { AuthService } from '@/src/services/AuthService';
import { HouseholdService } from '@/src/services/HouseholdService';
import { clearAuth, setHouseholdContext } from '@/src/store/authSlice';
import { router } from 'expo-router';

// Premium Dashboard Entry
export default function DashboardScreen() {
  const dispatch = useDispatch();
  const { user, householdId, householdName, householdRole } = useSelector((state: any) => state.auth);
  const { accounts } = useSelector((state: any) => state.accounts);
  const { transactions } = useSelector((state: any) => state.transactions);

  const [totalBalance, setTotalBalance] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableHouseholds, setAvailableHouseholds] = useState<any[]>([]);
  const isLeader = householdRole === 'leader';

  // Calculate Net balance
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      const sum = accounts.reduce((acc: number, curr: any) => acc + (curr.balance || 0), 0);
      setTotalBalance(sum);
    } else {
      setTotalBalance(0);
    }
  }, [accounts]);

  // Load available households when Profile opens (or on mount)
  const fetchHouseholds = async () => {
    if (user?.uid) {
      const res = await HouseholdService.getUserHouseholds(user.uid);
      if (!res.error) setAvailableHouseholds(res.households);
    }
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await AuthService.logoutUser();
    dispatch(clearAuth());
    router.replace('/login');
  };

  const handleCreateOrJoinNew = () => {
    setShowProfileMenu(false);
    router.push('/onboarding');
  };

  const handleSwitchActiveHousehold = async (hh: any) => {
    setShowProfileMenu(false);
    if (hh.id === householdId) return;

    await HouseholdService.switchActiveHousehold(user.uid, hh.id);
    dispatch(setHouseholdContext({
      householdId: hh.id,
      householdName: hh.name,
      householdRole: hh.role
    }));
    // Layout and GlobalSyncProvider will automagically intercept the householdId swap
    // and wipe/re-subscribe the Redux accounts/transactions appropriately!
  };

  const renderTransactionItem = ({ item }: { item: any }) => {
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
      <View style={styles.txnCard}>
        <View style={styles.txnLeft}>
          <IconSymbol name={icon} size={36} color={color} />
          <View style={styles.txnTextContainer}>
            <Text style={styles.txnCategory}>{item.subcategory_name || item.type}</Text>
            <Text style={styles.txnDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
        </View>
        <Text style={[styles.txnAmount, { color }]}>
          {isExpense ? '-' : (isTransfer ? '' : '+')}₹{item.amount.toLocaleString()}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header Profile Area */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.displayName || 'User'}</Text>
          <Text style={styles.householdBadge}>{householdName || 'My Household'}</Text>
        </View>
        <TouchableOpacity onPress={() => {
          setShowProfileMenu(true);
          fetchHouseholds();
        }}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.displayName ? user.displayName[0] : 'U'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Main Balance Card (Glassmorphism inspired) */}
      <View style={styles.cardWrapper}>
        <LinearGradient
          colors={['#1e3c72', '#2a5298']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Total Household Net Worth</Text>
          <Text style={styles.balanceAmount}>₹{totalBalance.toLocaleString()}</Text>

          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterText}>{accounts?.length || 0} Connected Accounts</Text>
            {isLeader ? (
              <TouchableOpacity
                style={styles.invitePillButton}
                onPress={() => setShowInviteModal(true)}
              >
                <IconSymbol name="person.badge.plus" size={16} color="#FFFFFF" />
                <Text style={styles.invitePillText}>Invite</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </LinearGradient>
      </View>

      {/* Content Area */}
      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Text style={styles.seeAll}>See All</Text>
        </View>

        {transactions?.length > 0 ? (
          <FlatList
            data={transactions.slice(0, 5)} // Show only top 5 recent
            keyExtractor={item => item.id}
            renderItem={renderTransactionItem}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No transactions yet.</Text>
            <Text style={styles.emptyStateSub}>Head to the Accounts tab to add funds!</Text>
          </View>
        )}
      </View>

      {/* Profile Modal */}
      <Modal visible={showProfileMenu} transparent={true} animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowProfileMenu(false)}>
          <View style={styles.menuBox}>
            <Text style={styles.menuTitle}>My Households</Text>

            {availableHouseholds.map(hh => (
              <TouchableOpacity
                key={hh.id}
                style={[styles.menuItem, hh.id === householdId && styles.menuItemActive]}
                onPress={() => handleSwitchActiveHousehold(hh)}
              >
                <IconSymbol name={hh.id === householdId ? "house.fill" : "house"} size={20} color={hh.id === householdId ? "#3B82F6" : "#4B5563"} />
                <Text style={[styles.menuText, hh.id === householdId && styles.menuTextActive]}>{hh.name || "Default Household"}</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.divider} />
            <Text style={styles.menuTitle}>Profile Options</Text>
            <TouchableOpacity style={styles.menuItem} onPress={handleCreateOrJoinNew}>
              <IconSymbol name="chart.pie.fill" size={24} color="#333" />
              <Text style={styles.menuText}>Create / Join New</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={24} color="#FF3B30" />
              <Text style={[styles.menuText, { color: '#FF3B30' }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Leader-only Invite Popup */}
      {isLeader && householdId && user?.uid ? (
        <InviteModal
          visible={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          householdId={householdId}
          householdName={householdName || 'My Household'}
          userId={user.uid}
          userName={user.displayName || 'Household Leader'}
        />
      ) : null}

    </SafeAreaView>
  );
}

import { styles } from './index.styles';
