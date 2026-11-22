import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from '../constants/defaultHouseholdData';

export const HouseholdService = {
    // Seed default accounts and categories for a newly created household
    seedDefaultHouseholdData: async (householdId) => {
        try {
            const batch = writeBatch(db);

            const accountsCol = collection(db, 'households', householdId, 'accounts');
            DEFAULT_ACCOUNTS.forEach((acc) => {
                const newAccRef = doc(accountsCol);
                batch.set(newAccRef, {
                    name: acc.name,
                    type: acc.type,
                    balance: acc.balance,
                });
            });

            const categoriesCol = collection(db, 'households', householdId, 'categories');
            DEFAULT_CATEGORIES.forEach((cat) => {
                const newCatRef = doc(categoriesCol);
                batch.set(newCatRef, {
                    name: cat.name,
                    type: cat.type,
                    subcategories: cat.subcategories,
                });
            });

            await batch.commit();
            return { success: true, error: null };
        } catch (error) {
            console.error('SEED_DEFAULT_HOUSEHOLD_DATA_ERROR:', error);
            return { success: false, error: error.message };
        }
    },

    // Create a new household where the creator is the primary leader
    createHousehold: async (userId, householdName, currency = "INR", creatorDisplayName = "Leader") => {
        try {
            const generatedHouseholdId = `hh_${Date.now()}_${userId.substring(0, 5)}`;
            const householdRef = doc(db, 'households', generatedHouseholdId);
            const cleanDisplayName = (creatorDisplayName || 'Leader').trim().slice(0, 100);

            const payload = {
                id: generatedHouseholdId,
                name: householdName,
                currency_default: currency,
                members: {
                    [userId]: {
                        role: 'leader',
                        access: 'read-write',
                        display_name: cleanDisplayName,
                    }
                },
                memberIds: [userId],
                created_at: new Date()
            };

            await setDoc(householdRef, payload);

            // Auto-seed default accounts and categories so the household is ready to use immediately
            await HouseholdService.seedDefaultHouseholdData(generatedHouseholdId);

            // Link the generic user profile to this new household
            const userDocRef = doc(db, 'users', userId);
            await setDoc(userDocRef, {
                household_id: generatedHouseholdId
            }, { merge: true });

            return { householdId: generatedHouseholdId, role: 'leader', access: 'read-write', error: null };
        } catch (error) {
            console.error("CREATE_HOUSEHOLD_ERROR:", error);
            return { householdId: null, error: error.message };
        }
    },

    // Join a household (e.g., invited by Spouse)
    joinHousehold: async (userId, householdId) => {
        try {
            const householdRef = doc(db, 'households', householdId);
            const householdDoc = await getDoc(householdRef);

            if (!householdDoc.exists()) {
                return { success: false, error: 'Household does not exist.' };
            }

            const data = householdDoc.data();
            const updatedMembers = { ...data.members, [userId]: { role: 'member' } };
            const updatedMemberIds = data.memberIds ? [...new Set([...data.memberIds, userId])] : [userId];

            await updateDoc(householdRef, {
                members: updatedMembers,
                memberIds: updatedMemberIds
            });

            const userDocRef = doc(db, 'users', userId);
            await setDoc(userDocRef, { household_id: householdId }, { merge: true });

            return { success: true, role: 'member', error: null };
        } catch (error) {
            console.error("JOIN_HOUSEHOLD_ERROR:", error);
            return { success: false, error: error.message };
        }
    },

    // Fetch all households a user belongs to
    getUserHouseholds: async (userId) => {
        try {
            const householdsRef = collection(db, 'households');
            const q = query(householdsRef, where('memberIds', 'array-contains', userId));
            const querySnapshot = await getDocs(q);

            const households = [];
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const memberEntry = data.members?.[userId];
                const role = memberEntry?.role || 'member';
                const access =
                    role === 'leader' || role === 'co-leader'
                        ? 'read-write'
                        : (memberEntry?.access || 'read-write');
                const createdAtMs = data.created_at?.toMillis
                    ? data.created_at.toMillis()
                    : (data.created_at ? new Date(data.created_at).getTime() : 0);

                households.push({
                    id: data.id || docSnap.id,
                    name: data.name || 'Household',
                    role,
                    access,
                    createdAtMs: Number.isNaN(createdAtMs) ? 0 : createdAtMs,
                    inviteCode: memberEntry?.invite_code || null,
                });
            });

            return { households, error: null };
        } catch (error) {
            console.error("GET_USER_HOUSEHOLDS_ERROR:", error);
            return { households: [], error: error.message };
        }
    },

    // Pick the single household a user belongs to, or when in multiple households,
    // the one with the most recent activity (latest transaction, invite join time, or creation time).
    getMostRecentUserHousehold: async (userId) => {
        try {
            const { households, error } = await HouseholdService.getUserHouseholds(userId);
            if (error || households.length === 0) {
                return { household: null, error };
            }
            if (households.length === 1) {
                return { household: households[0], error: null };
            }

            const scored = await Promise.all(
                households.map(async (hh) => {
                    let latestTxnMs = 0;
                    let joinedAtMs = 0;

                    try {
                        const txnQuery = query(
                            collection(db, 'households', hh.id, 'transactions'),
                            orderBy('created_at', 'desc'),
                            limit(1)
                        );
                        const txnSnap = await getDocs(txnQuery);
                        if (!txnSnap.empty) {
                            const txnData = txnSnap.docs[0].data();
                            const ts = txnData.created_at?.toMillis
                                ? txnData.created_at.toMillis()
                                : (txnData.created_at ? new Date(txnData.created_at).getTime() : 0);
                            if (!Number.isNaN(ts)) latestTxnMs = ts;
                        }
                    } catch {
                        // Ignore individual subcollection read errors when scoring
                    }

                    if (hh.inviteCode) {
                        try {
                            const inviteSnap = await getDoc(doc(db, 'invitations', hh.inviteCode));
                            if (inviteSnap.exists()) {
                                const inviteData = inviteSnap.data();
                                const usedMs = inviteData.used_at?.toMillis
                                    ? inviteData.used_at.toMillis()
                                    : (inviteData.used_at ? new Date(inviteData.used_at).getTime() : 0);
                                if (!Number.isNaN(usedMs)) joinedAtMs = usedMs;
                            }
                        } catch {
                            // Ignore invite lookup errors when scoring
                        }
                    }

                    const lastActivityMs = Math.max(latestTxnMs, joinedAtMs, hh.createdAtMs || 0);
                    return { ...hh, lastActivityMs };
                })
            );

            scored.sort((a, b) => b.lastActivityMs - a.lastActivityMs);
            return { household: scored[0], error: null };
        } catch (error) {
            console.error('GET_MOST_RECENT_HOUSEHOLD_ERROR:', error);
            return { household: null, error: error.message };
        }
    },

    // Update the active household in the user's profile
    switchActiveHousehold: async (userId, householdId) => {
        try {
            const userDocRef = doc(db, 'users', userId);
            await setDoc(userDocRef, { household_id: householdId }, { merge: true });
            return { success: true, error: null };
        } catch (error) {
            console.error("SWITCH_ACTIVE_HOUSEHOLD_ERROR:", error);
            return { success: false, error: error.message };
        }
    },

    // Update a non-leader member's role ('member' | 'co-leader') and access ('read-write' | 'read-only')
    updateMemberPermissions: async (householdId, targetUserId, { role, access }) => {
        try {
            if (!householdId || !targetUserId) {
                return { success: false, error: 'Missing household or member ID.' };
            }
            const validRole = role === 'co-leader' ? 'co-leader' : 'member';
            const validAccess = validRole === 'co-leader'
                ? 'read-write'
                : (access === 'read-only' ? 'read-only' : 'read-write');

            const householdRef = doc(db, 'households', householdId);
            const householdSnap = await getDoc(householdRef);
            if (!householdSnap.exists()) {
                return { success: false, error: 'Household not found.' };
            }

            const data = householdSnap.data();
            const existingEntry = data.members?.[targetUserId];
            if (!existingEntry) {
                return { success: false, error: 'Member not found in this household.' };
            }
            if (existingEntry.role === 'leader') {
                return { success: false, error: 'The primary household leader cannot be modified.' };
            }

            const updatedEntry = {
                ...existingEntry,
                role: validRole,
                access: validAccess,
            };

            await updateDoc(householdRef, {
                [`members.${targetUserId}`]: updatedEntry,
                last_updated_member_uid: targetUserId,
            });

            return { success: true, error: null };
        } catch (error) {
            console.error('UPDATE_MEMBER_PERMISSIONS_ERROR:', error);
            if (error?.code === 'permission-denied') {
                return { success: false, error: 'Only leaders and co-leaders can manage member permissions.' };
            }
            return { success: false, error: error.message };
        }
    },

    // Backfill the signed-in user's display_name in household.members if missing (for legacy households)
    syncOwnDisplayName: async (householdId, userId, displayName) => {
        try {
            const cleanName = (displayName || '').trim().slice(0, 100);
            if (!householdId || !userId || !cleanName) return { success: false };

            const householdRef = doc(db, 'households', householdId);
            await updateDoc(householdRef, {
                [`members.${userId}.display_name`]: cleanName,
            });
            return { success: true };
        } catch (error) {
            console.warn('SYNC_OWN_DISPLAY_NAME_WARN:', error?.message);
            return { success: false };
        }
    },
};
