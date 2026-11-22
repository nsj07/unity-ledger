import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const AccountService = {
    // Get all accounts for a specific household
    getAccounts: async (householdId) => {
        try {
            const accountsRef = collection(db, 'households', householdId, 'accounts');
            const snapshot = await getDocs(accountsRef);
            const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return { accounts, error: null };
        } catch (error) {
            return { accounts: [], error: error.message };
        }
    },

    // Create a new account
    createAccount: async (householdId, accountData) => {
        try {
            const accountsRef = collection(db, 'households', householdId, 'accounts');
            // accountData should contain { name, type, balance }
            const docRef = await addDoc(accountsRef, accountData);
            return { id: docRef.id, ...accountData, error: null };
        } catch (error) {
            return { error: error.message };
        }
    },

    // Update an existing account
    updateAccount: async (householdId, accountId, accountData) => {
        try {
            const accountRef = doc(db, 'households', householdId, 'accounts', accountId);
            await updateDoc(accountRef, accountData);
            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Delete an existing account
    deleteAccount: async (householdId, accountId) => {
        try {
            const accountRef = doc(db, 'households', householdId, 'accounts', accountId);
            await deleteDoc(accountRef);
            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};
