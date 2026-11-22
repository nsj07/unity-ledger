import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const CategoryService = {
    // Get all categories for a specific household
    getCategories: async (householdId) => {
        try {
            const categoriesRef = collection(db, 'households', householdId, 'categories');
            const snapshot = await getDocs(categoriesRef);
            const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return { categories, error: null };
        } catch (error) {
            return { categories: [], error: error.message };
        }
    },

    // Add a new Category
    createCategory: async (householdId, categoryData) => {
        try {
            const categoriesRef = collection(db, 'households', householdId, 'categories');
            // categoryData should contian { name, type, subcategories: [] }
            const docRef = await addDoc(categoriesRef, categoryData);
            return { id: docRef.id, ...categoryData, error: null };
        } catch (error) {
            return { error: error.message };
        }
    },

    // Update a Category (Rename or Add/Remove Subcategories)
    updateCategory: async (householdId, categoryId, categoryData) => {
        try {
            const categoryRef = doc(db, 'households', householdId, 'categories', categoryId);
            await updateDoc(categoryRef, categoryData);
            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Delete a Category
    deleteCategory: async (householdId, categoryId) => {
        try {
            const categoryRef = doc(db, 'households', householdId, 'categories', categoryId);
            await deleteDoc(categoryRef);
            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};
