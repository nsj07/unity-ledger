import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { TransactionService } from '@/src/services/TransactionService';
import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSelector } from 'react-redux';

export type TransactionType = 'Expense' | 'Income' | 'Transfer';

export interface EditableTransaction {
    id: string;
    type: TransactionType;
    amount: number;
    account_id: string;
    to_account_id?: string | null;
    category_id?: string | null;
    subcategory_name?: string | null;
    created_at?: number;
}

interface AddTransactionModalProps {
    visible: boolean;
    onClose: () => void;
    initialType?: TransactionType;
    editingTransaction?: EditableTransaction | null;
}

const TX_TYPES: TransactionType[] = ['Expense', 'Income', 'Transfer'];

export default function AddTransactionModal({
    visible,
    onClose,
    initialType = 'Expense',
    editingTransaction = null,
}: AddTransactionModalProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const styles = createStyles(isDark);

    const { user, householdId } = useSelector((state: any) => state.auth);
    const { accounts } = useSelector((state: any) => state.accounts);
    const { categories } = useSelector((state: any) => state.categories);

    const isEditing = !!editingTransaction;

    const [txType, setTxType] = useState<TransactionType>(editingTransaction?.type || initialType);
    const [amount, setAmount] = useState(
        editingTransaction ? String(editingTransaction.amount) : ''
    );
    const [sourceAccount, setSourceAccount] = useState(editingTransaction?.account_id || '');
    const [toAccount, setToAccount] = useState(editingTransaction?.to_account_id || '');
    const [selectedCategory, setSelectedCategory] = useState(editingTransaction?.category_id || '');
    const [selectedSubCategory, setSelectedSubCategory] = useState(
        editingTransaction?.subcategory_name || ''
    );
    const [saving, setSaving] = useState(false);

    const effectiveSourceAccount = sourceAccount || (accounts.length > 0 ? accounts[0].id : '');

    const availableCategories = categories.filter((cat: any) =>
        txType === 'Transfer' ? cat.type === 'Transfer' : cat.type === txType
    );

    const activeCategoryObj = categories.find((c: any) => c.id === selectedCategory);
    const availableSubCategories: string[] = activeCategoryObj?.subcategories || [];

    const resetForm = () => {
        setTxType(initialType);
        setAmount('');
        setSourceAccount('');
        setToAccount('');
        setSelectedCategory('');
        setSelectedSubCategory('');
    };

    const handleClose = () => {
        if (!isEditing) {
            resetForm();
        }
        onClose();
    };

    const handleTypeChange = (type: TransactionType) => {
        setTxType(type);
        setSelectedCategory('');
        setSelectedSubCategory('');
    };

    const handleSaveTransaction = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid transaction amount.');
            return;
        }
        if (!effectiveSourceAccount) {
            Alert.alert('No Account', 'Please select a source account.');
            return;
        }
        if (txType === 'Transfer' && !toAccount) {
            Alert.alert('Missing Destination', 'Please select a destination account for the transfer.');
            return;
        }
        if (txType === 'Transfer' && effectiveSourceAccount === toAccount) {
            Alert.alert('Invalid Transfer', 'Source and Destination accounts cannot be the same.');
            return;
        }
        if (!householdId || !user?.uid) {
            Alert.alert('Session Error', 'Active household or user session is missing.');
            return;
        }

        const payload = {
            type: txType,
            amount: Number(amount),
            account_id: effectiveSourceAccount,
            to_account_id: txType === 'Transfer' ? toAccount : null,
            category_id: selectedCategory || null,
            subcategory_name: selectedSubCategory || null,
            added_by: user.uid,
        };

        setSaving(true);
        const res = isEditing && editingTransaction
            ? await TransactionService.updateTransaction(householdId, editingTransaction.id, payload)
            : await TransactionService.createTransaction(householdId, payload);
        setSaving(false);

        if (res.error) {
            Alert.alert(isEditing ? 'Error Updating Transaction' : 'Error Creating Transaction', res.error);
        } else {
            handleClose();
        }
    };

    const performDelete = async () => {
        if (!householdId || !editingTransaction) return;
        setSaving(true);
        const res = await TransactionService.deleteTransaction(householdId, editingTransaction.id);
        setSaving(false);
        if (res.error) {
            Alert.alert('Delete Failed', res.error);
        } else {
            onClose();
        }
    };

    const handleDeletePress = () => {
        if (Platform.OS === 'web') {
            if (window.confirm('Delete this transaction? Account balances will be adjusted automatically.')) {
                performDelete();
            }
            return;
        }
        Alert.alert(
            'Delete Transaction',
            'Are you sure you want to delete this transaction? Account balances will be adjusted automatically.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: performDelete },
            ]
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {isEditing ? 'Edit Transaction' : 'New Transaction'}
                        </Text>
                        <TouchableOpacity onPress={handleClose} disabled={saving}>
                            <IconSymbol
                                name="xmark.circle.fill"
                                size={28}
                                color={isDark ? '#9CA3AF' : '#D1D5DB'}
                            />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View style={styles.segmentedRow}>
                            {TX_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.segmentButton,
                                        txType === type && styles.segmentButtonActive,
                                    ]}
                                    onPress={() => handleTypeChange(type)}
                                    disabled={saving}
                                >
                                    <Text
                                        style={[
                                            styles.segmentText,
                                            txType === type && styles.segmentTextActive,
                                        ]}
                                    >
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={styles.amountInput}
                            placeholder="₹ 0.00"
                            placeholderTextColor={isDark ? '#4B5563' : '#9CA3AF'}
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                            editable={!saving}
                        />

                        <Text style={styles.inputLabel}>Source Account</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={effectiveSourceAccount}
                                onValueChange={(val) => setSourceAccount(val)}
                                style={styles.picker}
                                dropdownIconColor={isDark ? '#FFF' : '#000'}
                                enabled={!saving}
                            >
                                <Picker.Item label="Select Account" value="" />
                                {accounts.map((acc: any) => (
                                    <Picker.Item
                                        key={acc.id}
                                        label={`${acc.name} (₹${acc.balance})`}
                                        value={acc.id}
                                        color={isDark ? '#FFF' : '#000'}
                                    />
                                ))}
                            </Picker>
                        </View>

                        {txType === 'Transfer' && (
                            <>
                                <Text style={styles.inputLabel}>Destination Account</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={toAccount}
                                        onValueChange={(val) => setToAccount(val)}
                                        style={styles.picker}
                                        dropdownIconColor={isDark ? '#FFF' : '#000'}
                                        enabled={!saving}
                                    >
                                        <Picker.Item label="Select Destination" value="" />
                                        {accounts.map((acc: any) => (
                                            <Picker.Item
                                                key={acc.id}
                                                label={`${acc.name} (₹${acc.balance})`}
                                                value={acc.id}
                                                color={isDark ? '#FFF' : '#000'}
                                            />
                                        ))}
                                    </Picker>
                                </View>
                            </>
                        )}

                        <Text style={styles.inputLabel}>Category</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={selectedCategory}
                                onValueChange={(val) => {
                                    setSelectedCategory(val);
                                    setSelectedSubCategory('');
                                }}
                                style={styles.picker}
                                dropdownIconColor={isDark ? '#FFF' : '#000'}
                                enabled={!saving}
                            >
                                <Picker.Item label="Select Category" value="" />
                                {availableCategories.map((cat: any) => (
                                    <Picker.Item
                                        key={cat.id}
                                        label={cat.name}
                                        value={cat.id}
                                        color={isDark ? '#FFF' : '#000'}
                                    />
                                ))}
                            </Picker>
                        </View>

                        {availableSubCategories.length > 0 && (
                            <>
                                <Text style={styles.inputLabel}>Sub-Category</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={selectedSubCategory}
                                        onValueChange={(val) => setSelectedSubCategory(val)}
                                        style={styles.picker}
                                        dropdownIconColor={isDark ? '#FFF' : '#000'}
                                        enabled={!saving}
                                    >
                                        <Picker.Item label="None" value="" />
                                        {availableSubCategories.map((sub: string, index: number) => (
                                            <Picker.Item
                                                key={index}
                                                label={sub}
                                                value={sub}
                                                color={isDark ? '#FFF' : '#000'}
                                            />
                                        ))}
                                    </Picker>
                                </View>
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={handleClose}
                                disabled={saving}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            {isEditing ? (
                                <TouchableOpacity
                                    style={[styles.deleteBtn, saving && { opacity: 0.7 }]}
                                    onPress={handleDeletePress}
                                    disabled={saving}
                                >
                                    <Text style={styles.saveBtnText}>Delete</Text>
                                </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                                onPress={handleSaveTransaction}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveBtnText}>
                                        {isEditing ? 'Update' : 'Save'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (isDark: boolean) =>
    StyleSheet.create({
        modalOverlay: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.6)',
        },
        modalContent: {
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: '90%',
            paddingBottom: 40,
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        },
        modalTitle: {
            fontSize: 22,
            fontWeight: '800',
            color: isDark ? '#FFFFFF' : '#111827',
        },
        segmentedRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 24,
            backgroundColor: isDark ? '#374151' : '#F3F4F6',
            borderRadius: 12,
            padding: 4,
        },
        segmentButton: {
            flex: 1,
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: 8,
        },
        segmentButtonActive: {
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
        },
        segmentText: {
            fontWeight: '600',
            color: isDark ? '#9CA3AF' : '#6B7280',
        },
        segmentTextActive: {
            color: isDark ? '#F9FAFB' : '#111827',
        },
        inputLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: isDark ? '#9CA3AF' : '#4B5563',
            marginBottom: 8,
            marginTop: 16,
        },
        amountInput: {
            fontSize: 32,
            fontWeight: '800',
            textAlign: 'center',
            borderWidth: 0,
            backgroundColor: 'transparent',
            marginBottom: 10,
            color: isDark ? '#FFFFFF' : '#111827',
        },
        pickerWrapper: {
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            borderRadius: 12,
            overflow: 'hidden',
        },
        picker: {
            color: isDark ? '#FFFFFF' : '#111827',
            backgroundColor: 'transparent',
            height: 50,
        },
        modalActions: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 30,
            gap: 10,
        },
        cancelBtn: {
            flex: 1,
            paddingVertical: 15,
            borderRadius: 12,
            backgroundColor: isDark ? '#374151' : '#F3F4F6',
            alignItems: 'center',
        },
        cancelBtnText: {
            color: isDark ? '#D1D5DB' : '#4B5563',
            fontWeight: '700',
            fontSize: 15,
        },
        deleteBtn: {
            flex: 1,
            paddingVertical: 15,
            borderRadius: 12,
            backgroundColor: '#EF4444',
            alignItems: 'center',
        },
        saveBtn: {
            flex: 1,
            paddingVertical: 15,
            borderRadius: 12,
            backgroundColor: '#3B82F6',
            alignItems: 'center',
        },
        saveBtnText: {
            color: '#FFFFFF',
            fontWeight: '700',
            fontSize: 15,
        },
    });
