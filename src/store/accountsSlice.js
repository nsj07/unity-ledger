import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    accounts: [], // Array of account objects from Firestore
    isLoading: false,
    error: null,
};

export const accountsSlice = createSlice({
    name: 'accounts',
    initialState,
    reducers: {
        setAccounts: (state, action) => {
            state.accounts = action.payload;
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

export const { setAccounts, setLoading, setError } = accountsSlice.actions;

export default accountsSlice.reducer;
