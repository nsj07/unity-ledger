import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    transactions: [],
    isLoading: false,
    error: null,
};

export const transactionsSlice = createSlice({
    name: 'transactions',
    initialState,
    reducers: {
        setTransactions: (state, action) => {
            // Map Firestore timestamps to serializable format (milliseconds)
            state.transactions = action.payload.map(tx => ({
                ...tx,
                created_at: tx.created_at?.toMillis ? tx.created_at.toMillis() : Date.now()
            }));
            state.error = null;
        },
        setLoading: (state, action) => {
            state.isLoading = action.payload;
        },
        setError: (state, action) => {
            state.error = action.payload;
            state.isLoading = false;
        }
    },
});

export const { setTransactions, setLoading, setError } = transactionsSlice.actions;

export default transactionsSlice.reducer;
