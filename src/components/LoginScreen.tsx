"use client";

import { User } from "lucide-react";
import styles from "./LoginScreen.module.css";
import { useEffect, useState } from "react";

interface LoginScreenProps {
    onSelectUser: (user: "Douglas" | "Lara") => void;
}

export default function LoginScreen({ onSelectUser }: LoginScreenProps) {
    const [mounted, setMounted] = useState(false);
    const [selectedToAuth, setSelectedToAuth] = useState<"Douglas" | "Lara" | null>(null);
    const [password, setPassword] = useState("");
    const [error, setError] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const handleLogin = () => {
        // Simple hardcoded PINs for demonstration
        // Douglas: 1234, Lara: 4321
        if (selectedToAuth === "Douglas" && password === "1234") {
            onSelectUser("Douglas");
        } else if (selectedToAuth === "Lara" && password === "4321") {
            onSelectUser("Lara");
        } else {
            setError(true);
            setTimeout(() => setError(false), 2000);
        }
    }

    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                <h1 className={styles.title}>Bem-vindo(a)</h1>
                <p className={styles.subtitle}>
                    {selectedToAuth ? `Olá, ${selectedToAuth}. Digite sua senha:` : "Quem está acessando?"}
                </p>

                {!selectedToAuth ? (
                    <div className={styles.userGrid}>
                        <button
                            className={styles.userButton}
                            onClick={() => setSelectedToAuth("Douglas")}
                        >
                            <div className={`${styles.avatar} ${styles.avatarDouglas}`}>
                                D
                            </div>
                            <span className={styles.userName}>Douglas</span>
                        </button>

                        <button
                            className={styles.userButton}
                            onClick={() => setSelectedToAuth("Lara")}
                        >
                            <div className={`${styles.avatar} ${styles.avatarLara}`}>
                                L
                            </div>
                            <span className={styles.userName}>Lara</span>
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input
                            type="password"
                            placeholder="Senha (PIN)"
                            className={styles.inputAuth}
                            autoFocus
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                            style={{
                                padding: '1rem',
                                borderRadius: '12px',
                                border: error ? '1px solid red' : '1px solid #e5e7eb',
                                fontSize: '16px',
                                outline: 'none',
                                textAlign: 'center'
                            }}
                        />
                        {error && <span style={{ color: 'red', fontSize: '12px' }}>Senha incorreta</span>}
                        <button
                            onClick={handleLogin}
                            style={{
                                padding: '1rem',
                                background: '#2563eb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Entrar
                        </button>
                        <button
                            onClick={() => { setSelectedToAuth(null); setPassword(""); setError(false); }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#6b7280',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            Voltar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
