import React, { useState } from 'react';
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

export interface CategoryPickerItem {
    id: string;
    name: string;
    type?: string;
    subcategories?: string[];
}

interface CategoryPickerSheetProps {
    visible: boolean;
    title?: string;
    categories: CategoryPickerItem[];
    selectedCategoryId: string;
    selectedSubCategory: string;
    onSelect: (categoryId: string, subCategory: string) => void;
    onClose: () => void;
}

const SHEET_BODY_HEIGHT = Math.min(Dimensions.get('window').height * 0.5, 380);

export default function CategoryPickerSheet({
    visible,
    title = 'Select Category',
    categories,
    selectedCategoryId,
    selectedSubCategory,
    onSelect,
    onClose,
}: CategoryPickerSheetProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const styles = createStyles(isDark);

    const [browsedCategoryId, setBrowsedCategoryId] = useState<string | null>(null);

    const activeCategory =
        (browsedCategoryId ? categories.find((c) => c.id === browsedCategoryId) : null) ||
        categories.find((c) => c.id === selectedCategoryId) ||
        categories[0] ||
        null;
    const subCategories: string[] = activeCategory?.subcategories || [];

    const handleClose = () => {
        setBrowsedCategoryId(null);
        onClose();
    };

    const handlePickSubCategory = (sub: string) => {
        if (!activeCategory) return;
        onSelect(activeCategory.id, sub);
        setBrowsedCategoryId(null);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={handleClose} />
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <View style={styles.handleBar} />
                    <View style={styles.header}>
                        <Text style={styles.title} numberOfLines={1}>
                            {title}
                        </Text>
                        <TouchableOpacity
                            onPress={handleClose}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <IconSymbol
                                name="xmark.circle.fill"
                                size={26}
                                color="#9CA3AF"
                            />
                        </TouchableOpacity>
                    </View>

                    {categories.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                No categories available for this transaction type.
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.splitContainer}>
                            {/* Left Pane: Categories */}
                            <View style={styles.leftPane}>
                                <View style={styles.paneHeader}>
                                    <Text style={styles.paneHeaderText} numberOfLines={1}>
                                        Categories
                                    </Text>
                                </View>
                                <ScrollView
                                    style={styles.paneScroll}
                                    contentContainerStyle={styles.leftScrollContent}
                                    showsVerticalScrollIndicator
                                >
                                    {categories.map((cat) => {
                                        const isActive = cat.id === activeCategory?.id;
                                        const isChosen = cat.id === selectedCategoryId;
                                        return (
                                            <TouchableOpacity
                                                key={cat.id}
                                                style={[
                                                    styles.categoryRow,
                                                    isActive && styles.categoryRowActive,
                                                ]}
                                                onPress={() => setBrowsedCategoryId(cat.id)}
                                                activeOpacity={0.7}
                                            >
                                                <Text
                                                    style={[
                                                        styles.categoryText,
                                                        isActive && styles.categoryTextActive,
                                                    ]}
                                                    numberOfLines={2}
                                                >
                                                    {cat.name}
                                                </Text>
                                                {isChosen && !isActive ? (
                                                    <View style={styles.chosenDot} />
                                                ) : null}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Vertical Divider */}
                            <View style={styles.verticalDivider} />

                            {/* Right Pane: Sub-Categories */}
                            <View style={styles.rightPane}>
                                <View style={styles.paneHeader}>
                                    <Text style={styles.paneHeaderText} numberOfLines={1}>
                                        {activeCategory ? activeCategory.name : 'Sub-categories'}
                                    </Text>
                                </View>
                                <ScrollView
                                    style={styles.paneScroll}
                                    contentContainerStyle={styles.rightScrollContent}
                                    showsVerticalScrollIndicator
                                >
                                    {/* General / No Sub-category option */}
                                    <TouchableOpacity
                                        style={[
                                            styles.subRow,
                                            activeCategory?.id === selectedCategoryId &&
                                                !selectedSubCategory &&
                                                styles.subRowSelected,
                                        ]}
                                        onPress={() => handlePickSubCategory('')}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.subTextWrapper}>
                                            <Text
                                                style={[
                                                    styles.subText,
                                                    activeCategory?.id === selectedCategoryId &&
                                                        !selectedSubCategory &&
                                                        styles.subTextSelected,
                                                ]}
                                                numberOfLines={2}
                                            >
                                                General
                                            </Text>
                                            <Text style={styles.subHint} numberOfLines={1}>
                                                Category only
                                            </Text>
                                        </View>
                                        {activeCategory?.id === selectedCategoryId &&
                                        !selectedSubCategory ? (
                                            <IconSymbol
                                                name="checkmark"
                                                size={18}
                                                color={isDark ? '#60A5FA' : '#2563EB'}
                                            />
                                        ) : null}
                                    </TouchableOpacity>

                                    {subCategories.map((sub, idx) => {
                                        const isSubSelected =
                                            activeCategory?.id === selectedCategoryId &&
                                            selectedSubCategory === sub;
                                        return (
                                            <TouchableOpacity
                                                key={`${activeCategory?.id}-${idx}`}
                                                style={[
                                                    styles.subRow,
                                                    isSubSelected && styles.subRowSelected,
                                                ]}
                                                onPress={() => handlePickSubCategory(sub)}
                                                activeOpacity={0.7}
                                            >
                                                <Text
                                                    style={[
                                                        styles.subText,
                                                        styles.subTextFlex,
                                                        isSubSelected && styles.subTextSelected,
                                                    ]}
                                                    numberOfLines={2}
                                                >
                                                    {sub}
                                                </Text>
                                                {isSubSelected ? (
                                                    <IconSymbol
                                                        name="checkmark"
                                                        size={18}
                                                        color={isDark ? '#60A5FA' : '#2563EB'}
                                                    />
                                                ) : null}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        </View>
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
        splitContainer: {
            flexDirection: 'row',
            height: SHEET_BODY_HEIGHT,
        },
        leftPane: {
            flex: 1,
            backgroundColor: isDark ? '#111827' : '#F3F4F6',
        },
        rightPane: {
            flex: 1,
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
        },
        verticalDivider: {
            width: 1,
            backgroundColor: isDark ? '#374151' : '#E5E7EB',
        },
        paneHeader: {
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#374151' : '#E5E7EB',
        },
        paneHeaderText: {
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: isDark ? '#9CA3AF' : '#6B7280',
        },
        paneScroll: {
            flex: 1,
        },
        leftScrollContent: {
            paddingVertical: 4,
        },
        rightScrollContent: {
            padding: 8,
            gap: 6,
        },
        categoryRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 14,
            paddingHorizontal: 12,
            borderLeftWidth: 3,
            borderLeftColor: 'transparent',
        },
        categoryRowActive: {
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderLeftColor: isDark ? '#60A5FA' : '#2563EB',
        },
        categoryText: {
            fontSize: 14,
            fontWeight: '500',
            color: isDark ? '#D1D5DB' : '#374151',
            flex: 1,
            lineHeight: 19,
        },
        categoryTextActive: {
            color: isDark ? '#93C5FD' : '#1D4ED8',
            fontWeight: '700',
        },
        chosenDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: isDark ? '#60A5FA' : '#2563EB',
            marginLeft: 6,
        },
        subRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            borderWidth: 1,
            borderColor: 'transparent',
            gap: 8,
        },
        subRowSelected: {
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF',
            borderColor: isDark ? '#3B82F6' : '#93C5FD',
        },
        subTextWrapper: {
            flex: 1,
        },
        subText: {
            fontSize: 14,
            fontWeight: '600',
            color: isDark ? '#F9FAFB' : '#111827',
            lineHeight: 19,
        },
        subTextFlex: {
            flex: 1,
        },
        subTextSelected: {
            color: isDark ? '#93C5FD' : '#1D4ED8',
            fontWeight: '700',
        },
        subHint: {
            fontSize: 11,
            color: isDark ? '#9CA3AF' : '#6B7280',
            marginTop: 2,
        },
        emptyContainer: {
            paddingVertical: 48,
            paddingHorizontal: 24,
            alignItems: 'center',
        },
        emptyText: {
            fontSize: 14,
            color: isDark ? '#9CA3AF' : '#6B7280',
            textAlign: 'center',
        },
    });
