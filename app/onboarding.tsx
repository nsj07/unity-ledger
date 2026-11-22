import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Alert, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { HouseholdService } from '../src/services/HouseholdService';
import { InvitationService } from '../src/services/InvitationService';
import { AuthService } from '../src/services/AuthService';
import { clearAuth, setHouseholdContext, setLoading } from '../src/store/authSlice';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function HouseholdOnboarding() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { user, householdId, householdName: activeHouseholdName } = useSelector((state: any) => state.auth);
    const dispatch = useDispatch();

    const [inviteCode, setInviteCode] = useState('');
    const [householdName, setHouseholdName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(drawer)');
        }
    };

    const handleCreateHousehold = async () => {
        setErrorMessage(null);
        if (!householdName.trim()) {
            const msg = "Please enter a name for your Household.";
            setErrorMessage(msg);
            Alert.alert("Missing Name", msg);
            return;
        }

        if (!user || !user.uid) {
            const msg = "User session invalid. Please log in again.";
            setErrorMessage(msg);
            Alert.alert("Error", msg);
            return;
        }

        setSubmitting(true);
        dispatch(setLoading(true));
        const response = await HouseholdService.createHousehold(
            user.uid,
            householdName.trim(),
            'INR',
            user.displayName || 'Leader'
        );

        if (response.error) {
            dispatch(setLoading(false));
            setSubmitting(false);
            setErrorMessage(response.error);
            Alert.alert("Error Creating Household", response.error);
        } else {
            console.log('[ONBOARDING DISPATCH]: Creating household success:', response);
            dispatch(setHouseholdContext({
                householdId: response.householdId,
                householdName: householdName.trim(),
                householdRole: response.role
            }));
            dispatch(setLoading(false));
            setSubmitting(false);
            router.replace('/');
        }
    };

    const handleJoinHousehold = async () => {
        setErrorMessage(null);
        if (!inviteCode.trim()) {
            const msg = "Please enter an invite code.";
            setErrorMessage(msg);
            Alert.alert("Missing Info", msg);
            return;
        }

        if (!user || !user.uid) {
            const msg = "User session invalid. Please log in again.";
            setErrorMessage(msg);
            Alert.alert("Error", msg);
            return;
        }

        setSubmitting(true);
        dispatch(setLoading(true));
        const response = await InvitationService.redeemInvitation(
            user.uid,
            inviteCode,
            user.displayName || 'Member'
        );

        if (response.error || !response.success) {
            dispatch(setLoading(false));
            setSubmitting(false);
            const errMsg = response.error || "Unable to join household.";
            setErrorMessage(errMsg);
            Alert.alert("Error Joining Household", errMsg);
        } else {
            dispatch(setHouseholdContext({
                householdId: response.householdId,
                householdName: response.householdName || "Household",
                householdRole: response.role || "member"
            }));
            dispatch(setLoading(false));
            setSubmitting(false);
            router.replace('/');
        }
    };

    const handleLogout = async () => {
        await AuthService.logoutUser();
        dispatch(clearAuth());
        router.replace('/login');
    };

    return (
        <SafeAreaView style={[styles.safeArea, isDark && styles.containerDark]} edges={['top', 'bottom']}>
            {householdId ? (
                <View style={[styles.navBar, isDark && styles.navBarDark]}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleGoBack}
                        disabled={submitting}
                    >
                        <IconSymbol
                            name="chevron.left"
                            size={24}
                            color={isDark ? '#F9FAFB' : '#111827'}
                        />
                        <Text style={[styles.backButtonText, isDark && styles.textDark]} numberOfLines={1}>
                            {activeHouseholdName || 'Dashboard'}
                        </Text>
                    </TouchableOpacity>
                    <Text style={[styles.navTitle, isDark && styles.textDark]}>Households</Text>
                    <View style={styles.navSpacer} />
                </View>
            ) : null}

            <ScrollView
                contentContainerStyle={[styles.container, isDark && styles.containerDark]}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={[styles.title, isDark && styles.textDark]}>Welcome, {user?.displayName || 'User'}!</Text>
                <Text style={styles.subtitle}>
                    {householdId
                        ? 'Create a new household or join another with an invite code.'
                        : 'To use Unity Ledger, you need a Household.'}
                </Text>

                {errorMessage ? (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{errorMessage}</Text>
                    </View>
                ) : null}

                <View style={[styles.card, isDark && styles.cardDark]}>
                    <Text style={[styles.cardTitle, isDark && styles.textDark]}>Create New Household</Text>
                    <Text style={styles.description}>Start tracking expenses with your partner.</Text>
                    <TextInput
                        style={[styles.input, isDark && styles.inputDark]}
                        placeholder="Enter Household Name (e.g. The Smiths)"
                        placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                        value={householdName}
                        onChangeText={setHouseholdName}
                    />
                    <TouchableOpacity style={[styles.primaryButton, submitting && { opacity: 0.7 }]} onPress={handleCreateHousehold} disabled={submitting}>
                        {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Create Household</Text>}
                    </TouchableOpacity>
                </View>

                <Text style={styles.orText}>- OR -</Text>

                <View style={[styles.card, isDark && styles.cardDark]}>
                    <Text style={[styles.cardTitle, isDark && styles.textDark]}>Join Existing Household</Text>
                    <Text style={styles.description}>Enter the single-use invite code shared by your household leader.</Text>
                    <TextInput
                        style={[styles.input, isDark && styles.inputDark]}
                        placeholder="Enter Invite Code (e.g. 7K9M-2P4X)"
                        placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
                        value={inviteCode}
                        onChangeText={setInviteCode}
                        autoCapitalize="characters"
                        autoCorrect={false}
                    />
                    <TouchableOpacity style={[styles.primaryButton, styles.secondaryButton, submitting && { opacity: 0.7 }]} onPress={handleJoinHousehold} disabled={submitting}>
                        {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Join Household</Text>}
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={handleLogout} style={{ marginTop: 12, alignItems: 'center' }} disabled={submitting}>
                    <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 15 }}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F7F9FC',
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    navBarDark: {
        backgroundColor: '#1F2937',
        borderBottomColor: '#374151',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 4,
    },
    backButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        flexShrink: 1,
    },
    navTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
    },
    navSpacer: {
        flex: 1,
    },
    container: {
        flexGrow: 1,
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
        textAlign: 'center',
        marginBottom: 8,
        color: '#111827'
    },
    textDark: {
        color: '#F9FAFB'
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 32
    },
    card: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderRadius: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        marginBottom: 16
    },
    cardDark: {
        backgroundColor: '#1F2937',
        shadowOpacity: 0.3,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
        color: '#111827'
    },
    description: {
        color: '#9CA3AF',
        marginBottom: 20,
        fontSize: 14,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 20,
        fontSize: 16,
        color: '#111827'
    },
    inputDark: {
        borderColor: '#374151',
        backgroundColor: '#111827',
        color: '#F9FAFB'
    },
    orText: {
        textAlign: 'center',
        marginVertical: 16,
        color: '#9CA3AF',
        fontWeight: '700',
        fontSize: 14,
    },
    primaryButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButton: {
        backgroundColor: '#10B981', // Green for joining to differentiate
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
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
