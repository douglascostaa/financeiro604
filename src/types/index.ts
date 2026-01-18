export type Transaction = {
    id: string;
    created_at: string;
    description: string;
    amount: number;
    date: string;
    category: string;
    paid_by: 'Douglas' | 'Lara';
    is_shared: boolean;
};

export type DashboardStats = {
    total: number;
    douglasPaid: number;
    laraPaid: number;
    balance: number; // Positive means Douglas owes Lara (or vice versa depending on logic)
};
