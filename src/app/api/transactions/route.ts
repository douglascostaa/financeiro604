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

        const { data: insertedData, error } = await supabase.from('transactions').insert({
            description: data.nome,
            amount: data.valor,
            date: data.data || new Date().toISOString(),
            category: data.categoria,
            paid_by: data.pagador,
            is_shared: data.compartilhado ?? true,
            raw_input: data.raw_input
        }).select().single();

        if (error) throw error;

        return NextResponse.json({ success: true, id: insertedData.id });
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

        const { error } = await supabase.from('transactions').update({
            description: data.nome,
            amount: data.valor,
            date: data.data,
            category: data.categoria,
            paid_by: data.pagador,
            is_shared: data.compartilhado,
            raw_input: data.raw_input
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

        const { error } = await supabase.from('transactions').delete().eq('id', id);

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
    const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(50);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
