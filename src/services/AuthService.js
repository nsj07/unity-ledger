import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from '../config/firebase';

export const AuthService = {
    // Register a new user
    registerUser: async (email, password, displayName) => {
        try {
            const cleanEmail = email.trim();
            const cleanName = displayName.trim();
            const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            const user = userCredential.user;

            await updateProfile(user, { displayName: cleanName });

            // Create a global user document
            await setDoc(doc(db, 'users', user.uid), {
                id: user.uid,
                email: cleanEmail,
                display_name: cleanName,
                household_id: null,
            });

            return { user, error: null };
        } catch (error) {
            console.error("REGISTER_USER_ERROR:", error);
            return { user: null, error: error.message };
        }
    },

    // Ensure a Firestore profile document exists for an authenticated user
    ensureUserProfile: async (firebaseUser) => {
        try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
                await setDoc(userDocRef, {
                    id: firebaseUser.uid,
                    email: (firebaseUser.email || '').trim(),
                    display_name: (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User').trim(),
                    household_id: null,
                });
            }
            return { success: true, error: null };
        } catch (error) {
            console.error("ENSURE_USER_PROFILE_ERROR:", error);
            return { success: false, error: error.message };
        }
    },

    // Login an existing user
    loginUser: async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
            return { user: userCredential.user, error: null };
        } catch (error) {
            console.error("LOGIN_USER_ERROR:", error);
            return { user: null, error: error.message };
        }
    },

    // Logout the current user
    logoutUser: async () => {
        try {
            await signOut(auth);
            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // Handle Google Sign-In
    loginWithGoogle: async () => {
        try {
            if (Platform.OS !== 'web') {
                return {
                    user: null,
                    error: "Mobile Google Sign-In requires Native configuration (OAuth Client IDs and a Dev Build). It currently works out-of-the-box on Web."
                };
            }

            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;

            // Check if user document exists, if not, create it (acts as sign up too)
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                await setDoc(userDocRef, {
                    id: user.uid,
                    email: user.email,
                    display_name: user.displayName || 'Google User',
                    household_id: null,
                });
            }

            return { user, error: null };
        } catch (error) {
            return { user: null, error: error.message };
        }
    },

    // Check if user has an active household or create one
    checkUserHousehold: async (uid) => {
        try {
            const userDocRef = doc(db, 'users', uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                return {
                    userData: userDoc.data(),
                    householdId: userDoc.data().household_id,
                    error: null
                };
            }
            return { householdId: null, error: "User profile not found." };
        } catch (error) {
            return { householdId: null, error: error.message };
        }
    }
};
