import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, Button, TextInput, Alert, Modal, TouchableOpacity } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { AccountService } from '../../src/services/AccountService';
import { setAccounts, setLoading, setError } from '../../src/store/accountsSlice';

export default function AccountsScreen() {
    const { householdId, householdRole, householdAccess } = useSelector((state: any) => state.auth);
    const { accounts, isLoading } = useSelector((state: any) => state.accounts);
    const isReadOnly = householdRole !== 'leader' && householdRole !== 'co-leader' && householdAccess === 'read-only';
    const dispatch = useDispatch();

    const [modalVisible, setModalVisible] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState('Savings'); // Default
    const [newAccountBalance, setNewAccountBalance] = useState('');

    useEffect(() => {
        if (householdId) {
            loadAccounts();
        }
    }, [householdId]);

    const loadAccounts = async () => {
        dispatch(setLoading(true));
        const response = await AccountService.getAccounts(householdId);
        dispatch(setLoading(false));

        if (response.error) {
            dispatch(setError(response.error));
            Alert.alert("Error Loading Accounts", response.error);
        } else {
            dispatch(setAccounts(response.accounts));
        }
    };

    const handleAddAccount = async () => {
        if (!newAccountName || !newAccountBalance) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        const payload = {
            name: newAccountName,
            type: newAccountType,
            balance: parseFloat(newAccountBalance) || 0
        };

        const response = await AccountService.createAccount(householdId, payload);
        if (response.error) {
            Alert.alert("Error", response.error);
        } else {
            setModalVisible(false);
            setNewAccountName('');
            setNewAccountBalance('');
            loadAccounts(); // Reload the list
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name} ({item.type})</Text>
            <Text style={styles.amount}>Balance: {item.balance}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Source Accounts</Text>
            {!isReadOnly ? (
                <Button title="Add New Account" onPress={() => setModalVisible(true)} />
            ) : null}

            {isLoading ? (
                <Text style={styles.loading}>Loading accounts...</Text>
            ) : (
                <FlatList
                    data={accounts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingVertical: 20 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No accounts found. Create one!</Text>}
                />
            )}

            {/* Add Account Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Account</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Account Name (e.g. HDFC Bank)"
                            value={newAccountName}
                            onChangeText={setNewAccountName}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Initial Balance"
                            value={newAccountBalance}
                            onChangeText={setNewAccountBalance}
                            keyboardType="numeric"
                        />

                        <View style={styles.buttonRow}>
                            <Button title="Cancel" color="red" onPress={() => setModalVisible(false)} />
                            <Button title="Save" onPress={handleAddAccount} />
                        </View>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 15
    },
    card: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        elevation: 2
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600'
    },
    amount: {
        fontSize: 16,
        color: '#4CAF50',
        marginTop: 5,
        fontWeight: 'bold'
    },
    loading: {
        marginTop: 20,
        textAlign: 'center'
    },
    emptyText: {
        textAlign: 'center',
        color: '#666',
        marginTop: 20
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 20
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        borderRadius: 5,
        marginBottom: 15
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10
    }
});
