import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const HouseholdService = {
    // Create a new household where the creator is the primary leader
    createHousehold: async (userId, householdName, currency = "INR") => {
        try {
            const generatedHouseholdId = `hh_${Date.now()}_${userId.substring(0, 5)}`;
            const householdRef = doc(db, 'households', generatedHouseholdId);

            const payload = {
                id: generatedHouseholdId,
                name: householdName,
                currency_default: currency,
                members: {
                    [userId]: { role: 'leader' }
                },
                memberIds: [userId],
                created_at: new Date()
            };

            await setDoc(householdRef, payload);

            // Link the generic user profile to this new household
            const userDocRef = doc(db, 'users', userId);
            await setDoc(userDocRef, {
                household_id: generatedHouseholdId
            }, { merge: true });

            return { householdId: generatedHouseholdId, role: 'leader', error: null };
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
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                households.push({
                    id: data.id,
                    name: data.name,
                    role: data.members[userId]?.role || 'member'
                });
            });

            return { households, error: null };
        } catch (error) {
            console.error("GET_USER_HOUSEHOLDS_ERROR:", error);
            return { households: [], error: error.message };
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
    }
};
