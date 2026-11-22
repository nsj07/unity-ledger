import { StyleSheet } from 'react-native';

// Accepts colorScheme to dynamically generate styles
export const createStyles = (colorScheme: 'light' | 'dark' | null | undefined) => {
    const isDark = colorScheme === 'dark';

    return StyleSheet.create({
        container: {
            flex: 1,
            padding: 20,
            backgroundColor: isDark ? '#111827' : '#F7F9FC',
        },
        headerRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        },
        title: {
            fontSize: 28,
            fontWeight: '800',
            color: isDark ? '#FFFFFF' : '#111827',
        },
        addButton: {
            backgroundColor: '#3B82F6',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
        },
        addButtonText: {
            color: '#FFFFFF',
            fontWeight: '600',
            marginLeft: 6,
        },
        card: {
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            padding: 16,
            borderRadius: 12,
            marginBottom: 12,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.05,
            shadowRadius: 8,
        },
        cardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 8,
        },
        cardTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        typeBadge: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            alignSelf: 'flex-start',
            marginTop: 4,
        },
        typeBadgeText: {
            fontSize: 12,
            fontWeight: '700',
        },
        cardActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        iconButton: {
            padding: 4,
        },
        subcategoriesContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: 8,
            gap: 6,
        },
        subBadge: {
            backgroundColor: isDark ? '#374151' : '#E5E7EB',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
        },
        subBadgeText: {
            fontSize: 12,
            color: isDark ? '#D1D5DB' : '#4B5563',
        },
        loading: {
            marginTop: 20,
            textAlign: 'center',
            color: isDark ? '#9CA3AF' : '#6B7280',
        },
        emptyText: {
            textAlign: 'center',
            color: isDark ? '#9CA3AF' : '#6B7280',
            marginTop: 20,
            fontSize: 16,
        },

        // Modal Styles
        modalOverlay: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.6)',
        },
        modalContent: {
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: '90%',
        },
        modalTitle: {
            fontSize: 22,
            fontWeight: '800',
            color: isDark ? '#FFFFFF' : '#111827',
            marginBottom: 20,
        },
        inputLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: isDark ? '#9CA3AF' : '#4B5563',
            marginBottom: 8,
            marginTop: 16,
        },
        input: {
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#D1D5DB',
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            color: isDark ? '#FFFFFF' : '#111827',
            padding: 14,
            borderRadius: 10,
            fontSize: 16,
        },
        // Segmented Control
        segmentedRow: {
            flexDirection: 'row',
            gap: 8,
            flexWrap: 'wrap',
        },
        segmentButton: {
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#D1D5DB',
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
        },
        segmentButtonActive: {
            backgroundColor: '#3B82F6',
            borderColor: '#3B82F6',
        },
        segmentText: {
            color: isDark ? '#D1D5DB' : '#4B5563',
            fontWeight: '600',
        },
        segmentTextActive: {
            color: '#FFFFFF',
        },
        // Dynamic Subcategories Add
        subcatAddRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        subcatInput: {
            flex: 1,
            marginTop: 0,
        },
        subcatAddBtn: {
            backgroundColor: '#10B981',
            padding: 14,
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
        },
        subcatChipsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
        },
        removableChip: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? '#374151' : '#E5E7EB',
            paddingVertical: 6,
            paddingLeft: 12,
            paddingRight: 6,
            borderRadius: 16,
        },
        removableChipText: {
            color: isDark ? '#F9FAFB' : '#111827',
            marginRight: 6,
            fontSize: 14,
        },
        // Bottom Action Buttons
        modalActions: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 30,
            gap: 12,
            marginBottom: 20, // For bottom safe area padding
        },
        cancelBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: isDark ? '#374151' : '#F3F4F6',
            alignItems: 'center',
        },
        cancelBtnText: {
            color: isDark ? '#D1D5DB' : '#4B5563',
            fontWeight: '700',
            fontSize: 16,
        },
        saveBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: '#3B82F6',
            alignItems: 'center',
        },
        saveBtnText: {
            color: '#FFFFFF',
            fontWeight: '700',
            fontSize: 16,
        },
        deleteModalBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: '#EF4444',
            alignItems: 'center',
        },
    });
};
