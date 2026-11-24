import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import VoiceTransactionFlowModal from '@/src/components/voice/VoiceTransactionFlowModal';
import { TransactionService } from '@/src/services/TransactionService';
import { selectIsVoiceEntryReadyAndEnabled } from '@/src/store/voiceAiSlice';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Platform,
    SafeAreaView,
    SectionList,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { createStyles } from './transactions.styles';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonthLabel(year: number, month: number) {
    return `${MONTH_NAMES[month]} ${year}`;
}

function formatDayHeader(timestamp: number) {
    const d = new Date(timestamp);
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
    const targetKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    const shortDate = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });

    if (targetKey === todayKey) return `Today • ${shortDate}`;
    if (targetKey === yesterdayKey) return `Yesterday • ${shortDate}`;

    return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

export default function TransactionsScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const styles = createStyles(colorScheme);

    const { householdId, householdRole, householdAccess } = useSelector((state: any) => state.auth);
    const { transactions } = useSelector((state: any) => state.transactions);
    const { accounts } = useSelector((state: any) => state.accounts);
    const { categories } = useSelector((state: any) => state.categories);
    const isReadOnly =
        householdRole !== 'leader' &&
        householdRole !== 'co-leader' &&
        householdAccess === 'read-only';

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const isVoiceAvailable = useSelector(selectIsVoiceEntryReadyAndEnabled);

    const isAtCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;

    // Available (year, month) options that actually have transactions (descending)
    const availableMonths = useMemo(() => {
        const map = new Map<string, { year: number; month: number; count: number }>();
        (transactions || []).forEach((txn: any) => {
            const d = new Date(txn.transaction_date || txn.created_at);
            const y = d.getFullYear();
            const m = d.getMonth();
            const key = `${y}-${m}`;
            const existing = map.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                map.set(key, { year: y, month: m, count: 1 });
            }
        });
        return Array.from(map.values()).sort((a, b) =>
            b.year !== a.year ? b.year - a.year : b.month - a.month
        );
    }, [transactions]);

    // Filter to selected month, sort descending, and group by calendar day
    const { sections, monthlyIncome, monthlyExpense } = useMemo(() => {
        const filtered = (transactions || [])
            .filter((txn: any) => {
                const d = new Date(txn.transaction_date || txn.created_at);
                return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
            })
            .sort(
                (a: any, b: any) =>
                    (b.transaction_date || b.created_at || 0) -
                    (a.transaction_date || a.created_at || 0)
            );

        let income = 0;
        let expense = 0;
        const dayMap = new Map<string, { title: string; dayNet: number; data: any[] }>();

        filtered.forEach((txn: any) => {
            if (txn.type === 'Income') income += Number(txn.amount) || 0;
            if (txn.type === 'Expense') expense += Number(txn.amount) || 0;

            const effectiveTs = txn.transaction_date || txn.created_at;
            const d = new Date(effectiveTs);
            const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const delta =
                txn.type === 'Income'
                    ? Number(txn.amount) || 0
                    : txn.type === 'Expense'
                        ? -(Number(txn.amount) || 0)
                        : 0;

            if (!dayMap.has(dayKey)) {
                dayMap.set(dayKey, {
                    title: formatDayHeader(effectiveTs),
                    dayNet: delta,
                    data: [txn],
                });
            } else {
                const group = dayMap.get(dayKey)!;
                group.dayNet += delta;
                group.data.push(txn);
            }
        });

        return {
            sections: Array.from(dayMap.values()),
            monthlyIncome: income,
            monthlyExpense: expense,
        };
    }, [transactions, selectedYear, selectedMonth]);

    const handlePrevMonth = () => {
        if (selectedMonth === 0) {
            setSelectedMonth(11);
            setSelectedYear((y) => y - 1);
        } else {
            setSelectedMonth((m) => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (isAtCurrentMonth) return;
        if (selectedMonth === 11) {
            setSelectedMonth(0);
            setSelectedYear((y) => y + 1);
        } else {
            setSelectedMonth((m) => m + 1);
        }
    };

    const openCreateModal = () => {
        router.push('/new-transaction');
    };

    const openEditModal = (txn: { id: string }) => {
        if (isReadOnly) return;
        router.push({ pathname: '/new-transaction', params: { transactionId: txn.id } });
    };

    const confirmDeleteTransaction = (txn: any) => {
        if (isReadOnly || !householdId) return;

        const runDelete = async () => {
            const res = await TransactionService.deleteTransaction(householdId, txn.id);
            if (res.error) {
                Alert.alert('Delete Failed', res.error);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('Delete this transaction? Account balances will be updated automatically.')) {
                runDelete();
            }
            return;
        }

        Alert.alert(
            'Delete Transaction',
            'Are you sure you want to delete this transaction? Account balances will be updated automatically.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: runDelete },
            ]
        );
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Expense': return '#EF4444';
            case 'Income': return '#10B981';
            case 'Transfer': return '#F59E0B';
            default: return '#6B7280';
        }
    };

    const getCategoryName = (catId: string, type: string) => {
        if (!catId) return type === 'Transfer' ? 'Transfer' : 'Uncategorized';
        const cat = categories.find((c: any) => c.id === catId);
        return cat ? cat.name : 'Unknown';
    };

    const getAccountName = (accId: string) => {
        const acc = accounts.find((a: any) => a.id === accId);
        return acc ? acc.name : 'Unknown Account';
    };

    const renderItem = ({ item }: { item: any }) => {
        const isIncome = item.type === 'Income';
        const isTransfer = item.type === 'Transfer';
        const color = getTypeColor(item.type);
        const sign = isIncome ? '+' : (isTransfer ? '' : '-');

        let subText = getAccountName(item.account_id);
        if (isTransfer) {
            subText = `${subText} → ${getAccountName(item.to_account_id)}`;
        } else if (item.subcategory_name) {
            subText = `${subText} • ${item.subcategory_name}`;
        }

        return (
            <TouchableOpacity
                style={styles.txnCard}
                onPress={() => openEditModal(item)}
                disabled={isReadOnly}
                activeOpacity={isReadOnly ? 1 : 0.75}
            >
                <View style={styles.txnLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
                        <IconSymbol
                            name={
                                isIncome
                                    ? 'arrow.up.right.circle.fill'
                                    : isTransfer
                                        ? 'arrow.left.arrow.right.circle.fill'
                                        : 'arrow.down.left.circle.fill'
                            }
                            size={24}
                            color={color}
                        />
                    </View>
                    <View style={{ flexShrink: 1 }}>
                        <Text style={styles.txnCategory} numberOfLines={1}>
                            {getCategoryName(item.category_id, item.type)}
                        </Text>
                        <Text style={styles.txnSubtext} numberOfLines={1}>
                            {subText}
                        </Text>
                        {item.note ? (
                            <Text style={styles.txnSubtext} numberOfLines={1}>
                                {item.note}
                            </Text>
                        ) : null}
                    </View>
                </View>

                <View style={styles.txnRight}>
                    <Text style={[styles.txnAmount, { color }]}>
                        {sign}₹{item.amount.toLocaleString()}
                    </Text>
                    {!isReadOnly ? (
                        <View style={styles.txnActionsRow}>
                            <TouchableOpacity
                                style={styles.txnActionBtn}
                                onPress={() => openEditModal(item)}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                                <IconSymbol name="pencil" size={16} color="#6B7280" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.txnActionBtn}
                                onPress={() => confirmDeleteTransaction(item)}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                                <IconSymbol name="trash.fill" size={16} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>
            </TouchableOpacity>
        );
    };

    const monthlyNet = monthlyIncome - monthlyExpense;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Transactions</Text>
                {!isReadOnly ? (
                    <View style={styles.headerActionsRow}>
                        {isVoiceAvailable ? (
                            <TouchableOpacity
                                style={styles.voiceButton}
                                onPress={() => setShowVoiceModal(true)}
                                accessibilityLabel="Add transaction by voice"
                            >
                                <IconSymbol
                                    name="mic.fill"
                                    size={20}
                                    color={colorScheme === 'dark' ? '#93C5FD' : '#2563EB'}
                                />
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
                            <IconSymbol name="plus" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>

            {/* Month Selector Bar */}
            <View style={styles.monthBar}>
                <TouchableOpacity style={styles.monthArrowBtn} onPress={handlePrevMonth}>
                    <IconSymbol
                        name="chevron.left"
                        size={24}
                        color={colorScheme === 'dark' ? '#F9FAFB' : '#111827'}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.monthLabelBtn}
                    onPress={() => setShowMonthPicker(true)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.monthLabelText}>
                        {formatMonthLabel(selectedYear, selectedMonth)}
                    </Text>
                    <IconSymbol
                        name="chevron.down"
                        size={18}
                        color={colorScheme === 'dark' ? '#9CA3AF' : '#6B7280'}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.monthArrowBtn, isAtCurrentMonth && { opacity: 0.3 }]}
                    onPress={handleNextMonth}
                    disabled={isAtCurrentMonth}
                >
                    <IconSymbol
                        name="chevron.right"
                        size={24}
                        color={colorScheme === 'dark' ? '#F9FAFB' : '#111827'}
                    />
                </TouchableOpacity>
            </View>

            {/* Compact Monthly Summary Strip */}
            <View style={styles.summaryStrip}>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Income</Text>
                    <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                        +₹{monthlyIncome.toLocaleString()}
                    </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Expense</Text>
                    <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
                        -₹{monthlyExpense.toLocaleString()}
                    </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Net</Text>
                    <Text
                        style={[
                            styles.summaryValue,
                            { color: monthlyNet >= 0 ? '#10B981' : '#EF4444' },
                        ]}
                    >
                        {monthlyNet >= 0 ? '+' : '-'}₹{Math.abs(monthlyNet).toLocaleString()}
                    </Text>
                </View>
            </View>

            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                renderSectionHeader={({ section }) => (
                    <View style={styles.dayHeader}>
                        <Text style={styles.dayHeaderTitle}>{section.title}</Text>
                        {section.dayNet !== 0 ? (
                            <Text
                                style={[
                                    styles.dayHeaderNet,
                                    { color: section.dayNet >= 0 ? '#10B981' : '#EF4444' },
                                ]}
                            >
                                {section.dayNet >= 0 ? '+' : '-'}₹{Math.abs(section.dayNet).toLocaleString()}
                            </Text>
                        ) : null}
                    </View>
                )}
                stickySectionHeadersEnabled={false}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>
                        No transactions recorded in {formatMonthLabel(selectedYear, selectedMonth)}.
                    </Text>
                }
            />

            {/* Jump-to-Month Picker Modal (only months with available transactions) */}
            <Modal
                visible={showMonthPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowMonthPicker(false)}
            >
                <TouchableOpacity
                    style={styles.pickerModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMonthPicker(false)}
                >
                    <View
                        style={styles.pickerModalCard}
                        onStartShouldSetResponder={() => true}
                    >
                        <View style={styles.pickerModalHeader}>
                            <Text style={styles.pickerModalTitle}>Jump to Month</Text>
                            <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                                <IconSymbol name="xmark.circle.fill" size={24} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        {availableMonths.length > 0 ? (
                            <FlatList
                                data={availableMonths}
                                keyExtractor={(item) => `${item.year}-${item.month}`}
                                style={{ maxHeight: 340 }}
                                renderItem={({ item }) => {
                                    const isSelected =
                                        item.year === selectedYear && item.month === selectedMonth;
                                    return (
                                        <TouchableOpacity
                                            style={[
                                                styles.monthOptionRow,
                                                isSelected && styles.monthOptionRowActive,
                                            ]}
                                            onPress={() => {
                                                setSelectedYear(item.year);
                                                setSelectedMonth(item.month);
                                                setShowMonthPicker(false);
                                            }}
                                        >
                                            <Text
                                                style={[
                                                    styles.monthOptionText,
                                                    isSelected && styles.monthOptionTextActive,
                                                ]}
                                            >
                                                {formatMonthLabel(item.year, item.month)}
                                            </Text>
                                            <Text style={styles.monthOptionCount}>
                                                {item.count} {item.count === 1 ? 'txn' : 'txns'}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        ) : (
                            <Text style={styles.pickerEmptyText}>
                                No months with transactions available yet.
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {!isReadOnly && isVoiceAvailable ? (
                <VoiceTransactionFlowModal
                    visible={showVoiceModal}
                    onClose={() => setShowVoiceModal(false)}
                />
            ) : null}
        </SafeAreaView>
    );
}
