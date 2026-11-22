import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import BottomPickerSheet, { BottomPickerItem } from '@/src/components/BottomPickerSheet';
import CategoryPickerSheet from '@/src/components/CategoryPickerSheet';
import DatePickerSheet from '@/src/components/DatePickerSheet';
import { TransactionService } from '@/src/services/TransactionService';
import { createStyles } from './new-transaction.styles';

export type TransactionType = 'Expense' | 'Income' | 'Transfer';

const TX_TYPES: TransactionType[] = ['Expense', 'Income', 'Transfer'];

const getTypeAccent = (type: TransactionType) => {
    switch (type) {
        case 'Expense':
            return '#EF4444';
        case 'Income':
            return '#10B981';
        case 'Transfer':
            return '#F59E0B';
    }
};

const formatDisplayDate = (date: Date) => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const sameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    const formatted = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    if (sameDay(date, now)) return `Today, ${formatted}`;
    if (sameDay(date, yesterday)) return `Yesterday, ${formatted}`;
    return formatted;
};

export default function NewTransactionScreen() {
    const router = useRouter();
    const { transactionId } = useLocalSearchParams<{ transactionId?: string }>();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const styles = createStyles(isDark);

    const { user, householdId } = useSelector((state: any) => state.auth);
    const { accounts } = useSelector((state: any) => state.accounts);
    const { categories } = useSelector((state: any) => state.categories);
    const { transactions } = useSelector((state: any) => state.transactions);

    const editingTxn = useMemo(
        () =>
            transactionId
                ? (transactions || []).find((t: any) => t.id === transactionId) || null
                : null,
        [transactionId, transactions]
    );
    const isEditMode = !!editingTxn;

    const [txType, setTxType] = useState<TransactionType>(
        (editingTxn?.type as TransactionType) || 'Expense'
    );
    const [amount, setAmount] = useState(
        editingTxn?.amount != null ? String(editingTxn.amount) : ''
    );
    const [sourceAccount, setSourceAccount] = useState(editingTxn?.account_id || '');
    const [toAccount, setToAccount] = useState(editingTxn?.to_account_id || '');
    const [selectedCategory, setSelectedCategory] = useState(editingTxn?.category_id || '');
    const [selectedSubCategory, setSelectedSubCategory] = useState(
        editingTxn?.subcategory_name || ''
    );
    const [transactionDate, setTransactionDate] = useState<Date>(() =>
        editingTxn
            ? new Date(editingTxn.transaction_date || editingTxn.created_at || Date.now())
            : new Date()
    );
    const [note, setNote] = useState(editingTxn?.note || '');
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Bottom sheet visibility
    const [showSourceSheet, setShowSourceSheet] = useState(false);
    const [showDestSheet, setShowDestSheet] = useState(false);
    const [showCategorySheet, setShowCategorySheet] = useState(false);
    const [showDateSheet, setShowDateSheet] = useState(false);

    const scrollViewRef = useRef<ComponentRef<typeof ScrollView>>(null);
    const isNoteFocusedRef = useRef(false);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const sub = Keyboard.addListener(showEvent, () => {
            if (isNoteFocusedRef.current) {
                setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 80);
            }
        });
        return () => sub.remove();
    }, []);

    const topPadding =
        Platform.OS === 'android'
            ? Math.max(insets.top, StatusBar.currentHeight || 0) + 10
            : insets.top + 8;

    const effectiveSourceAccountId =
        sourceAccount || (accounts.length > 0 ? accounts[0].id : '');

    const sourceAccountObj = accounts.find((a: any) => a.id === effectiveSourceAccountId);
    const destAccountObj = accounts.find((a: any) => a.id === toAccount);

    const availableCategories = useMemo(
        () =>
            categories.filter((cat: any) =>
                txType === 'Transfer' ? cat.type === 'Transfer' : cat.type === txType
            ),
        [categories, txType]
    );

    const activeCategoryObj = categories.find((c: any) => c.id === selectedCategory);

    const accountPickerItems: BottomPickerItem[] = useMemo(
        () =>
            accounts.map((acc: any) => ({
                id: acc.id,
                label: acc.name,
                subtitle: acc.type || undefined,
                rightText: `₹${Number(acc.balance || 0).toLocaleString()}`,
            })),
        [accounts]
    );

    const handleTypeChange = (type: TransactionType) => {
        setTxType(type);
        setSelectedCategory('');
        setSelectedSubCategory('');
    };

    const navigateBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(drawer)');
        }
    };

    const handleSaveTransaction = async () => {
        setErrorMessage(null);
        const numericAmount = Number(amount);
        if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
            const msg = 'Please enter a valid transaction amount.';
            setErrorMessage(msg);
            Alert.alert('Invalid Amount', msg);
            return;
        }
        if (!effectiveSourceAccountId) {
            const msg = 'Please select a source account.';
            setErrorMessage(msg);
            Alert.alert('No Account', msg);
            return;
        }
        if (txType === 'Transfer' && !toAccount) {
            const msg = 'Please select a destination account for the transfer.';
            setErrorMessage(msg);
            Alert.alert('Missing Destination', msg);
            return;
        }
        if (txType === 'Transfer' && effectiveSourceAccountId === toAccount) {
            const msg = 'Source and Destination accounts cannot be the same.';
            setErrorMessage(msg);
            Alert.alert('Invalid Transfer', msg);
            return;
        }
        if (!householdId || !user?.uid) {
            const msg = 'Active household or user session is missing.';
            setErrorMessage(msg);
            Alert.alert('Session Error', msg);
            return;
        }

        const payload = {
            type: txType,
            amount: numericAmount,
            account_id: effectiveSourceAccountId,
            to_account_id: txType === 'Transfer' ? toAccount : null,
            category_id: selectedCategory || null,
            subcategory_name: selectedSubCategory || null,
            note: note.trim() || null,
            transaction_date: transactionDate,
            added_by: user.uid,
        };

        setSaving(true);
        const res = isEditMode
            ? await TransactionService.updateTransaction(householdId, editingTxn.id, payload)
            : await TransactionService.createTransaction(householdId, payload);
        setSaving(false);

        if (res.error) {
            setErrorMessage(res.error);
            Alert.alert(
                isEditMode ? 'Error Updating Transaction' : 'Error Creating Transaction',
                res.error
            );
        } else {
            navigateBack();
        }
    };

    const typeAccent = getTypeAccent(txType);
    const categoryDisplay = activeCategoryObj
        ? selectedSubCategory
            ? `${activeCategoryObj.name} › ${selectedSubCategory}`
            : activeCategoryObj.name
        : '';

    return (
        <View style={styles.screen}>
            {/* Top Header */}
            <View style={[styles.header, { paddingTop: topPadding }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={navigateBack}
                    disabled={saving}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <IconSymbol
                        name="chevron.left"
                        size={24}
                        color={isDark ? '#F9FAFB' : '#111827'}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isEditMode ? 'Edit Transaction' : 'New Transaction'}
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'web' ? undefined : 'padding'}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                >
                    {/* Inline Error Banner (ensures errors are always visible on mobile & web) */}
                    {errorMessage ? (
                        <View
                            style={{
                                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEF2F2',
                                borderWidth: 1,
                                borderColor: isDark ? '#EF4444' : '#FECACA',
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 16,
                            }}
                        >
                            <Text
                                style={{
                                    color: isDark ? '#FCA5A5' : '#B91C1C',
                                    fontSize: 13,
                                    fontWeight: '600',
                                }}
                            >
                                {errorMessage}
                            </Text>
                        </View>
                    ) : null}

                    {/* Transaction Type Segmented Control */}
                    <View style={styles.segmentedRow}>
                        {TX_TYPES.map((type) => {
                            const isActive = txType === type;
                            return (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.segmentButton,
                                        isActive && styles.segmentButtonActive,
                                    ]}
                                    onPress={() => handleTypeChange(type)}
                                    disabled={saving}
                                    activeOpacity={0.75}
                                >
                                    <Text
                                        style={[
                                            styles.segmentText,
                                            isActive && styles.segmentTextActive,
                                            isActive && { color: getTypeAccent(type) },
                                        ]}
                                    >
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Amount Card */}
                    <View style={styles.amountCard}>
                        <Text style={styles.amountCaption}>{txType} Amount</Text>
                        <View style={styles.amountInputRow}>
                            <Text style={[styles.currencySymbol, { color: typeAccent }]}>₹</Text>
                            <TextInput
                                style={styles.amountInput}
                                placeholder="0.00"
                                placeholderTextColor={isDark ? '#4B5563' : '#9CA3AF'}
                                keyboardType="decimal-pad"
                                value={amount}
                                onChangeText={setAmount}
                                editable={!saving}
                            />
                        </View>
                    </View>

                    {/* Selector Rows Card */}
                    <View style={styles.sectionCard}>
                        {/* Source Account */}
                        <TouchableOpacity
                            style={styles.selectorRow}
                            onPress={() => setShowSourceSheet(true)}
                            disabled={saving}
                            activeOpacity={0.7}
                        >
                            <View style={styles.selectorLeft}>
                                <View style={styles.selectorIconWrap}>
                                    <IconSymbol
                                        name="creditcard.fill"
                                        size={18}
                                        color={isDark ? '#60A5FA' : '#2563EB'}
                                    />
                                </View>
                                <View style={styles.selectorTextCol}>
                                    <Text style={styles.selectorLabel}>Source Account</Text>
                                    <Text
                                        style={[
                                            styles.selectorValue,
                                            !sourceAccountObj && styles.selectorPlaceholder,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {sourceAccountObj
                                            ? sourceAccountObj.name
                                            : 'Select source account'}
                                    </Text>
                                    {sourceAccountObj ? (
                                        <Text style={styles.selectorSubValue}>
                                            Balance: ₹{Number(sourceAccountObj.balance || 0).toLocaleString()}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                            <IconSymbol
                                name="chevron.right"
                                size={20}
                                color={isDark ? '#6B7280' : '#9CA3AF'}
                            />
                        </TouchableOpacity>

                        {/* Destination Account (Transfer only) */}
                        {txType === 'Transfer' ? (
                            <TouchableOpacity
                                style={styles.selectorRow}
                                onPress={() => setShowDestSheet(true)}
                                disabled={saving}
                                activeOpacity={0.7}
                            >
                                <View style={styles.selectorLeft}>
                                    <View style={styles.selectorIconWrap}>
                                        <IconSymbol
                                            name="arrow.left.arrow.right.circle.fill"
                                            size={18}
                                            color="#F59E0B"
                                        />
                                    </View>
                                    <View style={styles.selectorTextCol}>
                                        <Text style={styles.selectorLabel}>Destination Account</Text>
                                        <Text
                                            style={[
                                                styles.selectorValue,
                                                !destAccountObj && styles.selectorPlaceholder,
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {destAccountObj
                                                ? destAccountObj.name
                                                : 'Select destination account'}
                                        </Text>
                                        {destAccountObj ? (
                                            <Text style={styles.selectorSubValue}>
                                                Balance: ₹{Number(destAccountObj.balance || 0).toLocaleString()}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>
                                <IconSymbol
                                    name="chevron.right"
                                    size={20}
                                    color={isDark ? '#6B7280' : '#9CA3AF'}
                                />
                            </TouchableOpacity>
                        ) : null}

                        {/* Category & Sub-Category */}
                        <TouchableOpacity
                            style={styles.selectorRow}
                            onPress={() => setShowCategorySheet(true)}
                            disabled={saving}
                            activeOpacity={0.7}
                        >
                            <View style={styles.selectorLeft}>
                                <View style={styles.selectorIconWrap}>
                                    <IconSymbol
                                        name="tag.fill"
                                        size={18}
                                        color={typeAccent}
                                    />
                                </View>
                                <View style={styles.selectorTextCol}>
                                    <Text style={styles.selectorLabel}>Category</Text>
                                    <Text
                                        style={[
                                            styles.selectorValue,
                                            !categoryDisplay && styles.selectorPlaceholder,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {categoryDisplay || 'Select category & sub-category'}
                                    </Text>
                                </View>
                            </View>
                            <IconSymbol
                                name="chevron.right"
                                size={20}
                                color={isDark ? '#6B7280' : '#9CA3AF'}
                            />
                        </TouchableOpacity>

                        {/* Transaction Date */}
                        <TouchableOpacity
                            style={[styles.selectorRow, styles.selectorRowLast]}
                            onPress={() => setShowDateSheet(true)}
                            disabled={saving}
                            activeOpacity={0.7}
                        >
                            <View style={styles.selectorLeft}>
                                <View style={styles.selectorIconWrap}>
                                    <IconSymbol
                                        name="calendar"
                                        size={18}
                                        color={isDark ? '#60A5FA' : '#2563EB'}
                                    />
                                </View>
                                <View style={styles.selectorTextCol}>
                                    <Text style={styles.selectorLabel}>Date</Text>
                                    <Text style={styles.selectorValue} numberOfLines={1}>
                                        {formatDisplayDate(transactionDate)}
                                    </Text>
                                </View>
                            </View>
                            <IconSymbol
                                name="chevron.right"
                                size={20}
                                color={isDark ? '#6B7280' : '#9CA3AF'}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Note / Description */}
                    <View style={styles.noteCard}>
                        <View style={styles.noteHeader}>
                            <IconSymbol
                                name="note.text"
                                size={18}
                                color={isDark ? '#9CA3AF' : '#6B7280'}
                            />
                            <Text style={styles.noteLabel}>Note / Description (Optional)</Text>
                        </View>
                        <TextInput
                            style={styles.noteInput}
                            placeholder="Add a note about this transaction..."
                            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                            value={note}
                            onChangeText={setNote}
                            multiline
                            numberOfLines={3}
                            maxLength={250}
                            editable={!saving}
                            onFocus={() => {
                                isNoteFocusedRef.current = true;
                                setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }, 150);
                            }}
                            onBlur={() => {
                                isNoteFocusedRef.current = false;
                            }}
                            onContentSizeChange={() => {
                                if (isNoteFocusedRef.current) {
                                    scrollViewRef.current?.scrollToEnd({ animated: true });
                                }
                            }}
                        />
                    </View>
                </ScrollView>

                {/* Sticky Footer Actions */}
                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={navigateBack}
                        disabled={saving}
                    >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                        onPress={handleSaveTransaction}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.saveBtnText}>
                                {isEditMode ? 'Update Transaction' : 'Save Transaction'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Bottom Scrollable Sheets */}
            <BottomPickerSheet
                visible={showSourceSheet}
                title="Select Source Account"
                items={accountPickerItems}
                selectedId={effectiveSourceAccountId}
                onSelect={(id) => setSourceAccount(id)}
                onClose={() => setShowSourceSheet(false)}
                emptyText="No accounts found. Please add an account first."
            />

            <BottomPickerSheet
                visible={showDestSheet}
                title="Select Destination Account"
                items={accountPickerItems}
                selectedId={toAccount}
                onSelect={(id) => setToAccount(id)}
                onClose={() => setShowDestSheet(false)}
                emptyText="No accounts found. Please add an account first."
            />

            <CategoryPickerSheet
                visible={showCategorySheet}
                title={`Select ${txType} Category`}
                categories={availableCategories}
                selectedCategoryId={selectedCategory}
                selectedSubCategory={selectedSubCategory}
                onSelect={(catId, subCat) => {
                    setSelectedCategory(catId);
                    setSelectedSubCategory(subCat);
                }}
                onClose={() => setShowCategorySheet(false)}
            />

            <DatePickerSheet
                visible={showDateSheet}
                selectedDate={transactionDate}
                onSelect={(date) => setTransactionDate(date)}
                onClose={() => setShowDateSheet(false)}
            />
        </View>
    );
}
