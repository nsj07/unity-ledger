import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { db } from '../config/firebase';

import { HouseholdService } from '../services/HouseholdService';
import { setAccounts } from '../store/accountsSlice';
import { setHouseholdContext, setHouseholdMembers } from '../store/authSlice';
import { setCategories } from '../store/categoriesSlice';
import { setInvestments } from '../store/investmentsSlice';
import { setTransactions } from '../store/transactionsSlice';

const ROLE_ORDER: Record<string, number> = {
    leader: 0,
    'co-leader': 1,
    member: 2,
};

export default function GlobalSyncProvider({ children }: { children: React.ReactNode }) {
    const dispatch = useDispatch();
    const { user, householdId } = useSelector((state: any) => state.auth);

    useEffect(() => {
        if (!householdId || !user?.uid) {
            dispatch(setAccounts([]));
            dispatch(setCategories([]));
            dispatch(setTransactions([]));
            dispatch(setInvestments([]));
            dispatch(setHouseholdMembers([]));
            return;
        }

        let didBackfillDisplayName = false;

        // 0. Sync Household metadata, live member list, and live role/access for current user
        const householdRef = doc(db, 'households', householdId);
        const unsubscribeHousehold = onSnapshot(
            householdRef,
            (snapshot) => {
                if (!snapshot.exists()) return;
                const hhData = snapshot.data();
                const membersMap = hhData.members || {};

                const membersList = Object.entries(membersMap)
                    .map(([uid, info]: [string, any]) => {
                        const role = info?.role || 'member';
                        const access =
                            role === 'leader' || role === 'co-leader'
                                ? 'read-write'
                                : (info?.access || 'read-write');
                        const displayName =
                            info?.display_name ||
                            (uid === user.uid && user.displayName ? user.displayName : 'Household Member');

                        return {
                            uid,
                            displayName,
                            role,
                            access,
                        };
                    })
                    .sort((a, b) => {
                        const rankDiff = (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3);
                        if (rankDiff !== 0) return rankDiff;
                        return a.displayName.localeCompare(b.displayName);
                    });

                dispatch(setHouseholdMembers(membersList));

                const myEntry = membersMap[user.uid];
                if (myEntry) {
                    const myRole = myEntry.role || 'member';
                    const myAccess =
                        myRole === 'leader' || myRole === 'co-leader'
                            ? 'read-write'
                            : (myEntry.access || 'read-write');

                    dispatch(setHouseholdContext({
                        householdId,
                        householdName: hhData.name || 'Household',
                        householdRole: myRole,
                        householdAccess: myAccess,
                    }));

                    if (!myEntry.display_name && user.displayName && !didBackfillDisplayName) {
                        didBackfillDisplayName = true;
                        HouseholdService.syncOwnDisplayName(householdId, user.uid, user.displayName);
                    }
                }
            },
            (error) => console.error('[SYNC_HOUSEHOLD_ERROR]:', error.message)
        );

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
                        // Serialize timestamps for Redux
                        created_at: data.created_at?.toMillis ? data.created_at.toMillis() : Date.now(),
                        transaction_date: data.transaction_date?.toMillis
                            ? data.transaction_date.toMillis()
                            : (data.created_at?.toMillis ? data.created_at.toMillis() : Date.now()),
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
            unsubscribeHousehold();
            unsubscribeAccounts();
            unsubscribeCategories();
            unsubscribeTransactions();
            unsubscribeInvestments();
        };
    }, [householdId, user?.uid, user?.displayName, dispatch]);

    // Wrap children, acts as a headless data fetcher
    return <>{children}</>;
}
