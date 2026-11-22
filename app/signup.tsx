import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Text, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthService } from '../src/services/AuthService';
import { store } from '../src/store';
import { setLoading, setUser } from '../src/store/authSlice';

export default function SignupScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSignup = async () => {
        setErrorMessage(null);
        if (!email.trim() || !password || !name.trim()) {
            const msg = 'Please fill in all fields.';
            setErrorMessage(msg);
            Alert.alert('Error', msg);
            return;
        }

        setSubmitting(true);
        store.dispatch(setLoading(true));
        const cleanName = name.trim();
        const response = await AuthService.registerUser(email.trim(), password, cleanName);
        if (response.user) {
            store.dispatch(setUser({
                uid: response.user.uid,
                email: response.user.email,
                displayName: cleanName,
            }));
        }
        store.dispatch(setLoading(false));
        setSubmitting(false);

        if (response.error) {
            setErrorMessage(response.error);
            Alert.alert('Signup Failed', response.error);
        } else {
            router.replace('/onboarding');
        }
    };

    const handleGoogleAuth = async () => {
        setErrorMessage(null);
        setSubmitting(true);
        store.dispatch(setLoading(true));
        const response = await AuthService.loginWithGoogle();
        store.dispatch(setLoading(false));
        setSubmitting(false);

        if (response.error) {
            setErrorMessage(response.error);
            Alert.alert('Google Auth Notice', response.error);
        } else {
            router.replace('/');
        }
    };

    return (
        <View style={[styles.container, isDark && styles.containerDark]}>
            <Text style={[styles.title, isDark && styles.textDark]}>Create Unity Ledger Account</Text>
            {errorMessage ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
            ) : null}
            <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="Display Name"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                value={name}
                onChangeText={setName}
            />
            <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="Email"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            />
            <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="Password"
                placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            <TouchableOpacity style={[styles.primaryButton, submitting && { opacity: 0.7 }]} onPress={handleSignup} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Sign Up</Text>}
            </TouchableOpacity>

            <View style={{ marginVertical: 12 }}>
                <TouchableOpacity style={[styles.primaryButton, styles.googleButton, submitting && { opacity: 0.7 }]} onPress={handleGoogleAuth} disabled={submitting}>
                    <Text style={styles.primaryButtonText}>Sign up with Google</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => router.back()} style={styles.outlineButton} disabled={submitting}>
                <Text style={[styles.outlineButtonText, isDark && styles.textDark]}>Already have an account? Login</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        backgroundColor: '#F7F9FC'
    },
    containerDark: {
        backgroundColor: '#111827'
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 32,
        textAlign: 'center',
        color: '#111827'
    },
    textDark: {
        color: '#FFFFFF'
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        fontSize: 16,
        color: '#111827'
    },
    inputDark: {
        borderColor: '#374151',
        backgroundColor: '#1F2937',
        color: '#FFFFFF'
    },
    primaryButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    googleButton: {
        backgroundColor: '#DB4437',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
    },
    outlineButton: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    outlineButtonText: {
        color: '#6B7280',
        fontWeight: '600',
        fontSize: 14,
    },
    errorBox: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#B91C1C',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    }
});
