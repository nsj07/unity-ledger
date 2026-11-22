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
            // Preserve already-serialized numeric timestamps and convert Firestore Timestamps
            state.transactions = action.payload.map(tx => {
                const createdAt = typeof tx.created_at === 'number'
                    ? tx.created_at
                    : (tx.created_at?.toMillis ? tx.created_at.toMillis() : Date.now());
                const txDate = typeof tx.transaction_date === 'number'
                    ? tx.transaction_date
                    : (tx.transaction_date?.toMillis ? tx.transaction_date.toMillis() : createdAt);
                return {
                    ...tx,
                    created_at: createdAt,
                    transaction_date: txDate,
                };
            });
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
