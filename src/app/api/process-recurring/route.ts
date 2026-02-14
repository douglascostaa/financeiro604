import { createClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
    console.log("Processing recurring expenses...");
    const supabase = createClient();
    const tableName = process.env.NEXT_PUBLIC_TRANSACTIONS_TABLE || 'transactions';

    try {
        // 1. Get active recurring expenses
        const { data: recurring, error } = await supabase
            .from('recurring_expenses')
            .select('*')
            .eq('active', true);

        if (error) throw error;
        if (!recurring || recurring.length === 0) return NextResponse.json({ processed: 0 });

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        let generatedCount = 0;

        for (const expense of recurring) {
            // Check if already generated for this month
            // We can check 'last_generated_date' OR query the transactions table
            // Let's use last_generated_date for simplicity + query check for robustness

            let lastGen = expense.last_generated_date ? new Date(expense.last_generated_date) : null;

            // Should we generate?
            // If never generated, YES.
            // If generated last month (month < currentMonth), YES.
            // If generated this month, NO.

            let needsGeneration = false;

            if (!lastGen) {
                needsGeneration = true;
            } else {
                if (lastGen.getMonth() !== currentMonth || lastGen.getFullYear() !== currentYear) {
                    needsGeneration = true;
                }
            }

            if (needsGeneration) {
                // Double check if transaction exists to avoid duplicates
                // (In case the last_generated_date wasn't updated properly)
                const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
                const endOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString();

                const { data: existing } = await supabase
                    .from(tableName) // Using test table if in test mode
                    .select('id')
                    .eq('description', expense.name)
                    .gte('date', startOfMonth)
                    .lte('date', endOfMonth)
                    .limit(1);

                if (existing && existing.length > 0) {
                    console.log(`Skipping ${expense.name}, already exists.`);
                    // Update last_generated_date just in case
                    await supabase.from('recurring_expenses').update({ last_generated_date: new Date().toISOString() }).eq('id', expense.id);
                    continue;
                }

                // Generate!
                // Construct date: current year, current month, expense day (or today if passed?)
                // Usually subscriptions charge on a specific day.
                // If today is 7th and charge day is 15th, should we generate now? 
                // YES, generate it as "future" transaction or "due" transaction so it appears in the list.

                let targetDate = new Date(currentYear, currentMonth, expense.day_of_month);

                // Handle invalid dates (e.g. Feb 30) -> goes to Mar 2 or Feb 28?
                // JS auto-rolls over. Let's keep it simple.

                const { error: insertError } = await supabase.from(tableName).insert({
                    description: expense.name,
                    amount: expense.amount,
                    category: expense.category,
                    paid_by: expense.paid_by,
                    date: targetDate.toISOString(),
                    is_shared: expense.is_shared,
                    split_type: expense.split_type,
                    share_douglas: expense.share_douglas,
                    share_lara: expense.share_lara,
                    raw_input: "Gerado Automaticamente (Assinatura Recorrente)"
                });

                if (!insertError) {
                    generatedCount++;
                    await supabase.from('recurring_expenses').update({ last_generated_date: new Date().toISOString() }).eq('id', expense.id);
                } else {
                    console.error(`Failed to generate ${expense.name}`, insertError);
                }
            }
        }

        return NextResponse.json({ success: true, processed: generatedCount });
    } catch (error: any) {
        console.error("Critical error processing recurring:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
