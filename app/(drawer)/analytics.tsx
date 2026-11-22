import React, { useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import { PieChart } from 'react-native-gifted-charts';

export default function AnalyticsScreen() {
    const { transactions } = useSelector((state: any) => state.transactions);

    // Calculate expenses by category
    const expenseData = useMemo(() => {
        const expenses = transactions.filter((t: any) => t.type === 'Expense');
        const grouped: any = {};

        expenses.forEach((t: any) => {
            const cat = t.category_id || 'Uncategorized';
            grouped[cat] = (grouped[cat] || 0) + t.amount;
        });

        const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

        return Object.keys(grouped).map((key, index) => ({
            value: grouped[key],
            text: key,
            color: colors[index % colors.length]
        }));
    }, [transactions]);

    const totalExpense = expenseData.reduce((sum, item) => sum + item.value, 0);

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>Analytics Dashboard</Text>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Expenses by Category</Text>
                {expenseData.length > 0 ? (
                    <View style={styles.chartContainer}>
                        <PieChart
                            data={expenseData}
                            donut
                            showText
                            textColor="white"
                            radius={120}
                            innerRadius={70}
                            centerLabelComponent={() => {
                                return (
                                    <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 22, color: 'black', fontWeight: 'bold' }}>{totalExpense}</Text>
                                        <Text style={{ fontSize: 14, color: 'black' }}>Total</Text>
                                    </View>
                                );
                            }}
                        />
                        <View style={styles.legendContainer}>
                            {expenseData.map((item, index) => (
                                <View key={index} style={styles.legendItem}>
                                    <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                                    <Text style={styles.legendText}>{item.text} ({item.value})</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    <Text style={styles.emptyText}>Not enough data to generate charts yet.</Text>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    card: { backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 2, marginBottom: 20 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    chartContainer: { alignItems: 'center' },
    legendContainer: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', margin: 5, width: '45%' },
    legendColor: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
    legendText: { fontSize: 12, color: '#333' },
    emptyText: { textAlign: 'center', color: '#666', marginVertical: 40 }
});
