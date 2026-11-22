import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    user: null,         // Firebase Auth user representation
    householdId: null,  // ID of the active household
    householdName: null, // Name of the active household
    householdRole: null, // User's role (e.g., 'leader' or 'member') in the active household
    isLoading: true,    // True when initial auth state is being assessed
};

export const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setUser: (state, action) => {
            // action.payload contains the user data { id, email, display_name }
            state.user = action.payload;
            state.isLoading = false;
        },
        setHouseholdContext: (state, action) => {
            // action.payload contains { householdId, householdName, householdRole }
            state.householdId = action.payload.householdId;
            state.householdName = action.payload.householdName;
            state.householdRole = action.payload.householdRole;
        },
        clearAuth: (state) => {
            state.user = null;
            state.householdId = null;
            state.householdName = null;
            state.householdRole = null;
            state.isLoading = false;
        },
        setLoading: (state, action) => {
            state.isLoading = action.payload;
        }
    },
});

export const { setUser, setHouseholdContext, clearAuth, setLoading } = authSlice.actions;

export default authSlice.reducer;
