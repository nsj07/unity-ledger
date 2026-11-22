import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Pressable,
    ScrollView,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

export interface BottomPickerItem {
    id: string;
    label: string;
    subtitle?: string;
    rightText?: string;
}

interface BottomPickerSheetProps {
    visible: boolean;
    title: string;
    items: BottomPickerItem[];
    selectedId: string;
    onSelect: (id: string) => void;
    onClose: () => void;
    emptyText?: string;
}

const MAX_SHEET_HEIGHT = Math.min(Dimensions.get('window').height * 0.65, 520);

export default function BottomPickerSheet({
    visible,
    title,
    items,
    selectedId,
    onSelect,
    onClose,
    emptyText = 'No options available.',
}: BottomPickerSheetProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const styles = createStyles(isDark);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                    <View style={styles.handleBar} />
                    <View style={styles.header}>
                        <Text style={styles.title} numberOfLines={1}>
                            {title}
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <IconSymbol
                                name="xmark.circle.fill"
                                size={26}
                                color={isDark ? '#9CA3AF' : '#9CA3AF'}
                            />
                        </TouchableOpacity>
                    </View>

                    {items.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>{emptyText}</Text>
                        </View>
                    ) : (
                        <ScrollView
                            style={styles.scrollArea}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator
                        >
                            {items.map((item) => {
                                const isSelected = item.id === selectedId;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.row, isSelected && styles.rowSelected]}
                                        onPress={() => {
                                            onSelect(item.id);
                                            onClose();
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.rowLeft}>
                                            <Text
                                                style={[
                                                    styles.rowLabel,
                                                    isSelected && styles.rowLabelSelected,
                                                ]}
                                                numberOfLines={2}
                                            >
                                                {item.label}
                                            </Text>
                                            {item.subtitle ? (
                                                <Text style={styles.rowSubtitle} numberOfLines={1}>
                                                    {item.subtitle}
                                                </Text>
                                            ) : null}
                                        </View>

                                        <View style={styles.rowRight}>
                                            {item.rightText ? (
                                                <Text
                                                    style={[
                                                        styles.rowRightText,
                                                        isSelected && styles.rowLabelSelected,
                                                    ]}
                                                >
                                                    {item.rightText}
                                                </Text>
                                            ) : null}
                                            {isSelected ? (
                                                <IconSymbol
                                                    name="checkmark"
                                                    size={20}
                                                    color={isDark ? '#60A5FA' : '#2563EB'}
                                                />
                                            ) : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (isDark: boolean) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
        },
        backdrop: {
            flex: 1,
        },
        sheet: {
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: MAX_SHEET_HEIGHT,
            paddingTop: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 16,
        },
        handleBar: {
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: isDark ? '#4B5563' : '#D1D5DB',
            alignSelf: 'center',
            marginBottom: 12,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#374151' : '#E5E7EB',
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: isDark ? '#F9FAFB' : '#111827',
            flex: 1,
            marginRight: 12,
        },
        scrollArea: {
            flexGrow: 0,
        },
        scrollContent: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            gap: 6,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 14,
            paddingHorizontal: 14,
            borderRadius: 12,
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            borderWidth: 1,
            borderColor: 'transparent',
        },
        rowSelected: {
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF',
            borderColor: isDark ? '#3B82F6' : '#93C5FD',
        },
        rowLeft: {
            flex: 1,
            marginRight: 12,
        },
        rowLabel: {
            fontSize: 15,
            fontWeight: '600',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        rowLabelSelected: {
            color: isDark ? '#93C5FD' : '#1D4ED8',
            fontWeight: '700',
        },
        rowSubtitle: {
            fontSize: 12,
            color: isDark ? '#9CA3AF' : '#6B7280',
            marginTop: 2,
        },
        rowRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        rowRightText: {
            fontSize: 14,
            fontWeight: '600',
            color: isDark ? '#D1D5DB' : '#374151',
        },
        emptyContainer: {
            paddingVertical: 40,
            paddingHorizontal: 24,
            alignItems: 'center',
        },
        emptyText: {
            fontSize: 14,
            color: isDark ? '#9CA3AF' : '#6B7280',
            textAlign: 'center',
        },
    });
