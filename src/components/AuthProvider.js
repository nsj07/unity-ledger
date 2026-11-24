import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { AuthService } from '../services/AuthService';
import { HouseholdService } from '../services/HouseholdService';
import { setUser, setHouseholdContext, clearAuth, setLoading } from '../store/authSlice';

export const AuthProvider = ({ children }) => {
    const dispatch = useDispatch();

    useEffect(() => {
        // Listen for Firebase Auth state changes
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            dispatch(setLoading(true));

            try {
                if (firebaseUser) {
                    // Enforce allowlist before hydrating any app state
                    const isAllowed = await AuthService.isEmailAllowed(firebaseUser.email);
                    if (!isAllowed) {
                        console.warn('[AUTH_PROVIDER]: Access denied for non-allowlisted email:', firebaseUser.email);
                        await AuthService.logoutUser();
                        dispatch(clearAuth());
                        return;
                    }

                    // User logged in (initial Auth snapshot; displayName may still be updating during email/password signup)
                    dispatch(setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName,
                    }));

                    // Ensure user profile exists in Firestore (handles accounts created before rules were published)
                    let profile = await AuthService.checkUserHousehold(firebaseUser.uid);
                    if (!profile || (!profile.userData && !profile.error)) {
                        await AuthService.ensureUserProfile(firebaseUser);
                        profile = await AuthService.checkUserHousehold(firebaseUser.uid);
                    } else if (profile.error === "User profile not found.") {
                        await AuthService.ensureUserProfile(firebaseUser);
                        profile = await AuthService.checkUserHousehold(firebaseUser.uid);
                    }

                    // Reconcile displayName from Firestore profile in case updateProfile() finished after onAuthStateChanged
                    const resolvedDisplayName =
                        firebaseUser.displayName ||
                        profile?.userData?.display_name ||
                        firebaseUser.email?.split('@')[0] ||
                        'User';

                    dispatch(setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: resolvedDisplayName,
                    }));

                    // 1. Find the user's household with the most recent activity (latest transaction, join, or creation)
                    let resolvedHousehold = null;
                    const { household: mostRecentHh } = await HouseholdService.getMostRecentUserHousehold(firebaseUser.uid);
                    if (mostRecentHh) {
                        resolvedHousehold = mostRecentHh;
                    } else if (profile && profile.householdId) {
                        // Fallback for legacy households that may not have `memberIds` array yet
                        try {
                            const hhDoc = await getDoc(doc(db, 'households', profile.householdId));
                            if (hhDoc.exists()) {
                                const hhData = hhDoc.data();
                                const isMember =
                                    (Array.isArray(hhData.memberIds) && hhData.memberIds.includes(firebaseUser.uid)) ||
                                    (hhData.members && Object.prototype.hasOwnProperty.call(hhData.members, firebaseUser.uid));

                                if (isMember) {
                                    const memberEntry = hhData.members?.[firebaseUser.uid];
                                    const memberRole = memberEntry?.role || 'member';
                                    const memberAccess =
                                        memberRole === 'leader' || memberRole === 'co-leader'
                                            ? 'read-write'
                                            : (memberEntry?.access || 'read-write');

                                    resolvedHousehold = {
                                        id: profile.householdId,
                                        name: hhData.name || profile.userData?.household_name || 'Household',
                                        role: memberRole,
                                        access: memberAccess,
                                    };
                                }
                            }
                        } catch (hhError) {
                            console.error('[AUTH_PROVIDER]: Failed to verify legacy household:', hhError);
                        }
                    }

                    if (resolvedHousehold) {
                        dispatch(setHouseholdContext({
                            householdId: resolvedHousehold.id,
                            householdName: resolvedHousehold.name,
                            householdRole: resolvedHousehold.role,
                            householdAccess: resolvedHousehold.access,
                        }));

                        // Keep users/{uid}.household_id synced with the selected most-recent household
                        if (profile?.householdId !== resolvedHousehold.id) {
                            await HouseholdService.switchActiveHousehold(firebaseUser.uid, resolvedHousehold.id);
                        }
                    } else if (profile && profile.householdId) {
                        // Linked household no longer exists or user is no longer a member — clear stale link
                        console.warn('[AUTH_PROVIDER]: Clearing stale household link:', profile.householdId);
                        await setDoc(doc(db, 'users', firebaseUser.uid), {
                            id: firebaseUser.uid,
                            email: (profile.userData?.email || firebaseUser.email || '').trim(),
                            display_name: resolvedDisplayName.trim(),
                            household_id: null,
                        });
                    }
                } else {
                    // User logged out
                    dispatch(clearAuth());
                }
            } finally {
                dispatch(setLoading(false));
            }
        });

        return () => unsubscribe();
    }, [dispatch]);

    return <>{children}</>;
};
