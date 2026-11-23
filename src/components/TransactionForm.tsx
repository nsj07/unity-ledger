import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSelector } from 'react-redux';
import { TransactionService } from '../services/TransactionService';

interface TransactionFormProps {
    householdId: string;
    onClose: () => void;
    onSuccess: () => void;
}

export default function TransactionForm({ householdId, onClose, onSuccess }: TransactionFormProps) {
    const { accounts } = useSelector((state: any) => state.accounts);
    const { categories } = useSelector((state: any) => state.categories);
    const { user } = useSelector((state: any) => state.auth);

    const [type, setType] = useState('Expense');
    const [amount, setAmount] = useState('');
    const [accountId, setAccountId] = useState(accounts.length > 0 ? accounts[0].id : '');
    const [toAccountId, setToAccountId] = useState('');

    // Find Expense/Income categories based on selected type
    const activeCategories = categories.filter((c: any) => c.type === type);
    const [categoryId, setCategoryId] = useState('');
    const [subcategoryName, setSubcategoryName] = useState('');

    const [loading, setLoading] = useState(false);

    const activeCategoryObject = categories.find((c: any) => c.id === categoryId);

    const handleSubmit = async () => {
        if (!amount || Number.isNaN(Number(amount)) || parseFloat(amount) <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid number.");
            return;
        }
        if (!accountId) {
            Alert.alert("Missing Account", "Please select a source account.");
            return;
        }
        if (type === 'Transfer' && !toAccountId) {
            Alert.alert("Missing Destination", "Please select a destination account for the transfer.");
            return;
        }
        if (type !== 'Transfer' && !categoryId) {
            Alert.alert("Missing Category", "Please select a category.");
            return;
        }

        setLoading(true);
        const payload = {
            type,
            amount: parseFloat(amount),
            account_id: accountId,
            to_account_id: type === 'Transfer' ? toAccountId : null,
            category_id: type !== 'Transfer' ? categoryId : null,
            subcategory_name: subcategoryName || null,
            added_by: user.uid
        };

        const response = await TransactionService.createTransaction(householdId, payload);
        setLoading(false);

        if (response.error) {
            Alert.alert("Transaction Failed", response.error);
        } else {
            onSuccess();
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>New Transaction</Text>

            <Text style={styles.label}>Type</Text>
            <Picker selectedValue={type} onValueChange={setType} style={styles.picker}>
                <Picker.Item label="Expense" value="Expense" />
                <Picker.Item label="Income" value="Income" />
                <Picker.Item label="Transfer" value="Transfer" />
            </Picker>

            <Text style={styles.label}>Amount</Text>
            <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
            />

            <Text style={styles.label}>Source Account</Text>
            <Picker selectedValue={accountId} onValueChange={setAccountId} style={styles.picker}>
                <Picker.Item label="Select Account..." value="" />
                {accounts.map((acc: any) => <Picker.Item key={acc.id} label={acc.name} value={acc.id} />)}
            </Picker>

            {type === 'Transfer' ? (
                <>
                    <Text style={styles.label}>To Account</Text>
                    <Picker selectedValue={toAccountId} onValueChange={setToAccountId} style={styles.picker}>
                        <Picker.Item label="Select Destination..." value="" />
                        {accounts.map((acc: any) => <Picker.Item key={acc.id} label={acc.name} value={acc.id} />)}
                    </Picker>
                </>
            ) : (
                <>
                    <Text style={styles.label}>Category</Text>
                    <Picker selectedValue={categoryId} onValueChange={setCategoryId} style={styles.picker}>
                        <Picker.Item label="Select Category..." value="" />
                        {activeCategories.map((cat: any) => <Picker.Item key={cat.id} label={cat.name} value={cat.id} />)}
                    </Picker>

                    {activeCategoryObject && activeCategoryObject.subcategories && activeCategoryObject.subcategories.length > 0 && (
                        <>
                            <Text style={styles.label}>Subcategory (Optional)</Text>
                            <Picker selectedValue={subcategoryName} onValueChange={setSubcategoryName} style={styles.picker}>
                                <Picker.Item label="None" value="" />
                                {activeCategoryObject.subcategories.map((sub: string) => (
                                    <Picker.Item key={sub} label={sub} value={sub} />
                                ))}
                            </Picker>
                        </>
                    )}
                </>
            )}

            <View style={styles.buttonRow}>
                <Button title="Cancel" color="red" onPress={onClose} disabled={loading} />
                <View style={styles.submitBtn}>
                    {loading ? <ActivityIndicator color="white" /> : <Button title="Save" onPress={handleSubmit} />}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20 },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    label: { fontSize: 16, fontWeight: '600', marginTop: 10, marginBottom: 5 },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, fontSize: 16 },
    picker: { backgroundColor: '#f9f9f9', marginBottom: 10 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
    submitBtn: { minWidth: 100 }
});
