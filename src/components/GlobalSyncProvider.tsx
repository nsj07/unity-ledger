import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

import { setAccounts } from '../store/accountsSlice';
import { setCategories } from '../store/categoriesSlice';
import { setTransactions } from '../store/transactionsSlice';
import { setInvestments } from '../store/investmentsSlice';

export default function GlobalSyncProvider({ children }: { children: React.ReactNode }) {
    const dispatch = useDispatch();
    const { householdId } = useSelector((state: any) => state.auth);

    useEffect(() => {
        if (!householdId) return;

        // 1. Sync Accounts
        const accountsRef = collection(db, 'households', householdId, 'accounts');
        const unsubscribeAccounts = onSnapshot(
            accountsRef,
            (snapshot) => {
                const accountsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                dispatch(setAccounts(accountsData));
            },
            (error) => console.error('[SYNC_ACCOUNTS_ERROR]:', error.message)
        );

        // 2. Sync Categories
        const categoriesRef = collection(db, 'households', householdId, 'categories');
        const unsubscribeCategories = onSnapshot(
            categoriesRef,
            (snapshot) => {
                const categoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                dispatch(setCategories(categoriesData));
            },
            (error) => console.error('[SYNC_CATEGORIES_ERROR]:', error.message)
        );

        // 3. Sync Transactions
        const transactionsQuery = query(
            collection(db, 'households', householdId, 'transactions'),
            orderBy('created_at', 'desc')
        );
        const unsubscribeTransactions = onSnapshot(
            transactionsQuery,
            (snapshot) => {
                const transactionsData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        // Serialize timestamp for Redux
                        created_at: data.created_at?.toMillis ? data.created_at.toMillis() : Date.now()
                    };
                });
                dispatch(setTransactions(transactionsData));
            },
            (error) => console.error('[SYNC_TRANSACTIONS_ERROR]:', error.message)
        );

        // 4. Sync Investments
        const investmentsRef = collection(db, 'households', householdId, 'investments');
        const unsubscribeInvestments = onSnapshot(
            investmentsRef,
            (snapshot) => {
                const investmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                dispatch(setInvestments(investmentsData));
            },
            (error) => console.error('[SYNC_INVESTMENTS_ERROR]:', error.message)
        );

        // Cleanup listeners when unmounting or changing households
        return () => {
            unsubscribeAccounts();
            unsubscribeCategories();
            unsubscribeTransactions();
            unsubscribeInvestments();
        };
    }, [householdId, dispatch]);

    // Wrap children, acts as a headless data fetcher
    return <>{children}</>;
}
