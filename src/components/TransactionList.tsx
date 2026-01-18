"use client";

import { useState } from "react";
import { Search, ShoppingCart, Loader2, Edit2, Trash2, X, Check } from "lucide-react";
import styles from "./TransactionList.module.css";
import { Transaction } from "@/types";

export default function TransactionList({
    transactions,
    onDelete
}: {
    transactions: Transaction[],
    onDelete?: () => void
}) {
    const [search, setSearch] = useState("");
    const [filterUser, setFilterUser] = useState("Todos");
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const filtered = transactions.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase());
        const matchesUser = filterUser === "Todos" || t.paid_by === filterUser;
        return matchesSearch && matchesUser;
    });

    const handleDelete = async (id: string) => {
        if (!onDelete || !confirm("Tem certeza que deseja excluir este registro?")) return;

        try {
            const res = await fetch(`/api/transactions?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                onDelete();
            } else {
                alert("Erro ao excluir. Tente novamente.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro de conexão ao excluir");
        }
    }

    const handleEditClick = (t: Transaction) => {
        setEditingTx({ ...t });
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTx) return;

        setIsSaving(true);
        try {
            // Map back to API expected format
            const payload = {
                id: editingTx.id,
                nome: editingTx.description,
                valor: Number(editingTx.amount),
                data: editingTx.date, // Ensure format YYYY-MM-DD
                categoria: editingTx.category,
                pagador: editingTx.paid_by,
                compartilhado: editingTx.is_shared,
            };

            const res = await fetch("/api/transactions", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setEditingTx(null);
                if (onDelete) onDelete(); // Refresh list
            } else {
                alert("Erro ao salvar alterações.");
            }
        } catch (err) {
            console.error(err);
            alert("Erro de conexão.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.controls}>
                <div className={styles.searchWrapper}>
                    <Search size={16} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Buscar despesa..."
                        className={styles.searchInput}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className={styles.filters}>
                    <select
                        className={styles.select}
                        value={filterUser}
                        onChange={(e) => setFilterUser(e.target.value)}
                    >
                        <option value="Todos">Todos</option>
                        <option value="Douglas">Douglas</option>
                        <option value="Lara">Lara</option>
                    </select>
                </div>
            </div>

            <div className={styles.list}>
                {filtered.map((t) => (
                    <div key={t.id} className={styles.item}>
                        <div className={styles.itemMain}>
                            <div className={styles.iconBox}>
                                <ShoppingCart size={20} color="#6b7280" />
                            </div>

                            <div className={styles.details}>
                                <div className={styles.row}>
                                    <span className={styles.desc}>{t.description}</span>
                                    {t.is_shared && <span className={styles.badge}>Dividido</span>}
                                </div>
                                <div className={styles.rowSub}>
                                    <span className={styles.date}>{new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                    <span className={styles.dot}>•</span>
                                    <span className={styles.payer}>
                                        {t.paid_by === 'Douglas' ? '👱‍♂️ Douglas' : '👩 Lara'}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.amountBox}>
                                <span className={styles.amount}>R$ {Number(t.amount).toFixed(2)}</span>
                                {t.is_shared && (
                                    <span className={styles.splitSub}>+2 = R$ {(Number(t.amount) / 2).toFixed(2)}</span>
                                )}
                            </div>
                        </div>

                        <div className={styles.actions}>
                            <button
                                onClick={() => handleEditClick(t)}
                                className={styles.actionBtn}
                                aria-label="Editar"
                            >
                                <Edit2 size={16} />
                            </button>
                            {onDelete && (
                                <button
                                    onClick={() => handleDelete(t.id!)}
                                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                    aria-label="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className={styles.empty}>Nenhuma despesa encontrada.</div>
                )}
            </div>

            {/* Edit Modal */}
            {editingTx && (
                <div className={styles.modalOverlay}>
                    <form className={styles.modalContent} onSubmit={handleSaveEdit}>
                        <div className={styles.modalHeader}>
                            <h3>Editar Despesa</h3>
                            <button type="button" onClick={() => setEditingTx(null)}><X size={20} /></button>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Descrição</label>
                            <input
                                className={styles.input}
                                value={editingTx.description}
                                onChange={e => setEditingTx({ ...editingTx, description: e.target.value })}
                                required
                            />
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>Valor (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className={styles.input}
                                    value={editingTx.amount}
                                    onChange={e => setEditingTx({ ...editingTx, amount: Number(e.target.value) })}
                                    required
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Data</label>
                                <input
                                    type="date"
                                    className={styles.input}
                                    value={editingTx.date.split('T')[0]}
                                    onChange={e => setEditingTx({ ...editingTx, date: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>Pagador</label>
                                <select
                                    className={styles.selectInput}
                                    value={editingTx.paid_by}
                                    onChange={e => setEditingTx({ ...editingTx, paid_by: e.target.value as "Douglas" | "Lara" })}
                                >
                                    <option value="Douglas">Douglas</option>
                                    <option value="Lara">Lara</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Categoria</label>
                                <input
                                    className={styles.input}
                                    value={editingTx.category || ""}
                                    onChange={e => setEditingTx({ ...editingTx, category: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className={styles.checkboxGroup}>
                            <input
                                type="checkbox"
                                id="shared"
                                checked={editingTx.is_shared}
                                onChange={e => setEditingTx({ ...editingTx, is_shared: e.target.checked })}
                            />
                            <label htmlFor="shared">Dividir despesa (50/50)</label>
                        </div>

                        <div className={styles.modalActions}>
                            <button type="button" className={styles.cancelBtn} onClick={() => setEditingTx(null)}>Cancelar</button>
                            <button type="submit" className={styles.saveBtn} disabled={isSaving}>
                                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                Salvar
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
