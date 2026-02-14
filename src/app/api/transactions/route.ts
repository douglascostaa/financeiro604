import { createClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const supabase = createClient();

        // Validate basics (could allow nulls or use zod but keeping simple)
        if (!data.valor || !data.pagador) {
            return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
        }

        const transactionsToInsert = [];
        const parcelas = data.parcelas || 1;
        const tableName = process.env.NEXT_PUBLIC_TRANSACTIONS_TABLE || 'transactions';
        const baseDate = new Date(data.data || new Date().toISOString());

        if (data.periodicidade === 'mensal') {
            // Save to recurring table
            const { error: recError } = await supabase.from('recurring_expenses').insert({
                name: data.nome,
                amount: data.valor,
                category: data.categoria,
                paid_by: data.pagador,
                day_of_month: new Date(baseDate).getDate(),
                is_shared: data.compartilhado ?? true,
                split_type: data.split_type || 'equal',
                share_douglas: data.split_type === 'custom' ? data.share_douglas : null,
                share_lara: data.split_type === 'custom' ? data.share_lara : null,
                last_generated_date: baseDate.toISOString() // Mark as generated for this month
            });
            if (recError) console.error("Erro ao salvar recorrencia:", recError);
        }

        for (let i = 0; i < parcelas; i++) {
            const date = new Date(baseDate);
            date.setMonth(date.getMonth() + i);

            // Adjust for month rollover issues (e.g. Jan 31 -> Feb 28)
            // If the day changed differently than just month increment (meaning we overflowed), prevent it? 
            // Standard JS setMonth behavior: Jan 31 + 1 month -> March 3 (in non-leap). 
            // Usually credit cards just use the billing cycle date. 
            // For simplicity, we stick to the generated date.

            transactionsToInsert.push({
                description: parcelas > 1 ? `${data.nome} (${i + 1}/${parcelas})` : data.nome,
                amount: data.valor,
                date: date.toISOString(), // Save as Full ISO string
                category: data.categoria,
                paid_by: data.pagador,
                is_shared: data.compartilhado ?? true,
                raw_input: data.raw_input,
                split_type: data.split_type || 'equal',
                share_douglas: data.split_type === 'custom' ? data.share_douglas : null,
                share_lara: data.split_type === 'custom' ? data.share_lara : null
            });
        }

        const { data: insertedData, error } = await supabase
            .from(tableName)
            .insert(transactionsToInsert)
            .select();

        if (error) throw error;

        // Return the first ID or valid success
        return NextResponse.json({ success: true, count: insertedData.length, ids: insertedData.map(d => d.id) });
    } catch (error: any) {
        console.error("Erro ao salvar - Detalhes:", error);
        return NextResponse.json({
            error: "Erro ao salvar transação",
            details: error.message || JSON.stringify(error)
        }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const data = await req.json();
        const supabase = createClient();

        if (!data.id) {
            return NextResponse.json({ error: "ID necessário para atualização" }, { status: 400 });
        }

        const tableName = process.env.NEXT_PUBLIC_TRANSACTIONS_TABLE || 'transactions';
        const { error } = await supabase.from(tableName).update({
            description: data.nome,
            amount: data.valor,
            date: data.data,
            category: data.categoria,
            paid_by: data.pagador,
            is_shared: data.compartilhado,
            raw_input: data.raw_input,
            split_type: data.split_type,
            share_douglas: data.share_douglas,
            share_lara: data.share_lara
        }).eq('id', data.id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Erro ao atualizar - Detalhes:", error);
        return NextResponse.json({
            error: "Erro ao atualizar transação",
            details: error.message || JSON.stringify(error)
        }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const supabase = createClient();

        if (!id) {
            return NextResponse.json({ error: "ID necessário" }, { status: 400 });
        }

        const tableName = process.env.NEXT_PUBLIC_TRANSACTIONS_TABLE || 'transactions';
        const { error } = await supabase.from(tableName).delete().eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Erro ao deletar - Detalhes:", error);
        return NextResponse.json({
            error: "Erro ao deletar transação",
            details: error.message || JSON.stringify(error)
        }, { status: 500 });
    }
}

export async function GET() {
    const supabase = createClient();
    const tableName = process.env.NEXT_PUBLIC_TRANSACTIONS_TABLE || 'transactions';
    const { data, error } = await supabase.from(tableName).select('*').order('created_at', { ascending: false }).limit(50);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
