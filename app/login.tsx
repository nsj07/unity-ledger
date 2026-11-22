import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Text, Alert, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthService } from '../src/services/AuthService';
import { store } from '../src/store';
import { setLoading } from '../src/store/authSlice';

// A simple login component
export default function LoginScreen() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        store.dispatch(setLoading(true));
        const response = await AuthService.loginUser(email, password);
        store.dispatch(setLoading(false));

        if (response.error) {
            Alert.alert('Login Failed', response.error);
        } else {
            console.log("Login Success, checking household...", response.user?.uid);
            // The Auth context and `app/_layout.tsx` effect intercepts standard routing securely.
            router.replace('/'); // Redirect to home (drawer) layout
        }
    };

    const handleGoogleLogin = async () => {
        store.dispatch(setLoading(true));
        const response = await AuthService.loginWithGoogle();
        store.dispatch(setLoading(false));

        if (response.error) {
            Alert.alert('Google Auth Notice', response.error);
        } else {
            router.replace('/');
        }
    };

    return (
        <View style={[styles.container, isDark && styles.containerDark]}>
            <Text style={[styles.title, isDark && styles.textDark]}>Login to Unity Ledger</Text>
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

            <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
                <Text style={styles.primaryButtonText}>Login</Text>
            </TouchableOpacity>

            <View style={{ marginVertical: 12 }}>
                <TouchableOpacity style={[styles.primaryButton, styles.googleButton]} onPress={handleGoogleLogin}>
                    <Text style={styles.primaryButtonText}>Sign in with Google</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => router.push('/signup')} style={styles.outlineButton}>
                <Text style={[styles.outlineButtonText, isDark && styles.textDark]}>Don't have an account? Sign Up</Text>
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
    }
});
