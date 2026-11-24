import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from '../config/firebase';

const ACCESS_DENIED_MESSAGE =
    'Access is restricted to invited users only. Please contact the administrator to request access.';

const STATIC_ALLOWED_EMAILS = new Set([
    'nagula.1999@gmail.com',
    'testera@xyz.com',
    'testerb@xyz.com',
    'testerc@xyz.com',
    'testerd@xyz.com',
    'testere@xyz.com',
    'testerf@xyz.com',
    'testerg@xyz.com',
    'testerh@xyz.com',
    'testeri@xyz.com',
    'testerj@xyz.com',
]);

export const AuthService = {
    // Check whether an authenticated user's email is in the static allowlist or Firestore allowed_users collection
    isEmailAllowed: async (email) => {
        try {
            const normalized = (email || '').trim().toLowerCase();
            if (!normalized) return false;
            if (STATIC_ALLOWED_EMAILS.has(normalized)) return true;
            const allowDoc = await getDoc(doc(db, 'allowed_users', normalized));
            return allowDoc.exists();
        } catch (error) {
            console.warn('ALLOWLIST_CHECK_ERROR:', error?.message || error);
            return false;
        }
    },

    // Register a new user
    registerUser: async (email, password, displayName) => {
        try {
            const cleanEmail = email.trim();
            const cleanName = displayName.trim();
            const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            const user = userCredential.user;

            const allowed = await AuthService.isEmailAllowed(user.email || cleanEmail);
            if (!allowed) {
                try {
                    await user.delete();
                } catch {
                    await signOut(auth);
                }
                return { user: null, error: ACCESS_DENIED_MESSAGE };
            }

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
            const allowed = await AuthService.isEmailAllowed(userCredential.user.email || email);
            if (!allowed) {
                await signOut(auth);
                return { user: null, error: ACCESS_DENIED_MESSAGE };
            }
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

            const allowed = await AuthService.isEmailAllowed(user.email);
            if (!allowed) {
                await signOut(auth);
                return { user: null, error: ACCESS_DENIED_MESSAGE };
            }

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
