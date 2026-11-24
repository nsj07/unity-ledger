import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import BottomPickerSheet, { BottomPickerItem } from '@/src/components/BottomPickerSheet';
import CategoryPickerSheet from '@/src/components/CategoryPickerSheet';
import DatePickerSheet from '@/src/components/DatePickerSheet';
import { TransactionService } from '@/src/services/TransactionService';
import { ParsedTransactionDraft, TransactionType } from '@/src/services/voiceAi/types';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

interface VoiceReviewSheetProps {
    visible: boolean;
    draft: ParsedTransactionDraft | null;
    onChangeDraft: (next: ParsedTransactionDraft) => void;
    onRequestVoiceRefine: () => void;
    onSaved: () => void;
    onClose: () => void;
}

const TX_TYPES: TransactionType[] = ['Expense', 'Income', 'Transfer'];

function getTypeAccent(type: TransactionType) {
    switch (type) {
        case 'Expense':
            return '#EF4444';
        case 'Income':
            return '#10B981';
        case 'Transfer':
            return '#F59E0B';
    }
}

function formatDisplayDate(ms: number) {
    const date = new Date(ms);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const sameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    const formatted = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    if (sameDay(date, now)) return `Today, ${formatted}`;
    if (sameDay(date, yesterday)) return `Yesterday, ${formatted}`;
    return formatted;
}

export default function VoiceReviewSheet({
    visible,
    draft,
    onChangeDraft,
    onRequestVoiceRefine,
    onSaved,
    onClose,
}: VoiceReviewSheetProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const styles = createStyles(isDark);

    const { user, householdId } = useSelector((state: any) => state.auth);
    const { accounts } = useSelector((state: any) => state.accounts);
    const { categories } = useSelector((state: any) => state.categories);

    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [showSourceSheet, setShowSourceSheet] = useState(false);
    const [showDestSheet, setShowDestSheet] = useState(false);
    const [showCategorySheet, setShowCategorySheet] = useState(false);
    const [showDateSheet, setShowDateSheet] = useState(false);

    const accountItems: BottomPickerItem[] = useMemo(
        () =>
            (accounts || []).map((acc: any) => ({
                id: acc.id,
                label: acc.name,
                subtitle: acc.type || undefined,
                rightText: `₹${Number(acc.balance || 0).toLocaleString()}`,
            })),
        [accounts]
    );

    const txType: TransactionType = draft?.type || 'Expense';
    const availableCategories = useMemo(
        () =>
            (categories || []).filter((c: any) =>
                txType === 'Transfer' ? c.type === 'Transfer' : c.type === txType
            ),
        [categories, txType]
    );

    if (!draft) return null;

    const effectiveSourceId =
        draft.accountId || (accounts?.length > 0 ? accounts[0].id : '');
    const sourceAcc = (accounts || []).find((a: any) => a.id === effectiveSourceId);
    const destAcc = (accounts || []).find((a: any) => a.id === draft.toAccountId);
    const catObj = (categories || []).find((c: any) => c.id === draft.categoryId);
    const catDisplay = catObj
        ? draft.subcategoryName
            ? `${catObj.name} › ${draft.subcategoryName}`
            : catObj.name
        : '';

    const accent = getTypeAccent(txType);

    const patchDraft = (patch: Partial<ParsedTransactionDraft>) => {
        setErrorMsg(null);
        onChangeDraft({
            ...draft,
            ...patch,
        });
    };

    const handleConfirmSave = async () => {
        setErrorMsg(null);
        const numericAmount = Number(draft.amount);
        if (!draft.amount || isNaN(numericAmount) || numericAmount <= 0) {
            setErrorMsg('Please enter a valid transaction amount greater than 0.');
            return;
        }
        if (!effectiveSourceId) {
            setErrorMsg('Please select a source account.');
            return;
        }
        if (draft.type === 'Transfer' && !draft.toAccountId) {
            setErrorMsg('Please select a destination account for this transfer.');
            return;
        }
        if (draft.type === 'Transfer' && effectiveSourceId === draft.toAccountId) {
            setErrorMsg('Source and destination accounts cannot be the same.');
            return;
        }
        if (!householdId || !user?.uid) {
            setErrorMsg('Active household session is missing.');
            return;
        }

        setSaving(true);
        const res = await TransactionService.createTransaction(householdId, {
            type: draft.type,
            amount: numericAmount,
            account_id: effectiveSourceId,
            to_account_id: draft.type === 'Transfer' ? draft.toAccountId : null,
            category_id: draft.categoryId || null,
            subcategory_name: draft.subcategoryName || null,
            note: draft.note.trim() || null,
            transaction_date: new Date(draft.transactionDateMs),
            added_by: user.uid,
        });
        setSaving(false);

        if (res.error) {
            setErrorMsg(res.error);
            if (Platform.OS !== 'web') {
                Alert.alert('Save Failed', res.error);
            }
        } else {
            onSaved();
        }
    };

    const isSubSheetOpen =
        showSourceSheet || showDestSheet || showCategorySheet || showDateSheet;
    const reviewModalVisible =
        visible && (Platform.OS !== 'ios' || !isSubSheetOpen);

    return (
        <>
            <Modal
                visible={reviewModalVisible}
                transparent
                animationType="slide"
                onRequestClose={saving ? undefined : onClose}
            >
                <KeyboardAvoidingView
                    style={styles.overlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <Pressable
                        style={styles.backdrop}
                        onPress={saving ? undefined : onClose}
                    />
                    <View
                        style={[
                            styles.sheet,
                            { paddingBottom: Math.max(insets.bottom, 16) },
                        ]}
                    >
                        <View style={styles.handleBar} />

                        <View style={styles.headerRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>Review & Confirm</Text>
                                {draft.latencyMs ? (
                                    <Text style={styles.latencyText}>
                                        Parsed locally in {draft.latencyMs} ms
                                    </Text>
                                ) : null}
                            </View>
                            <TouchableOpacity
                                onPress={onClose}
                                disabled={saving}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <IconSymbol
                                    name="xmark.circle.fill"
                                    size={26}
                                    color="#9CA3AF"
                                />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.scrollArea}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Voice Transcript + Quick Voice Edit Button */}
                            <View style={styles.voiceBanner}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.voiceBannerLabel}>Voice Input</Text>
                                    <Text style={styles.voiceBannerText} numberOfLines={2}>
                                        “{draft.rawTranscript}”
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.voiceRefineBtn}
                                    onPress={onRequestVoiceRefine}
                                    disabled={saving}
                                >
                                    <IconSymbol name="mic.fill" size={16} color="#FFFFFF" />
                                    <Text style={styles.voiceRefineBtnText}>Voice Edit</Text>
                                </TouchableOpacity>
                            </View>

                            {errorMsg ? (
                                <View style={styles.errorBanner}>
                                    <Text style={styles.errorText}>{errorMsg}</Text>
                                </View>
                            ) : null}

                            {draft.warnings && draft.warnings.length > 0 && !errorMsg ? (
                                <View style={styles.warningBanner}>
                                    <Text style={styles.warningText}>
                                        {draft.warnings.join(' ')}
                                    </Text>
                                </View>
                            ) : null}

                            {/* Type Segmented Control */}
                            <View style={styles.segmentedRow}>
                                {TX_TYPES.map((t) => {
                                    const active = txType === t;
                                    return (
                                        <TouchableOpacity
                                            key={t}
                                            style={[
                                                styles.segmentBtn,
                                                active && styles.segmentBtnActive,
                                            ]}
                                            onPress={() =>
                                                patchDraft({
                                                    type: t,
                                                    categoryId: '',
                                                    subcategoryName: '',
                                                })
                                            }
                                            disabled={saving}
                                        >
                                            <Text
                                                style={[
                                                    styles.segmentText,
                                                    active && {
                                                        color: getTypeAccent(t),
                                                        fontWeight: '700',
                                                    },
                                                ]}
                                            >
                                                {t}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Amount */}
                            <View style={styles.amountCard}>
                                <Text style={styles.amountLabel}>{txType} Amount</Text>
                                <View style={styles.amountRow}>
                                    <Text style={[styles.currency, { color: accent }]}>₹</Text>
                                    <TextInput
                                        style={styles.amountInput}
                                        value={draft.amount}
                                        onChangeText={(v) => patchDraft({ amount: v })}
                                        placeholder="0.00"
                                        placeholderTextColor={isDark ? '#4B5563' : '#9CA3AF'}
                                        keyboardType="decimal-pad"
                                        editable={!saving}
                                    />
                                </View>
                            </View>

                            {/* Field Selectors */}
                            <View style={styles.fieldsCard}>
                                <TouchableOpacity
                                    style={styles.fieldRow}
                                    onPress={() => setShowSourceSheet(true)}
                                    disabled={saving}
                                >
                                    <View style={styles.fieldLeft}>
                                        <IconSymbol
                                            name="creditcard.fill"
                                            size={18}
                                            color={isDark ? '#60A5FA' : '#2563EB'}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.fieldLabel}>Source Account</Text>
                                            <Text style={styles.fieldValue} numberOfLines={1}>
                                                {sourceAcc ? sourceAcc.name : 'Select source account'}
                                            </Text>
                                        </View>
                                    </View>
                                    <IconSymbol name="chevron.right" size={18} color="#9CA3AF" />
                                </TouchableOpacity>

                                {txType === 'Transfer' ? (
                                    <TouchableOpacity
                                        style={styles.fieldRow}
                                        onPress={() => setShowDestSheet(true)}
                                        disabled={saving}
                                    >
                                        <View style={styles.fieldLeft}>
                                            <IconSymbol
                                                name="arrow.left.arrow.right.circle.fill"
                                                size={18}
                                                color="#F59E0B"
                                            />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.fieldLabel}>
                                                    Destination Account
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.fieldValue,
                                                        !destAcc && styles.fieldPlaceholder,
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    {destAcc
                                                        ? destAcc.name
                                                        : 'Select destination account'}
                                                </Text>
                                            </View>
                                        </View>
                                        <IconSymbol
                                            name="chevron.right"
                                            size={18}
                                            color="#9CA3AF"
                                        />
                                    </TouchableOpacity>
                                ) : null}

                                <TouchableOpacity
                                    style={styles.fieldRow}
                                    onPress={() => setShowCategorySheet(true)}
                                    disabled={saving}
                                >
                                    <View style={styles.fieldLeft}>
                                        <IconSymbol name="tag.fill" size={18} color={accent} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.fieldLabel}>Category</Text>
                                            <Text
                                                style={[
                                                    styles.fieldValue,
                                                    !catDisplay && styles.fieldPlaceholder,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {catDisplay || 'Select category & subcategory'}
                                            </Text>
                                        </View>
                                    </View>
                                    <IconSymbol name="chevron.right" size={18} color="#9CA3AF" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.fieldRow, { borderBottomWidth: 0 }]}
                                    onPress={() => setShowDateSheet(true)}
                                    disabled={saving}
                                >
                                    <View style={styles.fieldLeft}>
                                        <IconSymbol
                                            name="calendar"
                                            size={18}
                                            color={isDark ? '#60A5FA' : '#2563EB'}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.fieldLabel}>Date</Text>
                                            <Text style={styles.fieldValue} numberOfLines={1}>
                                                {formatDisplayDate(draft.transactionDateMs)}
                                            </Text>
                                        </View>
                                    </View>
                                    <IconSymbol name="chevron.right" size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>

                            {/* Note */}
                            <View style={styles.noteBox}>
                                <Text style={styles.fieldLabel}>Note / Description</Text>
                                <TextInput
                                    style={styles.noteInput}
                                    value={draft.note}
                                    onChangeText={(v) => patchDraft({ note: v })}
                                    placeholder="Optional note..."
                                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                                    maxLength={250}
                                    editable={!saving}
                                />
                            </View>
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.footerRow}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={onClose}
                                disabled={saving}
                            >
                                <Text style={styles.cancelBtnText}>Discard</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                                onPress={handleConfirmSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save Transaction</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <BottomPickerSheet
                visible={visible && showSourceSheet}
                title="Select Source Account"
                items={accountItems}
                selectedId={effectiveSourceId}
                onSelect={(id) => patchDraft({ accountId: id })}
                onClose={() => setShowSourceSheet(false)}
            />

            <BottomPickerSheet
                visible={visible && showDestSheet}
                title="Select Destination Account"
                items={accountItems}
                selectedId={draft.toAccountId}
                onSelect={(id) => patchDraft({ toAccountId: id })}
                onClose={() => setShowDestSheet(false)}
            />

            <CategoryPickerSheet
                visible={visible && showCategorySheet}
                title={`Select ${txType} Category`}
                categories={availableCategories}
                selectedCategoryId={draft.categoryId}
                selectedSubCategory={draft.subcategoryName}
                onSelect={(catId, subCat) =>
                    patchDraft({ categoryId: catId, subcategoryName: subCat })
                }
                onClose={() => setShowCategorySheet(false)}
            />

            <DatePickerSheet
                visible={visible && showDateSheet}
                selectedDate={new Date(draft.transactionDateMs)}
                onSelect={(d) => patchDraft({ transactionDateMs: d.getTime() })}
                onClose={() => setShowDateSheet(false)}
            />
        </>
    );
}

const createStyles = (isDark: boolean) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0, 0, 0, 0.58)',
        },
        backdrop: {
            flex: 1,
        },
        sheet: {
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 10,
            maxHeight: '92%',
            maxWidth: 640,
            width: '100%',
            alignSelf: 'center',
        },
        handleBar: {
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: isDark ? '#4B5563' : '#D1D5DB',
            alignSelf: 'center',
            marginBottom: 10,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#374151' : '#E5E7EB',
        },
        title: {
            fontSize: 20,
            fontWeight: '800',
            color: isDark ? '#F9FAFB' : '#111827',
        },
        latencyText: {
            fontSize: 12,
            fontWeight: '600',
            color: '#10B981',
            marginTop: 2,
        },
        scrollArea: {
            flexGrow: 0,
        },
        scrollContent: {
            paddingHorizontal: 20,
            paddingVertical: 14,
            gap: 14,
        },
        voiceBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: 14,
            backgroundColor: isDark ? '#111827' : '#EFF6FF',
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#BFDBFE',
        },
        voiceBannerLabel: {
            fontSize: 11,
            fontWeight: '700',
            color: isDark ? '#93C5FD' : '#2563EB',
            textTransform: 'uppercase',
        },
        voiceBannerText: {
            fontSize: 13,
            color: isDark ? '#E5E7EB' : '#1E3A8A',
            marginTop: 2,
            fontStyle: 'italic',
        },
        voiceRefineBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#2563EB',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 18,
        },
        voiceRefineBtnText: {
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '700',
        },
        errorBanner: {
            padding: 10,
            borderRadius: 10,
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
            borderWidth: 1,
            borderColor: isDark ? '#EF4444' : '#FECACA',
        },
        errorText: {
            fontSize: 12,
            fontWeight: '600',
            color: isDark ? '#FCA5A5' : '#B91C1C',
        },
        warningBanner: {
            padding: 10,
            borderRadius: 10,
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB',
            borderWidth: 1,
            borderColor: isDark ? '#F59E0B' : '#FDE68A',
        },
        warningText: {
            fontSize: 12,
            fontWeight: '600',
            color: isDark ? '#FCD34D' : '#92400E',
        },
        segmentedRow: {
            flexDirection: 'row',
            backgroundColor: isDark ? '#111827' : '#E5E7EB',
            borderRadius: 12,
            padding: 4,
        },
        segmentBtn: {
            flex: 1,
            paddingVertical: 9,
            alignItems: 'center',
            borderRadius: 9,
        },
        segmentBtnActive: {
            backgroundColor: isDark ? '#374151' : '#FFFFFF',
        },
        segmentText: {
            fontSize: 13,
            fontWeight: '600',
            color: isDark ? '#9CA3AF' : '#6B7280',
        },
        amountCard: {
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
        },
        amountLabel: {
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            color: isDark ? '#9CA3AF' : '#6B7280',
        },
        amountRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 4,
        },
        currency: {
            fontSize: 28,
            fontWeight: '800',
            marginRight: 4,
        },
        amountInput: {
            fontSize: 32,
            fontWeight: '800',
            color: isDark ? '#F9FAFB' : '#111827',
            minWidth: 110,
            textAlign: 'center',
            paddingVertical: 2,
        },
        fieldsCard: {
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
            overflow: 'hidden',
        },
        fieldRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#1F2937' : '#E5E7EB',
        },
        fieldLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            flex: 1,
            marginRight: 8,
        },
        fieldLabel: {
            fontSize: 11,
            fontWeight: '600',
            color: isDark ? '#9CA3AF' : '#6B7280',
        },
        fieldValue: {
            fontSize: 14,
            fontWeight: '600',
            color: isDark ? '#F9FAFB' : '#111827',
            marginTop: 1,
        },
        fieldPlaceholder: {
            color: isDark ? '#6B7280' : '#9CA3AF',
            fontWeight: '500',
        },
        noteBox: {
            backgroundColor: isDark ? '#111827' : '#F9FAFB',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
            padding: 12,
        },
        noteInput: {
            fontSize: 14,
            color: isDark ? '#F9FAFB' : '#111827',
            marginTop: 6,
            paddingVertical: 4,
        },
        footerRow: {
            flexDirection: 'row',
            gap: 12,
            paddingHorizontal: 20,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: isDark ? '#374151' : '#E5E7EB',
        },
        cancelBtn: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: isDark ? '#374151' : '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
        },
        cancelBtnText: {
            fontSize: 15,
            fontWeight: '700',
            color: isDark ? '#E5E7EB' : '#4B5563',
        },
        saveBtn: {
            flex: 2,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: '#3B82F6',
            alignItems: 'center',
            justifyContent: 'center',
        },
        saveBtnText: {
            fontSize: 15,
            fontWeight: '700',
            color: '#FFFFFF',
        },
    });
