import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AuthService } from '@/src/services/AuthService';
import { HouseholdService } from '@/src/services/HouseholdService';
import { clearAuth, setHouseholdContext } from '@/src/store/authSlice';

interface HouseholdProfileModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function HouseholdProfileModal({ visible, onClose }: HouseholdProfileModalProps) {
    const dispatch = useDispatch();
    const insets = useSafeAreaInsets();
    const { user, householdId } = useSelector((state: any) => state.auth);
    const [availableHouseholds, setAvailableHouseholds] = useState<any[]>([]);

    useEffect(() => {
        if (!visible || !user?.uid) return;
        let isMounted = true;

        HouseholdService.getUserHouseholds(user.uid).then((res) => {
            if (!isMounted) return;
            if (!res.error) {
                setAvailableHouseholds(res.households);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [visible, user?.uid]);

    const handleLogout = async () => {
        onClose();
        await AuthService.logoutUser();
        dispatch(clearAuth());
        router.replace('/login');
    };

    const handleCreateOrJoinNew = () => {
        onClose();
        router.push('/onboarding');
    };

    const handleSwitchActiveHousehold = async (hh: any) => {
        onClose();
        if (hh.id === householdId) return;

        await HouseholdService.switchActiveHousehold(user.uid, hh.id);
        dispatch(setHouseholdContext({
            householdId: hh.id,
            householdName: hh.name,
            householdRole: hh.role,
        }));
    };

    return (
        <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity
                style={[styles.modalOverlay, { paddingTop: insets.top + 56 }]}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.menuBox} onStartShouldSetResponder={() => true}>
                    <View style={styles.userHeader}>
                        <Text style={styles.userName} numberOfLines={1}>
                            {user?.displayName || 'User'}
                        </Text>
                        {user?.email ? (
                            <Text style={styles.userEmail} numberOfLines={1}>
                                {user.email}
                            </Text>
                        ) : null}
                    </View>

                    <View style={styles.divider} />
                    <Text style={styles.menuTitle}>My Households</Text>

                    {availableHouseholds.map((hh) => (
                        <TouchableOpacity
                            key={hh.id}
                            style={[styles.menuItem, hh.id === householdId && styles.menuItemActive]}
                            onPress={() => handleSwitchActiveHousehold(hh)}
                        >
                            <IconSymbol
                                name={hh.id === householdId ? 'house.fill' : 'house'}
                                size={20}
                                color={hh.id === householdId ? '#3B82F6' : '#4B5563'}
                            />
                            <Text
                                style={[styles.menuText, hh.id === householdId && styles.menuTextActive]}
                                numberOfLines={1}
                            >
                                {hh.name || 'Default Household'}
                            </Text>
                        </TouchableOpacity>
                    ))}

                    <View style={styles.divider} />
                    <Text style={styles.menuTitle}>Profile Options</Text>
                    <TouchableOpacity style={styles.menuItem} onPress={handleCreateOrJoinNew}>
                        <IconSymbol name="plus" size={20} color="#333" />
                        <Text style={styles.menuText}>Create / Join New</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                        <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color="#FF3B30" />
                        <Text style={[styles.menuText, { color: '#FF3B30' }]}>Sign Out</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingRight: 16,
    },
    menuBox: {
        backgroundColor: '#FFF',
        borderRadius: 14,
        padding: 8,
        width: 230,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 10,
    },
    userHeader: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    userName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    userEmail: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    loadingWrap: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    menuTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
    },
    menuItemActive: {
        backgroundColor: '#EFF6FF',
    },
    menuText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginLeft: 10,
        flexShrink: 1,
    },
    menuTextActive: {
        color: '#3B82F6',
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 4,
    },
});
