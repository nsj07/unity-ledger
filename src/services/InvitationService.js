import { doc, setDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;
const INVITE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateRawCode() {
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
        const index = Math.floor(Math.random() * INVITE_ALPHABET.length);
        code += INVITE_ALPHABET[index];
    }
    return code;
}

export function normalizeInviteCode(rawCode) {
    if (typeof rawCode !== 'string') return '';
    return rawCode.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export function formatInviteCode(code) {
    const clean = normalizeInviteCode(code);
    if (clean.length === 8) {
        return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    return clean;
}

export function buildInviteShareMessage({ inviterName, householdName, code }) {
    const displayInviter = (inviterName || 'A household leader').trim();
    const displayHousehold = (householdName || 'our household').trim();
    const formattedCode = formatInviteCode(code);
    return `${displayInviter} has invited you to join the "${displayHousehold}" household on Unity Ledger!\n\nUse invite code: ${formattedCode}\n(Single-use code, expires in 24 hours)`;
}

export const InvitationService = {
    /**
     * Generates a unique, single-use, 24-hour invitation code for a household.
     * Enforced server-side in Firestore Rules to allow only household leaders.
     */
    createInvitation: async ({ householdId, householdName, userId, userName }) => {
        try {
            if (!householdId || !userId) {
                return { error: 'Missing household or user context.' };
            }

            const code = generateRawCode();
            const createdAt = new Date();
            const expiresAt = new Date(createdAt.getTime() + INVITE_TTL_MS);
            const cleanHouseholdName = (householdName || 'Household').trim().slice(0, 100);
            const cleanUserName = (userName || 'Household Leader').trim().slice(0, 100);

            const inviteRef = doc(db, 'invitations', code);
            await setDoc(inviteRef, {
                code,
                household_id: householdId,
                household_name: cleanHouseholdName,
                created_by: userId,
                created_by_name: cleanUserName,
                status: 'active',
                created_at: Timestamp.fromDate(createdAt),
                expires_at: Timestamp.fromDate(expiresAt),
                used_by: null,
                used_at: null,
            });

            const formattedCode = formatInviteCode(code);
            const shareMessage = buildInviteShareMessage({
                inviterName: cleanUserName,
                householdName: cleanHouseholdName,
                code,
            });

            return {
                code,
                formattedCode,
                expiresAt: expiresAt.getTime(),
                shareMessage,
                error: null,
            };
        } catch (error) {
            console.error('CREATE_INVITATION_ERROR:', error);
            if (error?.code === 'permission-denied') {
                return { error: 'Only the household leader can generate invitation codes.' };
            }
            return { error: error?.message || 'Failed to generate invitation code.' };
        }
    },

    /**
     * Atomically redeems a single-use, unexpired invitation code and adds the user
     * as a 'member' of the target household.
     */
    redeemInvitation: async (userId, rawCode, userDisplayName = 'Member') => {
        try {
            const code = normalizeInviteCode(rawCode);
            if (!code || code.length < 6) {
                return { success: false, error: 'Please enter a valid invitation code.' };
            }
            const cleanDisplayName = (userDisplayName || 'Member').trim().slice(0, 100);

            const result = await runTransaction(db, async (transaction) => {
                const inviteRef = doc(db, 'invitations', code);
                const inviteSnap = await transaction.get(inviteRef);

                if (!inviteSnap.exists()) {
                    throw new Error('INVALID_CODE');
                }

                const inviteData = inviteSnap.data();

                if (inviteData.status !== 'active' || inviteData.used_by !== null) {
                    throw new Error('ALREADY_USED');
                }

                const expiresMs = inviteData.expires_at?.toMillis
                    ? inviteData.expires_at.toMillis()
                    : new Date(inviteData.expires_at).getTime();

                if (Number.isNaN(expiresMs) || expiresMs <= Date.now()) {
                    throw new Error('EXPIRED_CODE');
                }

                const householdId = inviteData.household_id;
                const householdRef = doc(db, 'households', householdId);
                const householdSnap = await transaction.get(householdRef);

                if (!householdSnap.exists()) {
                    throw new Error('HOUSEHOLD_NOT_FOUND');
                }

                const householdData = householdSnap.data();
                const existingMemberIds = Array.isArray(householdData.memberIds)
                    ? householdData.memberIds
                    : Object.keys(householdData.members || {});

                if (
                    existingMemberIds.includes(userId) ||
                    (householdData.members && Object.prototype.hasOwnProperty.call(householdData.members, userId))
                ) {
                    throw new Error('ALREADY_MEMBER');
                }

                const updatedMembers = {
                    ...(householdData.members || {}),
                    [userId]: {
                        role: 'member',
                        access: 'read-write',
                        display_name: cleanDisplayName,
                        invite_code: code,
                    },
                };
                const updatedMemberIds = [...existingMemberIds, userId];

                transaction.update(inviteRef, {
                    status: 'used',
                    used_by: userId,
                    used_at: Timestamp.fromDate(new Date()),
                });

                transaction.update(householdRef, {
                    members: updatedMembers,
                    memberIds: updatedMemberIds,
                });

                return {
                    householdId,
                    householdName: householdData.name || inviteData.household_name || 'Household',
                    role: 'member',
                };
            });

            // Link user's active household after transaction commits so users/{uid} rule sees committed membership
            const userDocRef = doc(db, 'users', userId);
            await setDoc(userDocRef, { household_id: result.householdId }, { merge: true });

            return {
                success: true,
                householdId: result.householdId,
                householdName: result.householdName,
                role: result.role,
                error: null,
            };
        } catch (error) {
            console.error('REDEEM_INVITATION_ERROR:', error);
            const codeMap = {
                INVALID_CODE: 'Invalid invitation code. Please double-check and try again.',
                ALREADY_USED: 'This invitation code has already been used.',
                EXPIRED_CODE: 'This invitation code has expired. Ask your household leader for a new one.',
                HOUSEHOLD_NOT_FOUND: 'The household for this invitation no longer exists.',
                ALREADY_MEMBER: 'You are already a member of this household.',
            };
            const friendlyMessage = codeMap[error?.message] || error?.message || 'Failed to join household.';
            return { success: false, error: friendlyMessage };
        }
    },
};
