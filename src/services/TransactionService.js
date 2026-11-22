import { collection, doc, getDocs, orderBy, query, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';

function applyDelta(deltaMap, accountId, delta) {
    if (!accountId || !delta) return;
    deltaMap[accountId] = (deltaMap[accountId] || 0) + delta;
}

function getBalanceImpacts(txn) {
    const amount = Number(txn.amount) || 0;
    const impacts = [];
    if (txn.type === 'Expense') {
        impacts.push({ accountId: txn.account_id, delta: -amount });
    } else if (txn.type === 'Income') {
        impacts.push({ accountId: txn.account_id, delta: amount });
    } else if (txn.type === 'Transfer') {
        impacts.push({ accountId: txn.account_id, delta: -amount });
        if (txn.to_account_id) {
            impacts.push({ accountId: txn.to_account_id, delta: amount });
        }
    }
    return impacts;
}

export const TransactionService = {
    // Get all transactions for a specific household
    getTransactions: async (householdId) => {
        try {
            const q = query(
                collection(db, 'households', householdId, 'transactions'),
                orderBy('created_at', 'desc')
            );
            const snapshot = await getDocs(q);
            const transactions = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
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

                // 3. Commit Updates
                transaction.update(accountRef, { balance: newBalance });
                const payload = {
                    type: transactionData.type,
                    amount: transactionData.amount,
                    account_id: transactionData.account_id,
                    to_account_id: transactionData.type === 'Transfer' ? transactionData.to_account_id : null,
                    category_id: transactionData.category_id || null,
                    subcategory_name: transactionData.subcategory_name || null,
                    added_by: transactionData.added_by,
                    created_at: new Date(),
                };
                if (transactionData.note && String(transactionData.note).trim().length > 0) {
                    payload.note = String(transactionData.note).trim();
                } else {
                    payload.note = null;
                }
                if (transactionData.transaction_date instanceof Date) {
                    payload.transaction_date = transactionData.transaction_date;
                } else {
                    payload.transaction_date = payload.created_at;
                }
                transaction.set(newTransactionRef, payload);
            });

            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Edit an existing transaction and atomically reconcile all affected account balances
    updateTransaction: async (householdId, transactionId, updatedData) => {
        try {
            await runTransaction(db, async (transaction) => {
                const txnRef = doc(db, 'households', householdId, 'transactions', transactionId);
                const txnDoc = await transaction.get(txnRef);
                if (!txnDoc.exists()) throw new Error('Transaction no longer exists.');

                const oldTxn = txnDoc.data();

                // Collect all unique account IDs touched by old or new transaction
                const accountIds = new Set();
                if (oldTxn.account_id) accountIds.add(oldTxn.account_id);
                if (oldTxn.type === 'Transfer' && oldTxn.to_account_id) accountIds.add(oldTxn.to_account_id);
                if (updatedData.account_id) accountIds.add(updatedData.account_id);
                if (updatedData.type === 'Transfer' && updatedData.to_account_id) accountIds.add(updatedData.to_account_id);

                // Read all involved accounts BEFORE any writes
                const accountDocs = {};
                for (const accId of accountIds) {
                    const accRef = doc(db, 'households', householdId, 'accounts', accId);
                    const accSnap = await transaction.get(accRef);
                    accountDocs[accId] = { ref: accRef, snap: accSnap };
                }

                // Validate destination/source accounts for the updated transaction exist
                if (!accountDocs[updatedData.account_id]?.snap.exists()) {
                    throw new Error('Selected source account does not exist.');
                }
                if (updatedData.type === 'Transfer' && !accountDocs[updatedData.to_account_id]?.snap.exists()) {
                    throw new Error('Selected destination account does not exist.');
                }

                // Compute net balance deltas: reverse old impacts, apply new impacts
                const deltas = {};
                for (const impact of getBalanceImpacts(oldTxn)) {
                    applyDelta(deltas, impact.accountId, -impact.delta);
                }
                for (const impact of getBalanceImpacts(updatedData)) {
                    applyDelta(deltas, impact.accountId, impact.delta);
                }

                // Commit account balance adjustments
                for (const [accId, delta] of Object.entries(deltas)) {
                    if (delta === 0) continue;
                    const entry = accountDocs[accId];
                    if (entry && entry.snap.exists()) {
                        const currentBalance = entry.snap.data().balance || 0;
                        transaction.update(entry.ref, { balance: currentBalance + delta });
                    }
                }

                // Commit transaction update (preserving immutable added_by and created_at)
                const updateFields = {
                    type: updatedData.type,
                    amount: updatedData.amount,
                    account_id: updatedData.account_id,
                    to_account_id: updatedData.type === 'Transfer' ? updatedData.to_account_id : null,
                    category_id: updatedData.category_id || null,
                    subcategory_name: updatedData.subcategory_name || null,
                    note: updatedData.note && String(updatedData.note).trim().length > 0
                        ? String(updatedData.note).trim()
                        : null,
                };
                if (updatedData.transaction_date instanceof Date) {
                    updateFields.transaction_date = updatedData.transaction_date;
                }
                transaction.update(txnRef, updateFields);
            });

            return { success: true, error: null };
        } catch (error) {
            console.error('UPDATE_TRANSACTION_ERROR:', error);
            if (error?.code === 'permission-denied') {
                return { success: false, error: 'You do not have permission to edit transactions.' };
            }
            return { success: false, error: error.message };
        }
    },

    // Delete a transaction and atomically reverse its balance impact on affected account(s)
    deleteTransaction: async (householdId, transactionId) => {
        try {
            await runTransaction(db, async (transaction) => {
                const txnRef = doc(db, 'households', householdId, 'transactions', transactionId);
                const txnDoc = await transaction.get(txnRef);
                if (!txnDoc.exists()) throw new Error('Transaction no longer exists.');

                const oldTxn = txnDoc.data();
                const impacts = getBalanceImpacts(oldTxn);

                // Read affected accounts before writes
                const accountReads = [];
                for (const impact of impacts) {
                    const accRef = doc(db, 'households', householdId, 'accounts', impact.accountId);
                    const accSnap = await transaction.get(accRef);
                    accountReads.push({ ref: accRef, snap: accSnap, reverseDelta: -impact.delta });
                }

                // Reverse balance impacts on existing accounts
                for (const item of accountReads) {
                    if (item.snap.exists()) {
                        const currentBalance = item.snap.data().balance || 0;
                        transaction.update(item.ref, { balance: currentBalance + item.reverseDelta });
                    }
                }

                // Delete the transaction document
                transaction.delete(txnRef);
            });

            return { success: true, error: null };
        } catch (error) {
            console.error('DELETE_TRANSACTION_ERROR:', error);
            if (error?.code === 'permission-denied') {
                return { success: false, error: 'You do not have permission to delete transactions.' };
            }
            return { success: false, error: error.message };
        }
    },
};
