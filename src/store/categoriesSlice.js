import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    categories: [],
    isLoading: false,
    error: null,
};

export const categoriesSlice = createSlice({
    name: 'categories',
    initialState,
    reducers: {
        setCategories: (state, action) => {
            state.categories = action.payload;
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

export const { setCategories, setLoading, setError } = categoriesSlice.actions;

export default categoriesSlice.reducer;
