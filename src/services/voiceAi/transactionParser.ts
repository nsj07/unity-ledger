import type {
    HouseholdAccountRef,
    HouseholdCategoryRef,
    LlmJsonCompletionRequest,
    ParsedTransactionDraft,
    TransactionType,
} from './types';

const WEEKDAY_NAMES = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

export function formatIsoDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function parseIsoDateLocal(iso: string, fallbackMs: number): number {
    const trimmed = (iso || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (!match) return fallbackMs;

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    if (month < 0 || month > 11 || day < 1 || day > 31) return fallbackMs;

    const now = new Date();
    if (
        year === now.getFullYear() &&
        month === now.getMonth() &&
        day === now.getDate()
    ) {
        return now.getTime();
    }

    const candidate = new Date(year, month, day, 12, 0, 0, 0);
    if (isNaN(candidate.getTime())) return fallbackMs;
    return candidate.getTime();
}

/**
 * Expands Indian & English shorthand numbers in a non-destructive hint string
 * so small LLMs reliably extract amounts like "2.5k", "1.2 lakh", "₹450", "rs 1,200".
 */
export function buildNormalizationHints(transcript: string, now = new Date()): string {
    const hints: string[] = [];
    const cleaned = transcript.replace(/,/g, '');

    // Shorthand multipliers: 2.5k, 1.5 lakh / lac, 2 cr
    const kMatch = cleaned.match(/\b(\d+(?:\.\d+)?)\s*k\b/i);
    if (kMatch) {
        const val = Math.round( parseFloat(kMatch[1]) * 1000 * 100 ) / 100;
        hints.push(`"${kMatch[0]}" = ${val}`);
    }

    const lakhMatch = cleaned.match(/\b(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)\b/i);
    if (lakhMatch) {
        const val = Math.round( parseFloat(lakhMatch[1]) * 100000 * 100 ) / 100;
        hints.push(`"${lakhMatch[0]}" = ${val}`);
    }

    // Relative date hints
    const lower = transcript.toLowerCase();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date(now);
    dayBefore.setDate(dayBefore.getDate() - 2);

    if (/\bday before yesterday\b/.test(lower)) {
        hints.push(`"day before yesterday" = ${formatIsoDateLocal(dayBefore)}`);
    } else if (/\byesterday\b/.test(lower)) {
        hints.push(`"yesterday" = ${formatIsoDateLocal(yesterday)}`);
    } else if (/\btoday\b/.test(lower)) {
        hints.push(`"today" = ${formatIsoDateLocal(now)}`);
    }

    // Last <weekday> resolution
    for (let i = 0; i < WEEKDAY_NAMES.length; i++) {
        const nameLower = WEEKDAY_NAMES[i].toLowerCase();
        if (lower.includes(nameLower)) {
            const diff = (now.getDay() - i + 7) % 7 || 7;
            const target = new Date(now);
            target.setDate(now.getDate() - diff);
            hints.push(`recent ${WEEKDAY_NAMES[i]} = ${formatIsoDateLocal(target)}`);
        }
    }

    return hints.length > 0 ? `Normalized hints: ${hints.join('; ')}` : '';
}

/**
 * Deterministic fallback amount extractor if a tiny model returns 0 when digits are clearly present.
 */
export function extractFallbackAmount(transcript: string): number | null {
    const cleaned = transcript.replace(/,/g, '');

    const kMatch = cleaned.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/i);
    if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000 * 100) / 100;

    const lakhMatch = cleaned.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)\b/i);
    if (lakhMatch) return Math.round(parseFloat(lakhMatch[1]) * 100000 * 100) / 100;

    // Prefer numbers near currency words/symbols first
    const currencyMatch =
        cleaned.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i) ||
        cleaned.match(/(\d+(?:\.\d+)?)\s*(?:rupees|rupee|rs\.?|inr|bucks)\b/i);
    if (currencyMatch) return parseFloat(currencyMatch[1]);

    // Otherwise first standalone positive number that isn't a 4-digit year like 2026
    const allNums = Array.from(cleaned.matchAll(/\b(\d+(?:\.\d+)?)\b/g)).map((m) =>
        parseFloat(m[1])
    );
    for (const n of allNums) {
        if (n > 0 && !(n >= 2020 && n <= 2035 && transcript.includes('-'))) {
            return n;
        }
    }
    return null;
}

export function buildTransactionJsonSchema(
    accounts: HouseholdAccountRef[],
    categories: HouseholdCategoryRef[],
    isRefinement = false
): Record<string, any> {
    const accountNames = Array.from(
        new Set(accounts.map((a) => (a.name || '').trim()).filter(Boolean))
    );
    const categoryNames = Array.from(
        new Set(categories.map((c) => (c.name || '').trim()).filter(Boolean))
    );
    const subcategoryNames = Array.from(
        new Set(
            categories
                .flatMap((c) => c.subcategories || [])
                .map((s) => (s || '').trim())
                .filter(Boolean)
        )
    );

    const txTypeEnum = isRefinement
        ? ['', 'Expense', 'Income', 'Transfer']
        : ['Expense', 'Income', 'Transfer'];

    return {
        type: 'object',
        properties: {
            tx_type: {
                type: 'string',
                enum: txTypeEnum,
            },
            amount: {
                type: 'number',
            },
            account_name: {
                type: 'string',
                enum: ['', ...accountNames],
            },
            to_account_name: {
                type: 'string',
                enum: ['', ...accountNames],
            },
            category_name: {
                type: 'string',
                enum: ['', ...categoryNames],
            },
            subcategory_name: {
                type: 'string',
                enum: ['', ...subcategoryNames],
            },
            date_iso: {
                type: 'string',
            },
            note: {
                type: 'string',
            },
        },
        required: [
            'tx_type',
            'amount',
            'account_name',
            'to_account_name',
            'category_name',
            'subcategory_name',
            'date_iso',
            'note',
        ],
        additionalProperties: false,
    };
}

export function buildLlmPromptRequest(params: {
    transcript: string;
    accounts: HouseholdAccountRef[];
    categories: HouseholdCategoryRef[];
    currentDraft?: ParsedTransactionDraft | null;
    now?: Date;
}): LlmJsonCompletionRequest {
    const { transcript, accounts, categories, currentDraft, now = new Date() } = params;
    const isRefinement = !!currentDraft;

    const todayIso = formatIsoDateLocal(now);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayIso = formatIsoDateLocal(yesterday);
    const weekday = WEEKDAY_NAMES[now.getDay()];

    const accountListText =
        accounts.length > 0
            ? accounts.map((a) => `- "${a.name}" (${a.type || 'Account'})`).join('\n')
            : '- (none)';

    const categoryLines = categories
        .filter((c) => ['Expense', 'Income', 'Transfer'].includes(c.type))
        .map((c) => {
            const subs =
                c.subcategories && c.subcategories.length > 0
                    ? ` -> subcategories: [${c.subcategories.map((s) => `"${s}"`).join(', ')}]`
                    : '';
            return `- [${c.type}] "${c.name}"${subs}`;
        })
        .join('\n');

    const jsonSchema = buildTransactionJsonSchema(accounts, categories, isRefinement);
    const hints = buildNormalizationHints(transcript, now);

    const systemPrompt = isRefinement
        ? [
              'You update a financial transaction draft based on a spoken voice correction.',
              `Today is ${todayIso} (${weekday}). Yesterday was ${yesterdayIso}.`,
              'Return ONLY a single JSON object matching the schema.',
              'Rules:',
              '- Only populate fields the user wants to change; output "" for unchanged string fields and 0 for amount if amount is unchanged.',
              '- Choose account_name, to_account_name, category_name, and subcategory_name ONLY from the provided household lists (or "").',
              '- For Transfer, account_name is source and to_account_name is destination.',
          ].join('\n')
        : [
              'You extract structured personal finance transactions from spoken voice notes.',
              `Today is ${todayIso} (${weekday}). Yesterday was ${yesterdayIso}.`,
              'Return ONLY a single JSON object matching the schema.',
              'Rules:',
              '- tx_type: "Expense" (spent/paid/bought), "Income" (received/salary/refund/earned), or "Transfer" (moved/transferred between accounts).',
              '- amount: numeric value in INR (0 if unknown).',
              '- account_name: source account from Available Accounts ("" if not mentioned; app will default to Bank Account).',
              '- to_account_name: destination account ONLY when tx_type is "Transfer" (otherwise "").',
              '- category_name & subcategory_name: best matching category/subcategory for tx_type ("" if unsure).',
              `- date_iso: "YYYY-MM-DD" (use "${todayIso}" if today or not mentioned).`,
              '- note: concise clean merchant/purpose description (e.g., "Groceries at BigBasket", "" if nothing extra).',
          ].join('\n');

    const draftContext = currentDraft
        ? `\nCurrent Draft:\n${JSON.stringify({
              tx_type: currentDraft.type,
              amount: Number(currentDraft.amount) || 0,
              account_name:
                  accounts.find((a) => a.id === currentDraft.accountId)?.name || '',
              to_account_name:
                  accounts.find((a) => a.id === currentDraft.toAccountId)?.name || '',
              category_name:
                  categories.find((c) => c.id === currentDraft.categoryId)?.name || '',
              subcategory_name: currentDraft.subcategoryName || '',
              date_iso: formatIsoDateLocal(new Date(currentDraft.transactionDateMs)),
              note: currentDraft.note || '',
          })}\n`
        : '';

    const userPrompt = [
        'Available Accounts:',
        accountListText,
        '',
        'Available Categories:',
        categoryLines || '- (none)',
        draftContext,
        hints ? `${hints}\n` : '',
        `Spoken Input: "${transcript.trim()}"`,
    ]
        .filter(Boolean)
        .join('\n');

    return {
        systemPrompt,
        userPrompt,
        jsonSchema,
        temperature: 0.1,
        maxTokens: 220,
    };
}

/**
 * Safely parses JSON even if a model wraps output in markdown fences or extra text.
 */
export function safeParseLlmJson(rawText: string): Record<string, any> {
    const trimmed = (rawText || '').trim();
    if (!trimmed) {
        throw new Error('Local AI returned an empty response.');
    }

    try {
        return JSON.parse(trimmed);
    } catch {
        // Strip markdown fences or locate outermost { ... }
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            const candidate = trimmed.slice(firstBrace, lastBrace + 1);
            return JSON.parse(candidate);
        }
        throw new Error('Could not parse structured JSON from Local AI output.');
    }
}

function findMatchingAccount(
    name: string | null | undefined,
    accounts: HouseholdAccountRef[]
): HouseholdAccountRef | null {
    const target = (name || '').trim().toLowerCase();
    if (!target) return null;
    return (
        accounts.find((a) => a.name.trim().toLowerCase() === target) ||
        accounts.find(
            (a) =>
                a.name.trim().toLowerCase().includes(target) ||
                target.includes(a.name.trim().toLowerCase())
        ) ||
        null
    );
}

function findDefaultBankAccount(
    accounts: HouseholdAccountRef[]
): HouseholdAccountRef | null {
    if (accounts.length === 0) return null;
    return (
        accounts.find((a) => (a.name || '').trim().toLowerCase() === 'bank account') ||
        accounts.find((a) => (a.name || '').trim().toLowerCase().includes('bank')) ||
        accounts.find((a) => ['checking', 'bank'].includes((a.type || '').trim().toLowerCase())) ||
        accounts[0]
    );
}

export function hydrateTransactionDraft(params: {
    rawJson: Record<string, any>;
    transcript: string;
    accounts: HouseholdAccountRef[];
    categories: HouseholdCategoryRef[];
    currentDraft?: ParsedTransactionDraft | null;
    latencyMs?: number;
    now?: Date;
}): ParsedTransactionDraft {
    const {
        rawJson,
        transcript,
        accounts,
        categories,
        currentDraft,
        latencyMs,
        now = new Date(),
    } = params;

    const warnings: string[] = [];
    const isRefinement = !!currentDraft;

    // 1. Resolve Transaction Type
    let txType: TransactionType = currentDraft?.type || 'Expense';
    if (
        rawJson.tx_type === 'Expense' ||
        rawJson.tx_type === 'Income' ||
        rawJson.tx_type === 'Transfer'
    ) {
        txType = rawJson.tx_type;
    }

    // 2. Resolve Amount
    let numericAmount = typeof rawJson.amount === 'number' ? rawJson.amount : Number(rawJson.amount);
    if ((!numericAmount || numericAmount <= 0) && !isRefinement) {
        const fallbackAmt = extractFallbackAmount(transcript);
        if (fallbackAmt && fallbackAmt > 0) {
            numericAmount = fallbackAmt;
        }
    }

    const amountStr =
        numericAmount && numericAmount > 0
            ? String(numericAmount)
            : currentDraft?.amount || '';

    if (!amountStr) {
        warnings.push('Amount was not detected—please enter it below.');
    }

    // 3. Resolve Source & Destination Accounts (default to Bank Account if unspecified in voice)
    const matchedSource = findMatchingAccount(rawJson.account_name, accounts);
    const defaultAccountId = findDefaultBankAccount(accounts)?.id || '';
    const accountId = matchedSource
        ? matchedSource.id
        : currentDraft?.accountId || defaultAccountId;

    const matchedDest = findMatchingAccount(rawJson.to_account_name, accounts);
    let toAccountId =
        txType === 'Transfer'
            ? matchedDest?.id || currentDraft?.toAccountId || ''
            : '';

    if (txType === 'Transfer' && toAccountId && toAccountId === accountId) {
        toAccountId = '';
        warnings.push('Please verify destination account for this transfer.');
    }

    // 4. Resolve Category & Subcategory (scoped to txType)
    const typedCategories = categories.filter((c) => c.type === txType);
    const rawCatName = (rawJson.category_name || '').trim().toLowerCase();
    const rawSubName = (rawJson.subcategory_name || '').trim();
    const rawSubLower = rawSubName.toLowerCase();

    let matchedCat =
        (rawCatName
            ? typedCategories.find((c) => c.name.trim().toLowerCase() === rawCatName) ||
              typedCategories.find((c) => c.name.trim().toLowerCase().includes(rawCatName))
            : null) || null;

    let resolvedSub = '';

    // If subcategory was detected, verify or infer parent category!
    if (rawSubLower) {
        if (matchedCat && (matchedCat.subcategories || []).some((s) => s.toLowerCase() === rawSubLower)) {
            resolvedSub =
                (matchedCat.subcategories || []).find((s) => s.toLowerCase() === rawSubLower) || '';
        } else {
            // Infer parent category within txType (or even refine txType if unambiguous!)
            const parentInType = typedCategories.find((c) =>
                (c.subcategories || []).some((s) => s.toLowerCase() === rawSubLower)
            );
            if (parentInType) {
                matchedCat = parentInType;
                resolvedSub =
                    (parentInType.subcategories || []).find((s) => s.toLowerCase() === rawSubLower) ||
                    '';
            }
        }
    }

    let categoryId = matchedCat?.id || '';
    if (!categoryId && currentDraft && currentDraft.type === txType) {
        categoryId = currentDraft.categoryId;
        if (!resolvedSub) {
            resolvedSub = currentDraft.subcategoryName;
        }
    }

    // 5. Resolve Date
    const fallbackDateMs = currentDraft ? currentDraft.transactionDateMs : now.getTime();
    const transactionDateMs = rawJson.date_iso
        ? parseIsoDateLocal(String(rawJson.date_iso), fallbackDateMs)
        : fallbackDateMs;

    // 6. Resolve Note
    const rawNote = typeof rawJson.note === 'string' ? rawJson.note.trim() : '';
    const note = rawNote
        ? rawNote.slice(0, 250)
        : currentDraft
          ? currentDraft.note
          : '';

    const combinedTranscript = currentDraft?.rawTranscript
        ? `${currentDraft.rawTranscript} → "${transcript.trim()}"`
        : transcript.trim();

    return {
        type: txType,
        amount: amountStr,
        accountId,
        toAccountId,
        categoryId,
        subcategoryName: resolvedSub,
        transactionDateMs,
        note,
        rawTranscript: combinedTranscript,
        latencyMs,
        warnings,
    };
}
