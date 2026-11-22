import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, FlatList, Button, TextInput, Alert, Modal, TouchableOpacity } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { InvestmentService } from '../../src/services/InvestmentService';
import { setInvestments, setLoading, setError } from '../../src/store/investmentsSlice';

export default function InvestmentsScreen() {
    const { householdId } = useSelector((state: any) => state.auth);
    const { investments, isLoading } = useSelector((state: any) => state.investments);
    const dispatch = useDispatch();

    const [modalVisible, setModalVisible] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPrincipal, setNewPrincipal] = useState('');

    useEffect(() => {
        if (householdId) {
            loadInvestments();
        }
    }, [householdId]);

    const loadInvestments = async () => {
        dispatch(setLoading(true));
        const response = await InvestmentService.getInvestments(householdId);
        dispatch(setLoading(false));

        if (response.error) {
            dispatch(setError(response.error));
            Alert.alert("Error Loading", response.error);
        } else {
            dispatch(setInvestments(response.investments));
        }
    };

    const handleCreateInvestment = async () => {
        if (!newName || !newPrincipal) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        const payload = {
            name: newName,
            principal: parseFloat(newPrincipal) || 0,
            realized_profit_loss: 0 // Starts at 0, updated by transfers
        };

        const response = await InvestmentService.createInvestment(householdId, payload);
        if (response.error) {
            Alert.alert("Error", response.error);
        } else {
            setModalVisible(false);
            setNewName('');
            setNewPrincipal('');
            loadInvestments();
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <View style={styles.metrics}>
                <Text style={styles.principal}>Principal: {item.principal}</Text>
                <Text style={{
                    fontSize: 16,
                    fontWeight: 'bold',
                    color: item.realized_profit_loss >= 0 ? '#4CAF50' : '#e53935'
                }}>
                    P/L: {item.realized_profit_loss > 0 ? '+' : ''}{item.realized_profit_loss}
                </Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Wealth & Investments</Text>
            <Button title="Add Investment" onPress={() => setModalVisible(true)} />

            {isLoading ? (
                <Text style={styles.loading}>Loading investments...</Text>
            ) : (
                <FlatList
                    data={investments}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingVertical: 20 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No investments found.</Text>}
                />
            )}

            {/* Add Investment Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Investment</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Name (e.g. Mutual Fund XYZ)"
                            value={newName}
                            onChangeText={setNewName}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Initial Principal"
                            value={newPrincipal}
                            onChangeText={setNewPrincipal}
                            keyboardType="numeric"
                        />

                        <View style={styles.buttonRow}>
                            <Button title="Cancel" color="red" onPress={() => setModalVisible(false)} />
                            <Button title="Save" onPress={handleCreateInvestment} />
                        </View>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 15 },
    card: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 10, elevation: 2 },
    cardTitle: { fontSize: 18, fontWeight: '600' },
    metrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    principal: { fontSize: 16, color: '#333' },
    loading: { marginTop: 20, textAlign: 'center' },
    emptyText: { textAlign: 'center', color: '#666', marginTop: 20 },
    modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
    modalContent: { backgroundColor: 'white', padding: 20, borderRadius: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, marginBottom: 15 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }
});
