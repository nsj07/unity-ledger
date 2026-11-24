import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    SectionList,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import VoiceAiSettingsSection from '@/src/components/voice/VoiceAiSettingsSection';
import { selectIsVoiceEntryReadyAndEnabled } from '@/src/store/voiceAiSlice';
import { CategoryService } from '../../src/services/CategoryService';
import { setCategories, setLoading, setError } from '../../src/store/categoriesSlice';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { createStyles } from './categories.styles';

const CATEGORY_TYPES = ['Expense', 'Income', 'Transfer', 'Investment'] as const;
type FilterType = 'All' | (typeof CATEGORY_TYPES)[number];
const FILTER_TABS: FilterType[] = ['All', ...CATEGORY_TYPES];

export default function CategoriesScreen() {
    const colorScheme = useColorScheme();
    const styles = createStyles(colorScheme);

    const { householdId, householdRole, householdAccess } = useSelector((state: any) => state.auth);
    const { categories, isLoading } = useSelector((state: any) => state.categories);
    const isVoiceReadyAndEnabled = useSelector(selectIsVoiceEntryReadyAndEnabled);
    const isReadOnly = householdRole !== 'leader' && householdRole !== 'co-leader' && householdAccess === 'read-only';
    const dispatch = useDispatch();
    const { tab } = useLocalSearchParams<{ tab?: string }>();

    const [manualSection, setManualSection] = useState<'categories' | 'voice' | null>(null);
    const settingsSection: 'categories' | 'voice' =
        manualSection ?? (tab === 'voice' ? 'voice' : 'categories');
    const setSettingsSection = (next: 'categories' | 'voice') => setManualSection(next);

    // Filter State
    const [activeFilter, setActiveFilter] = useState<FilterType>('All');

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editCatId, setEditCatId] = useState<string | null>(null);

    // Form State
    const [newCatName, setNewCatName] = useState('');
    const [newCatType, setNewCatType] = useState('Expense');
    const [subcategories, setSubcategories] = useState<string[]>([]);
    const [subCatInput, setSubCatInput] = useState('');

    const loadCategories = useCallback(async () => {
        dispatch(setLoading(true));
        const response = await CategoryService.getCategories(householdId);
        dispatch(setLoading(false));

        if (response.error) {
            dispatch(setError(response.error));
            Alert.alert("Error Loading Categories", response.error);
        } else {
            dispatch(setCategories(response.categories));
        }
    }, [dispatch, householdId]);

    useEffect(() => {
        if (householdId) {
            loadCategories();
        }
    }, [householdId, loadCategories]);

    const openAddModal = () => {
        setIsEditing(false);
        setEditCatId(null);
        setNewCatName('');
        setNewCatType(activeFilter === 'All' ? 'Expense' : activeFilter);
        setSubcategories([]);
        setSubCatInput('');
        setModalVisible(true);
    };

    const openEditModal = (category: any) => {
        setIsEditing(true);
        setEditCatId(category.id);
        setNewCatName(category.name);
        setNewCatType(category.type);
        setSubcategories(category.subcategories || []);
        setSubCatInput('');
        setModalVisible(true);
    };

    const handleAddSubcat = () => {
        if (subCatInput.trim() && !subcategories.includes(subCatInput.trim())) {
            setSubcategories([...subcategories, subCatInput.trim()]);
            setSubCatInput('');
        }
    };

    const handleRemoveSubcat = (item: string) => {
        setSubcategories(subcategories.filter(sc => sc !== item));
    };

    const handleSaveCategory = async () => {
        if (!newCatName.trim()) {
            Alert.alert("Missing Info", "Please provide a category name.");
            return;
        }

        const payload = {
            name: newCatName.trim(),
            type: newCatType,
            subcategories: subcategories
        };

        let response;
        if (isEditing && editCatId) {
            response = await CategoryService.updateCategory(householdId, editCatId, payload);
        } else {
            response = await CategoryService.createCategory(householdId, payload);
        }

        if (response.error) {
            Alert.alert("Error", response.error);
        } else {
            setModalVisible(false);
            loadCategories(); // Reload the Redux state
        }
    };

    const handleDeleteCategory = (id: string, name: string) => {
        const runDelete = async () => {
            const response = await CategoryService.deleteCategory(householdId, id);
            if (!response.error) {
                loadCategories();
                setModalVisible(false);
            } else {
                Alert.alert("Error", response.error);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Delete '${name}'? Existing transactions will retain the name but lose category mapping.`)) {
                runDelete();
            }
            return;
        }

        Alert.alert(
            "Delete Category",
            `Are you sure you want to delete '${name}'? Existing transactions will retain the name but lose category mapping.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: runDelete
                }
            ]
        );
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Expense': return '#EF4444';
            case 'Income': return '#10B981';
            case 'Transfer': return '#F59E0B';
            case 'Investment': return '#3B82F6';
            default: return '#6B7280';
        }
    };

    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = { All: (categories || []).length };
        CATEGORY_TYPES.forEach((t) => {
            counts[t] = 0;
        });
        (categories || []).forEach((cat: any) => {
            const t = cat.type || 'Other';
            counts[t] = (counts[t] || 0) + 1;
        });
        return counts;
    }, [categories]);

    const sections = useMemo(() => {
        const list = categories || [];
        const typesToShow =
            activeFilter === 'All' ? [...CATEGORY_TYPES] : [activeFilter];

        const grouped: { title: string; color: string; data: any[] }[] = typesToShow
            .map((type) => ({
                title: type as string,
                color: getTypeColor(type),
                data: list
                    .filter((c: any) => c.type === type)
                    .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')),
            }))
            .filter((section) => section.data.length > 0);

        if (activeFilter === 'All') {
            const knownTypes = new Set<string>(CATEGORY_TYPES);
            const others = list
                .filter((c: any) => !knownTypes.has(c.type))
                .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
            if (others.length > 0) {
                grouped.push({
                    title: 'Other',
                    color: '#6B7280',
                    data: others,
                });
            }
        }

        return grouped;
    }, [categories, activeFilter]);

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) + '20' }]}>
                        <Text style={[styles.typeBadgeText, { color: getTypeColor(item.type) }]}>{item.type}</Text>
                    </View>
                </View>
                {!isReadOnly ? (
                    <View style={styles.cardActions}>
                        <TouchableOpacity style={styles.iconButton} onPress={() => openEditModal(item)}>
                            <IconSymbol name="pencil" size={20} color="#6B7280" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteCategory(item.id, item.name)}>
                            <IconSymbol name="trash.fill" size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>

            {item.subcategories && item.subcategories.length > 0 && (
                <View style={styles.subcategoriesContainer}>
                    {item.subcategories.map((sub: string, index: number) => (
                        <View key={index} style={styles.subBadge}>
                            <Text style={styles.subBadgeText}>{sub}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>
                    {settingsSection === 'categories' ? 'Categories' : 'Voice & Local AI'}
                </Text>
                {settingsSection === 'categories' && !isReadOnly ? (
                    <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                        <IconSymbol name="plus" size={18} color="#FFF" />
                        <Text style={styles.addButtonText}>New</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Settings Top Section Switcher */}
            <View style={styles.settingsTabsBar}>
                <TouchableOpacity
                    style={[
                        styles.settingsTabBtn,
                        settingsSection === 'categories' && styles.settingsTabBtnActive,
                    ]}
                    onPress={() => setSettingsSection('categories')}
                    activeOpacity={0.8}
                >
                    <IconSymbol
                        name="tag.fill"
                        size={16}
                        color={settingsSection === 'categories' ? '#3B82F6' : '#6B7280'}
                    />
                    <Text
                        style={[
                            styles.settingsTabText,
                            settingsSection === 'categories' && styles.settingsTabTextActive,
                        ]}
                    >
                        Categories
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.settingsTabBtn,
                        settingsSection === 'voice' && styles.settingsTabBtnActive,
                    ]}
                    onPress={() => setSettingsSection('voice')}
                    activeOpacity={0.8}
                >
                    <IconSymbol
                        name="mic.fill"
                        size={16}
                        color={settingsSection === 'voice' ? '#3B82F6' : '#6B7280'}
                    />
                    <Text
                        style={[
                            styles.settingsTabText,
                            settingsSection === 'voice' && styles.settingsTabTextActive,
                        ]}
                    >
                        Voice & Local AI
                    </Text>
                    {isVoiceReadyAndEnabled ? <View style={styles.voiceReadyDot} /> : null}
                </TouchableOpacity>
            </View>

            {settingsSection === 'voice' ? (
                <VoiceAiSettingsSection />
            ) : (
                <>
                    {/* Type Filter Tabs */}
                    <View style={styles.filterBarWrapper}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterBar}
                >
                    {FILTER_TABS.map((tab) => {
                        const isActive = activeFilter === tab;
                        const accentColor = tab === 'All' ? '#3B82F6' : getTypeColor(tab);
                        const count = typeCounts[tab] || 0;
                        return (
                            <TouchableOpacity
                                key={tab}
                                style={[
                                    styles.filterChip,
                                    isActive && {
                                        backgroundColor: accentColor,
                                        borderColor: accentColor,
                                    },
                                ]}
                                onPress={() => setActiveFilter(tab)}
                                activeOpacity={0.75}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        isActive && styles.filterChipTextActive,
                                    ]}
                                >
                                    {tab}
                                </Text>
                                <View
                                    style={[
                                        styles.filterCountBadge,
                                        isActive && styles.filterCountBadgeActive,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.filterCountText,
                                            isActive && styles.filterCountTextActive,
                                        ]}
                                    >
                                        {count}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {isLoading ? (
                <Text style={styles.loading}>Loading configurations...</Text>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    renderSectionHeader={({ section }) => (
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionHeaderLeft}>
                                <View
                                    style={[
                                        styles.sectionDot,
                                        { backgroundColor: section.color },
                                    ]}
                                />
                                <Text style={styles.sectionTitle}>{section.title}</Text>
                            </View>
                            <View
                                style={[
                                    styles.sectionCountPill,
                                    { backgroundColor: section.color + '20' },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.sectionCountText,
                                        { color: section.color },
                                    ]}
                                >
                                    {section.data.length}{' '}
                                    {section.data.length === 1 ? 'category' : 'categories'}
                                </Text>
                            </View>
                        </View>
                    )}
                    stickySectionHeadersEnabled={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>
                            {activeFilter === 'All'
                                ? 'No categories configured.'
                                : `No ${activeFilter} categories configured yet.`}
                        </Text>
                    }
                />
            )}
                </>
            )}

            {/* Editor Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalTitle}>{isEditing ? 'Edit Category' : 'Create Category'}</Text>

                            <Text style={styles.inputLabel}>Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="E.g., Groceries"
                                placeholderTextColor={colorScheme === 'dark' ? '#6B7280' : '#9CA3AF'}
                                value={newCatName}
                                onChangeText={setNewCatName}
                            />

                            <Text style={styles.inputLabel}>Type</Text>
                            <View style={styles.segmentedRow}>
                                {CATEGORY_TYPES.map(type => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[styles.segmentButton, newCatType === type && styles.segmentButtonActive]}
                                        onPress={() => setNewCatType(type)}
                                    >
                                        <Text style={[styles.segmentText, newCatType === type && styles.segmentTextActive]}>{type}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Subcategories</Text>
                            <View style={styles.subcatAddRow}>
                                <TextInput
                                    style={[styles.input, styles.subcatInput]}
                                    placeholder="Add subcategory (e.g., Staples)"
                                    placeholderTextColor={colorScheme === 'dark' ? '#6B7280' : '#9CA3AF'}
                                    value={subCatInput}
                                    onChangeText={setSubCatInput}
                                    onSubmitEditing={handleAddSubcat} // Add on enter
                                />
                                <TouchableOpacity style={styles.subcatAddBtn} onPress={handleAddSubcat}>
                                    <IconSymbol name="plus" size={20} color="#FFF" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.subcatChipsRow}>
                                {subcategories.map((sub, index) => (
                                    <View key={index} style={styles.removableChip}>
                                        <Text style={styles.removableChipText}>{sub}</Text>
                                        <TouchableOpacity onPress={() => handleRemoveSubcat(sub)}>
                                            <IconSymbol name="xmark.circle.fill" size={16} color="#9CA3AF" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                {isEditing ? (
                                    <TouchableOpacity style={styles.deleteModalBtn} onPress={() => handleDeleteCategory(editCatId!, newCatName)}>
                                        <Text style={styles.saveBtnText}>Delete</Text>
                                    </TouchableOpacity>
                                ) : null}
                                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCategory}>
                                    <Text style={styles.saveBtnText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
