import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { AuthService } from '../services/AuthService';
import { setUser, setHouseholdContext, clearAuth, setLoading } from '../store/authSlice';

export const AuthProvider = ({ children }) => {
    const dispatch = useDispatch();

    useEffect(() => {
        // Listen for Firebase Auth state changes
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            dispatch(setLoading(true));

            if (firebaseUser) {
                // User logged in
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

                if (profile && profile.householdId) {
                    try {
                        const hhDoc = await getDoc(doc(db, 'households', profile.householdId));
                        if (hhDoc.exists()) {
                            const hhData = hhDoc.data();
                            const isMember =
                                (Array.isArray(hhData.memberIds) && hhData.memberIds.includes(firebaseUser.uid)) ||
                                (hhData.members && Object.prototype.hasOwnProperty.call(hhData.members, firebaseUser.uid));

                            if (isMember) {
                                dispatch(setHouseholdContext({
                                    householdId: profile.householdId,
                                    householdName: hhData.name || profile.userData?.household_name || "Household",
                                    householdRole: hhData.members?.[firebaseUser.uid]?.role || 'member'
                                }));
                            } else {
                                console.warn('[AUTH_PROVIDER]: User is not a member of household, clearing stale link:', profile.householdId);
                                await setDoc(doc(db, 'users', firebaseUser.uid), {
                                    id: firebaseUser.uid,
                                    email: (profile.userData?.email || firebaseUser.email || '').trim(),
                                    display_name: (profile.userData?.display_name || firebaseUser.displayName || 'User').trim(),
                                    household_id: null,
                                });
                            }
                        } else {
                            console.warn('[AUTH_PROVIDER]: Linked household no longer exists, clearing stale link:', profile.householdId);
                            await setDoc(doc(db, 'users', firebaseUser.uid), {
                                id: firebaseUser.uid,
                                email: (profile.userData?.email || firebaseUser.email || '').trim(),
                                display_name: (profile.userData?.display_name || firebaseUser.displayName || 'User').trim(),
                                household_id: null,
                            });
                        }
                    } catch (hhError) {
                        console.error('[AUTH_PROVIDER]: Failed to verify household:', hhError);
                    }
                }
            } else {
                // User logged out
                dispatch(clearAuth());
            }

            dispatch(setLoading(false));
        });

        return () => unsubscribe();
    }, [dispatch]);

    return <>{children}</>;
};
