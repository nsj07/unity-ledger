import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import accountsReducer from './accountsSlice';
import categoriesReducer from './categoriesSlice';
import transactionsReducer from './transactionsSlice';
import investmentsReducer from './investmentsSlice';

// We'll import reducers here as we build them, e.g. for user context, themes, etc.

export const store = configureStore({
    reducer: {
        auth: authReducer,
        accounts: accountsReducer,
        categories: categoriesReducer,
        transactions: transactionsReducer,
        investments: investmentsReducer,
    },
    // Adding middleware here if needed
});

export default store;
