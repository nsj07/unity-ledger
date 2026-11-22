import { StyleSheet } from 'react-native';

export const createStyles = (colorScheme: 'light' | 'dark' | null | undefined) => {
    const isDark = colorScheme === 'dark';

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: isDark ? '#111827' : '#F7F9FC',
        },
        headerContainer: {
            paddingHorizontal: 20,
            paddingVertical: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#374151' : '#E5E7EB',
        },
        headerTitle: {
            fontSize: 24,
            fontWeight: '800',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        addButton: {
            backgroundColor: '#3B82F6',
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#3B82F6',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
        },
        listContainer: {
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 40,
        },
        emptyText: {
            textAlign: 'center',
            color: isDark ? '#9CA3AF' : '#6B7280',
            marginTop: 40,
            fontSize: 16,
        },
        txnCard: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.05,
            shadowRadius: 8,
            elevation: 2,
        },
        txnLeft: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        iconCircle: {
            width: 40,
            height: 40,
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        txnCategory: {
            fontSize: 16,
            fontWeight: '600',
            color: isDark ? '#F9FAFB' : '#111827',
            marginBottom: 4,
        },
        txnSubtext: {
            fontSize: 13,
            color: isDark ? '#9CA3AF' : '#6B7280',
        },
        txnRight: {
            alignItems: 'flex-end',
        },
        txnAmount: {
            fontSize: 16,
            fontWeight: '700',
            marginBottom: 4,
        },
        txnDate: {
            fontSize: 11,
            color: isDark ? '#6B7280' : '#9CA3AF',
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
            paddingBottom: 40, // better safe area handling
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        },
        modalTitle: {
            fontSize: 22,
            fontWeight: '800',
            color: isDark ? '#FFFFFF' : '#111827',
        },
        segmentedRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 24,
            backgroundColor: isDark ? '#374151' : '#F3F4F6',
            borderRadius: 12,
            padding: 4,
        },
        segmentButton: {
            flex: 1,
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: 8,
        },
        segmentButtonActive: {
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
        },
        segmentText: {
            fontWeight: '600',
            color: isDark ? '#9CA3AF' : '#6B7280',
        },
        segmentTextActive: {
            color: isDark ? '#F9FAFB' : '#111827',
        },
        inputLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: isDark ? '#9CA3AF' : '#4B5563',
            marginBottom: 8,
            marginTop: 16,
        },
        inputBox: {
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            color: isDark ? '#FFFFFF' : '#111827',
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 12,
            fontSize: 16,
        },
        amountInput: {
            fontSize: 32,
            fontWeight: '800',
            textAlign: 'center',
            borderWidth: 0,
            backgroundColor: 'transparent',
            marginBottom: 10,
            color: isDark ? '#FFFFFF' : '#111827',
        },
        pickerWrapper: {
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            borderRadius: 12,
            overflow: 'hidden',
        },
        picker: {
            color: isDark ? '#FFFFFF' : '#111827',
            backgroundColor: 'transparent',
            height: 50,
        },
        modalActions: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 30,
            gap: 12,
        },
        cancelBtn: {
            flex: 1,
            paddingVertical: 16,
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
            paddingVertical: 16,
            borderRadius: 12,
            backgroundColor: '#3B82F6',
            alignItems: 'center',
        },
        saveBtnText: {
            color: '#FFFFFF',
            fontWeight: '700',
            fontSize: 16,
        }
    });
};
