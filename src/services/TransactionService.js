import { collection, doc, addDoc, getDocs, runTransaction, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

export const TransactionService = {
    // Get all transactions for a specific household
    getTransactions: async (householdId) => {
        try {
            const q = query(
                collection(db, 'households', householdId, 'transactions'),
                orderBy('created_at', 'desc')
            );
            const snapshot = await getDocs(q);
            const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return { transactions, error: null };
        } catch (error) {
            return { transactions: [], error: error.message };
        }
    },

    // Add a transaction and update respective account balances
    createTransaction: async (householdId, transactionData) => {
        // transactionData: { type, amount, category_id, subcategory_name, account_id, to_account_id, added_by }
        try {
            await runTransaction(db, async (transaction) => {
                // 1. Prepare Document References
                const newTransactionRef = doc(collection(db, 'households', householdId, 'transactions'));

                const accountRef = doc(db, 'households', householdId, 'accounts', transactionData.account_id);
                const accountDoc = await transaction.get(accountRef);
                if (!accountDoc.exists()) throw new Error("Source account does not exist!");

                let toAccountRef, toAccountDoc;
                if (transactionData.type === 'Transfer' && transactionData.to_account_id) {
                    toAccountRef = doc(db, 'households', householdId, 'accounts', transactionData.to_account_id);
                    toAccountDoc = await transaction.get(toAccountRef);
                    if (!toAccountDoc.exists()) throw new Error("Destination account does not exist!");
                }

                // 2. Perform Account Balance Calculations
                const currentBalance = accountDoc.data().balance || 0;
                let newBalance = currentBalance;

                if (transactionData.type === 'Expense') {
                    newBalance -= transactionData.amount;
                } else if (transactionData.type === 'Income') {
                    newBalance += transactionData.amount;
                } else if (transactionData.type === 'Transfer') {
                    newBalance -= transactionData.amount; // Deduct from source

                    // Add to destination
                    const currentToBalance = toAccountDoc.data().balance || 0;
                    transaction.update(toAccountRef, { balance: currentToBalance + transactionData.amount });
                }

                // Investment logic is mostly a transfer to an "Investment" account container type in the basic workflow

                // 3. Commit Updates
                transaction.update(accountRef, { balance: newBalance });
                transaction.set(newTransactionRef, {
                    ...transactionData,
                    created_at: new Date()
                });
            });

            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};
