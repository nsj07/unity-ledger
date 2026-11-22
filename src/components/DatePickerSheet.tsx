import React, { useMemo, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Pressable,
    StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface DatePickerSheetProps {
    visible: boolean;
    selectedDate: Date;
    onSelect: (date: Date) => void;
    onClose: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

export default function DatePickerSheet({
    visible,
    selectedDate,
    onSelect,
    onClose,
}: DatePickerSheetProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const styles = createStyles(isDark);

    const [navigatedMonth, setNavigatedMonth] = useState<{ year: number; month: number } | null>(
        null
    );

    const viewYear = navigatedMonth ? navigatedMonth.year : selectedDate.getFullYear();
    const viewMonth = navigatedMonth ? navigatedMonth.month : selectedDate.getMonth();

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const calendarCells = useMemo(() => {
        const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const cells: (number | null)[] = [];

        for (let i = 0; i < firstDayOfWeek; i++) {
            cells.push(null);
        }
        for (let day = 1; day <= daysInMonth; day++) {
            cells.push(day);
        }
        while (cells.length % 7 !== 0) {
            cells.push(null);
        }
        return cells;
    }, [viewYear, viewMonth]);

    const handleClose = () => {
        setNavigatedMonth(null);
        onClose();
    };

    const handlePrevMonth = () => {
        if (viewMonth === 0) {
            setNavigatedMonth({ year: viewYear - 1, month: 11 });
        } else {
            setNavigatedMonth({ year: viewYear, month: viewMonth - 1 });
        }
    };

    const handleNextMonth = () => {
        if (viewMonth === 11) {
            setNavigatedMonth({ year: viewYear + 1, month: 0 });
        } else {
            setNavigatedMonth({ year: viewYear, month: viewMonth + 1 });
        }
    };

    const pickDate = (year: number, month: number, day: number) => {
        const now = new Date();
        const isPickingToday =
            year === now.getFullYear() &&
            month === now.getMonth() &&
            day === now.getDate();

        const nextDate = isPickingToday
            ? now
            : new Date(year, month, day, 12, 0, 0);

        onSelect(nextDate);
        setNavigatedMonth(null);
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
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                    <View style={styles.handleBar} />
                    <View style={styles.header}>
                        <Text style={styles.title}>Select Date</Text>
                        <TouchableOpacity
                            onPress={handleClose}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <IconSymbol name="xmark.circle.fill" size={26} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    {/* Quick Chips */}
                    <View style={styles.quickRow}>
                        <TouchableOpacity
                            style={[
                                styles.quickChip,
                                isSameDay(selectedDate, today) && styles.quickChipActive,
                            ]}
                            onPress={() =>
                                pickDate(today.getFullYear(), today.getMonth(), today.getDate())
                            }
                        >
                            <Text
                                style={[
                                    styles.quickChipText,
                                    isSameDay(selectedDate, today) && styles.quickChipTextActive,
                                ]}
                            >
                                Today
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.quickChip,
                                isSameDay(selectedDate, yesterday) && styles.quickChipActive,
                            ]}
                            onPress={() =>
                                pickDate(
                                    yesterday.getFullYear(),
                                    yesterday.getMonth(),
                                    yesterday.getDate()
                                )
                            }
                        >
                            <Text
                                style={[
                                    styles.quickChipText,
                                    isSameDay(selectedDate, yesterday) &&
                                        styles.quickChipTextActive,
                                ]}
                            >
                                Yesterday
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Month Navigation */}
                    <View style={styles.monthHeader}>
                        <TouchableOpacity
                            style={styles.monthNavBtn}
                            onPress={handlePrevMonth}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <IconSymbol
                                name="chevron.left"
                                size={22}
                                color={isDark ? '#E5E7EB' : '#374151'}
                            />
                        </TouchableOpacity>
                        <Text style={styles.monthTitle}>
                            {MONTHS[viewMonth]} {viewYear}
                        </Text>
                        <TouchableOpacity
                            style={styles.monthNavBtn}
                            onPress={handleNextMonth}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <IconSymbol
                                name="chevron.right"
                                size={22}
                                color={isDark ? '#E5E7EB' : '#374151'}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Weekday Headers */}
                    <View style={styles.weekRow}>
                        {WEEKDAYS.map((day) => (
                            <Text key={day} style={styles.weekdayLabel}>
                                {day}
                            </Text>
                        ))}
                    </View>

                    {/* Calendar Grid */}
                    <View style={styles.grid}>
                        {calendarCells.map((day, idx) => {
                            if (day === null) {
                                return <View key={`empty-${idx}`} style={styles.dayCell} />;
                            }
                            const cellDate = new Date(viewYear, viewMonth, day);
                            const isSelected = isSameDay(cellDate, selectedDate);
                            const isToday = isSameDay(cellDate, today);

                            return (
                                <View key={`day-${day}`} style={styles.dayCell}>
                                    <TouchableOpacity
                                        style={[
                                            styles.dayButton,
                                            isToday && !isSelected && styles.dayButtonToday,
                                            isSelected && styles.dayButtonSelected,
                                        ]}
                                        onPress={() => pickDate(viewYear, viewMonth, day)}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.dayText,
                                                isToday && !isSelected && styles.dayTextToday,
                                                isSelected && styles.dayTextSelected,
                                            ]}
                                        >
                                            {day}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
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
            paddingHorizontal: 16,
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
            paddingHorizontal: 4,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#374151' : '#E5E7EB',
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        quickRow: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 14,
            marginBottom: 14,
        },
        quickChip: {
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: isDark ? '#111827' : '#F3F4F6',
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
        },
        quickChipActive: {
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
            borderColor: '#3B82F6',
        },
        quickChipText: {
            fontSize: 13,
            fontWeight: '600',
            color: isDark ? '#D1D5DB' : '#374151',
        },
        quickChipTextActive: {
            color: isDark ? '#93C5FD' : '#1D4ED8',
            fontWeight: '700',
        },
        monthHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        monthNavBtn: {
            padding: 8,
            borderRadius: 10,
            backgroundColor: isDark ? '#111827' : '#F3F4F6',
        },
        monthTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        weekRow: {
            flexDirection: 'row',
            marginBottom: 6,
        },
        weekdayLabel: {
            flex: 1,
            textAlign: 'center',
            fontSize: 12,
            fontWeight: '600',
            color: isDark ? '#9CA3AF' : '#6B7280',
        },
        grid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
        },
        dayCell: {
            width: '14.2857%',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 4,
        },
        dayButton: {
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
        },
        dayButtonToday: {
            borderWidth: 1.5,
            borderColor: '#3B82F6',
        },
        dayButtonSelected: {
            backgroundColor: '#3B82F6',
        },
        dayText: {
            fontSize: 14,
            fontWeight: '500',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        dayTextToday: {
            color: isDark ? '#60A5FA' : '#2563EB',
            fontWeight: '700',
        },
        dayTextSelected: {
            color: '#FFFFFF',
            fontWeight: '700',
        },
    });
