import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    investments: [],
    isLoading: false,
    error: null,
};

export const investmentsSlice = createSlice({
    name: 'investments',
    initialState,
    reducers: {
        setInvestments: (state, action) => {
            state.investments = action.payload;
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

export const { setInvestments, setLoading, setError } = investmentsSlice.actions;

export default investmentsSlice.reducer;
