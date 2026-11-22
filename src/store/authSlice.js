import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    user: null,             // Firebase Auth user representation
    householdId: null,      // ID of the active household
    householdName: null,    // Name of the active household
    householdRole: null,    // User's role ('leader' | 'co-leader' | 'member') in the active household
    householdAccess: 'read-write', // User's access ('read-write' | 'read-only') in the active household
    householdMembers: [],   // Array of { uid, displayName, role, access }
    isLoading: true,        // True when initial auth state is being assessed
};

export const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setUser: (state, action) => {
            // action.payload contains the user data { uid, email, displayName }
            state.user = action.payload;
        },
        setHouseholdContext: (state, action) => {
            // action.payload contains { householdId, householdName, householdRole, householdAccess? }
            state.householdId = action.payload.householdId;
            state.householdName = action.payload.householdName;
            state.householdRole = action.payload.householdRole;
            state.householdAccess =
                action.payload.householdRole === 'leader' || action.payload.householdRole === 'co-leader'
                    ? 'read-write'
                    : (action.payload.householdAccess || 'read-write');
        },
        setHouseholdMembers: (state, action) => {
            state.householdMembers = action.payload || [];
        },
        clearAuth: (state) => {
            state.user = null;
            state.householdId = null;
            state.householdName = null;
            state.householdRole = null;
            state.householdAccess = 'read-write';
            state.householdMembers = [];
            state.isLoading = false;
        },
        setLoading: (state, action) => {
            state.isLoading = action.payload;
        }
    },
});

export const { setUser, setHouseholdContext, setHouseholdMembers, clearAuth, setLoading } = authSlice.actions;

export default authSlice.reducer;
