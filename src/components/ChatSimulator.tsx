"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Check, X } from "lucide-react";
import styles from "./ChatSimulator.module.css";
import { createClient } from "@/lib/supabase";

type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    data?: any; // Structured data if available
    timestamp: Date;
};

export default function ChatSimulator({
    onTransactionAdded,
    currentUser
}: {
    onTransactionAdded: () => void;
    currentUser: "Douglas" | "Lara" | null;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            role: "assistant",
            content: "Oi! Me conta o que vocês gastaram recentemente? Ex: 'Jantar 150 ontem'",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    // Store the last successfully saved transaction to provide context for corrections
    const [lastSavedTransaction, setLastSavedTransaction] = useState<any>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            // Include lastSavedTransaction for context if available
            const payload = {
                message: userMsg.content,
                lastTransaction: lastSavedTransaction,
                currentUser // Send the current logged user
            };

            const res = await fetch("/api/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (data.success) {
                const responseData = data.data;
                const isTransaction = responseData.action === 'transaction';
                const transactionData = responseData.transaction || null;

                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: responseData.message || (isTransaction ? "Entendi, registrando..." : "Olá!"),
                    data: transactionData, // Will trigger card rendering if present and valid
                    timestamp: new Date()
                }]);
            } else {
                const errorMsg = data.details
                    ? `Erro técnico: ${data.details}`
                    : "Desculpe, não consegui entender. Tente ser mais específico.";

                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: errorMsg,
                    timestamp: new Date()
                }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "Erro de conexão. Verifique sua internet.",
                timestamp: new Date()
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmTransaction = async (msgId: string, data: any) => {
        try {
            console.log("Saving/Updating transaction...", data);

            // Determine if it's a CREATE or UPDATE
            const method = data.id ? "PUT" : "POST";

            const res = await fetch("/api/transactions", {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (res.ok) {
                const result = await res.json(); // Get ID if it was a POST

                // Update local state for context in next message
                const savedId = data.id || result.id;
                setLastSavedTransaction({ ...data, id: savedId });

                setMessages(prev => prev.map(m =>
                    m.id === msgId ? { ...m, content: data.id ? "✅ Atualizado com sucesso!" : "✅ Salvo com sucesso!", data: null } : m
                ));
                onTransactionAdded();
            } else {
                const err = await res.json();
                console.error("Save error:", err);
                alert("Erro ao salvar: " + (err.error || "Desconhecido"));
            }
        } catch (error) {
            console.error("Fetch error:", error);
            alert("Erro de conexão ao salvar.");
        }
    };

    if (!isOpen) {
        return (
            <button
                className={styles.fab}
                onClick={() => setIsOpen(true)}
            >
                <span className={styles.fabIcon}>💬</span>
            </button>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.avatar}>
                    <Bot size={20} />
                </div>
                <div>
                    <h3 className={styles.title}>Assistente Financeiro</h3>
                    <p className={styles.status}>Online</p>
                </div>
                <button onClick={() => setIsOpen(false)} className={styles.closeBtn}>
                    <X size={20} />
                </button>
            </div>

            <div className={styles.messages}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.assistant}`}
                    >
                        {msg.content}

                        {msg.data && msg.data.nome && msg.data.valor && (
                            <div className={styles.card}>
                                {msg.data.id && (
                                    <div className={styles.tagDetected} style={{ marginBottom: '0.5rem' }}>
                                        ✏️ Correção
                                    </div>
                                )}
                                <div className={styles.cardRow}>
                                    <span>💰 Valor:</span>
                                    <strong>R$ {msg.data.valor}</strong>
                                </div>
                                <div className={styles.cardRow}>
                                    <span>🏷️ Categoria:</span>
                                    <span>{msg.data.categoria}</span>
                                </div>
                                <div className={styles.cardRow}>
                                    <span>👤 Pagador:</span>
                                    <span>{msg.data.pagador}</span>
                                </div>
                                <div className={styles.actions}>
                                    <button
                                        onClick={() => handleConfirmTransaction(msg.id, msg.data)}
                                        className={styles.confirmBtn}
                                    >
                                        {msg.data.id ? "Confirmar Atualização" : "Confirmar"}
                                    </button>
                                </div>
                            </div>
                        )}
                        <span className={styles.time}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                ))}
                {loading && (
                    <div className={`${styles.message} ${styles.assistant}`}>
                        <Loader2 className="animate-spin" size={16} />
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className={styles.inputArea}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Digite um gasto (ou ajuste o anterior)..."
                    className={styles.input}
                />
                <button type="submit" disabled={!input.trim() || loading} className={styles.sendBtn}>
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}
