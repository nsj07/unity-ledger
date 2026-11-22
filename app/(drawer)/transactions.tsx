import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, Alert, Modal, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Picker } from '@react-native-picker/picker';
import { TransactionService } from '../../src/services/TransactionService';
import { setLoading } from '../../src/store/authSlice';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { createStyles } from './transactions.styles';

export default function TransactionsScreen() {
    const colorScheme = useColorScheme();
    const styles = createStyles(colorScheme);
    const dispatch = useDispatch();

    const { user, householdId } = useSelector((state: any) => state.auth);
    const { transactions } = useSelector((state: any) => state.transactions);
    const { accounts } = useSelector((state: any) => state.accounts);
    const { categories } = useSelector((state: any) => state.categories);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);

    // Form State
    const [txType, setTxType] = useState('Expense');
    const [amount, setAmount] = useState('');
    const [sourceAccount, setSourceAccount] = useState('');
    const [toAccount, setToAccount] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSubCategory, setSelectedSubCategory] = useState('');

    const TX_TYPES = ['Expense', 'Income', 'Transfer'];

    // Filter categories based on transaction type (or show all if transfer)
    const availableCategories = categories.filter((cat: any) =>
        txType === 'Transfer' ? cat.type === 'Transfer' : cat.type === txType
    );

    // Get subcategories for currently selected category
    const activeCategoryObj = categories.find((c: any) => c.id === selectedCategory);
    const availableSubCategories = activeCategoryObj?.subcategories || [];

    const resetForm = () => {
        setTxType('Expense');
        setAmount('');
        setSourceAccount(accounts.length > 0 ? accounts[0].id : '');
        setToAccount('');
        setSelectedCategory('');
        setSelectedSubCategory('');
    };

    const openAddModal = () => {
        resetForm();
        if (accounts.length > 0) setSourceAccount(accounts[0].id);
        setModalVisible(true);
    };

    const handleSaveTransaction = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid transaction amount.");
            return;
        }
        if (!sourceAccount) {
            Alert.alert("No Account", "Please select a source account.");
            return;
        }
        if (txType === 'Transfer' && !toAccount) {
            Alert.alert("Missing Destination", "Please select a destination account for the transfer.");
            return;
        }
        if (txType === 'Transfer' && sourceAccount === toAccount) {
            Alert.alert("Invalid Transfer", "Source and Destination accounts cannot be the same.");
            return;
        }

        const payload = {
            type: txType,
            amount: Number(amount),
            account_id: sourceAccount,
            to_account_id: txType === 'Transfer' ? toAccount : null,
            category_id: selectedCategory || null,
            subcategory_name: selectedSubCategory || null,
            added_by: user.uid
        };

        dispatch(setLoading(true));
        const res = await TransactionService.createTransaction(householdId, payload);
        dispatch(setLoading(false));

        if (res.error) {
            Alert.alert("Error Creating Transaction", res.error);
        } else {
            setModalVisible(false);
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Expense': return '#EF4444';
            case 'Income': return '#10B981';
            case 'Transfer': return '#F59E0B';
            default: return '#6B7280';
        }
    };

    const getCategoryName = (catId: string) => {
        if (!catId) return 'Uncategorized';
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

        // Determine what subtext to show
        let subText = getAccountName(item.account_id);
        if (isTransfer) {
            subText = `${subText} → ${getAccountName(item.to_account_id)}`;
        } else if (item.subcategory_name) {
            subText = `${subText} • ${item.subcategory_name}`;
        }

        return (
            <View style={styles.txnCard}>
                <View style={styles.txnLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
                        <IconSymbol
                            name={isIncome ? "arrow.up.right.circle.fill" : (isTransfer ? "arrow.left.arrow.right.circle.fill" : "arrow.down.left.circle.fill")}
                            size={24}
                            color={color}
                        />
                    </View>
                    <View>
                        <Text style={styles.txnCategory}>{getCategoryName(item.category_id)}</Text>
                        <Text style={styles.txnSubtext}>{subText}</Text>
                    </View>
                </View>
                <View style={styles.txnRight}>
                    <Text style={[styles.txnAmount, { color: color }]}>
                        {sign}₹{item.amount.toLocaleString()}
                    </Text>
                    <Text style={styles.txnDate}>
                        {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Transactions</Text>
                <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                    <IconSymbol name="plus" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={transactions}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<Text style={styles.emptyText}>No transactions recorded yet.</Text>}
            />

            {/* Add Transaction Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Transaction</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <IconSymbol name="xmark.circle.fill" size={28} color={colorScheme === 'dark' ? '#9CA3AF' : '#D1D5DB'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.segmentedRow}>
                                {TX_TYPES.map(type => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[styles.segmentButton, txType === type && styles.segmentButtonActive]}
                                        onPress={() => setTxType(type)}
                                    >
                                        <Text style={[styles.segmentText, txType === type && styles.segmentTextActive]}>{type}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TextInput
                                style={styles.amountInput}
                                placeholder="₹ 0.00"
                                placeholderTextColor={colorScheme === 'dark' ? '#4B5563' : '#9CA3AF'}
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                            />

                            <Text style={styles.inputLabel}>Source Account</Text>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={sourceAccount}
                                    onValueChange={(val) => setSourceAccount(val)}
                                    style={styles.picker}
                                    dropdownIconColor={colorScheme === 'dark' ? '#FFF' : '#000'}
                                >
                                    <Picker.Item label="Select Account" value="" />
                                    {accounts.map((acc: any) => (
                                        <Picker.Item key={acc.id} label={`${acc.name} (₹${acc.balance})`} value={acc.id} color={colorScheme === 'dark' ? '#FFF' : '#000'} />
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
                                            dropdownIconColor={colorScheme === 'dark' ? '#FFF' : '#000'}
                                        >
                                            <Picker.Item label="Select Destination" value="" />
                                            {accounts.map((acc: any) => (
                                                <Picker.Item key={acc.id} label={`${acc.name} (₹${acc.balance})`} value={acc.id} color={colorScheme === 'dark' ? '#FFF' : '#000'} />
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
                                        setSelectedSubCategory(''); // reset sub on cat change
                                    }}
                                    style={styles.picker}
                                    dropdownIconColor={colorScheme === 'dark' ? '#FFF' : '#000'}
                                >
                                    <Picker.Item label="Select Category" value="" />
                                    {availableCategories.map((cat: any) => (
                                        <Picker.Item key={cat.id} label={cat.name} value={cat.id} color={colorScheme === 'dark' ? '#FFF' : '#000'} />
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
                                            dropdownIconColor={colorScheme === 'dark' ? '#FFF' : '#000'}
                                        >
                                            <Picker.Item label="None" value="" />
                                            {availableSubCategories.map((sub: string, index: number) => (
                                                <Picker.Item key={index} label={sub} value={sub} color={colorScheme === 'dark' ? '#FFF' : '#000'} />
                                            ))}
                                        </Picker>
                                    </View>
                                </>
                            )}

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTransaction}>
                                    <Text style={styles.saveBtnText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
