import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const InvestmentService = {
    // Get all investments for a specific household
    getInvestments: async (householdId) => {
        try {
            const investmentsRef = collection(db, 'households', householdId, 'investments');
            const snapshot = await getDocs(investmentsRef);
            const investments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return { investments, error: null };
        } catch (error) {
            return { investments: [], error: error.message };
        }
    },

    // Log a new investment entry
    createInvestment: async (householdId, investmentData) => {
        try {
            const investmentsRef = collection(db, 'households', householdId, 'investments');
            // investmentData: { name, principal, realized_profit_loss }
            const docRef = await addDoc(investmentsRef, investmentData);
            return { id: docRef.id, ...investmentData, error: null };
        } catch (error) {
            return { error: error.message };
        }
    },

    // Update an existing investment (e.g. adding more principal or booking profit)
    updateInvestment: async (householdId, investmentId, investmentData) => {
        try {
            const investmentRef = doc(db, 'households', householdId, 'investments', investmentId);
            await updateDoc(investmentRef, investmentData);
            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Delete a record entirely
    deleteInvestment: async (householdId, investmentId) => {
        try {
            const investmentRef = doc(db, 'households', householdId, 'investments', investmentId);
            await deleteDoc(investmentRef);
            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};
