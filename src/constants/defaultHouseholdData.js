export const DEFAULT_ACCOUNTS = [
    { name: 'Cash', type: 'Cash', balance: 0 },
    { name: 'Bank Account', type: 'Checking', balance: 0 },
    { name: 'Savings', type: 'Savings', balance: 0 },
];

export const DEFAULT_CATEGORIES = [
    // Expense categories
    {
        name: 'Food & Dining',
        type: 'Expense',
        subcategories: ['Groceries', 'Restaurants', 'Coffee & Snacks'],
    },
    {
        name: 'Housing & Utilities',
        type: 'Expense',
        subcategories: ['Rent / Mortgage', 'Electricity', 'Internet & Phone', 'Maintenance'],
    },
    {
        name: 'Transportation',
        type: 'Expense',
        subcategories: ['Fuel', 'Public Transit', 'Cab / Auto', 'Parking'],
    },
    {
        name: 'Shopping',
        type: 'Expense',
        subcategories: ['Clothing', 'Electronics', 'Home Goods'],
    },
    {
        name: 'Health & Medical',
        type: 'Expense',
        subcategories: ['Doctor', 'Pharmacy', 'Insurance'],
    },
    {
        name: 'Entertainment',
        type: 'Expense',
        subcategories: ['Movies & Streaming', 'Outings', 'Hobbies'],
    },
    {
        name: 'Bills & Subscriptions',
        type: 'Expense',
        subcategories: ['Subscriptions', 'EMI', 'Other Bills'],
    },
    {
        name: 'Education',
        type: 'Expense',
        subcategories: ['Courses', 'Books', 'Tuition'],
    },
    {
        name: 'Other Expense',
        type: 'Expense',
        subcategories: [],
    },
    // Income categories
    {
        name: 'Salary',
        type: 'Income',
        subcategories: ['Monthly Pay', 'Bonus'],
    },
    {
        name: 'Business & Freelance',
        type: 'Income',
        subcategories: ['Client Payment', 'Side Income'],
    },
    {
        name: 'Investments & Dividends',
        type: 'Income',
        subcategories: ['Dividends', 'Interest', 'Capital Gains'],
    },
    {
        name: 'Gifts & Refunds',
        type: 'Income',
        subcategories: ['Cashback', 'Refund', 'Gift'],
    },
    {
        name: 'Other Income',
        type: 'Income',
        subcategories: [],
    },
    // Transfer category
    {
        name: 'Account Transfer',
        type: 'Transfer',
        subcategories: ['Self Transfer', 'Credit Card Payment'],
    },
];
