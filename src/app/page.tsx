"use client";

import { useState, useEffect } from "react";
import {
  Send,
  Wallet,
  PieChart,
  TrendingDown,
  User,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
} from "lucide-react";
import styles from "./page.module.css";
import TransactionList from "@/components/TransactionList";
import ChatSimulator from "@/components/ChatSimulator";
import { Transaction } from "@/types";

import LoginScreen from "@/components/LoginScreen";

interface DashboardStats {
  total: number;
  douglasPaid: number;
  laraPaid: number;
  acerto: number;
}

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<"Douglas" | "Lara" | null>(null);

  useEffect(() => {
    // Check for saved user on mount
    const savedUser = localStorage.getItem("finance_user");
    if (savedUser === "Douglas" || savedUser === "Lara") {
      setCurrentUser(savedUser);
    }
  }, []);

  const handleUserLogin = (user: "Douglas" | "Lara") => {
    setCurrentUser(user);
    localStorage.setItem("finance_user", user);
  }

  const fetchTransactions = async () => {
    try {
      const res = await fetch("/api/transactions");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTransactions(data);
      }
    } catch (error) {
      console.error("Erro ao buscar transações:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const stats: DashboardStats = {
    total: transactions.reduce((acc, t) => acc + Number(t.amount), 0),
    douglasPaid: transactions
      .filter((t) => t.paid_by === "Douglas")
      .reduce((acc, t) => acc + Number(t.amount), 0),
    laraPaid: transactions
      .filter((t) => t.paid_by === "Lara")
      .reduce((acc, t) => acc + Number(t.amount), 0),
    acerto: 0,
  };

  // Cálculo do Acerto (Considerando APENAS gastos compartilhados)
  const douglasPaidShared = transactions
    .filter((t) => t.paid_by === "Douglas" && t.is_shared)
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const laraPaidShared = transactions
    .filter((t) => t.paid_by === "Lara" && t.is_shared)
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const diff = douglasPaidShared - laraPaidShared;
  stats.acerto = Math.abs(diff) / 2;

  // Group transactions by category for the chart
  const categoryData = transactions.reduce((acc: any, t) => {
    acc[t.category || "Outros"] = (acc[t.category || "Outros"] || 0) + Number(t.amount);
    return acc;
  }, {});

  // Convert to array and sort
  const chartData = Object.entries(categoryData)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value); // Higher first

  // Generate conic-gradient string
  const totalValue = chartData.reduce((acc, item) => acc + item.value, 0);
  let currentAngle = 0;
  const colors = ["#3b82f6", "#ec4899", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#6366f1"];

  const gradientParts = chartData.map((item, index) => {
    const startAngle = currentAngle;
    const percentage = (item.value / totalValue) * 360;
    currentAngle += percentage;
    const color = colors[index % colors.length];
    return `${color} ${startAngle}deg ${currentAngle}deg`;
  });

  const gradientString = `conic-gradient(${gradientParts.join(", ")})`;

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("finance_user");
  }

  return (
    <main className={styles.container}>
      {!currentUser && <LoginScreen onSelectUser={handleUserLogin} />}

      {currentUser && (
        <>
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <h1>
                <span style={{ fontSize: "2rem" }}>💰</span> Finanças do Casal
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <p>Olá, {currentUser}! Visão geral de Janeiro</p>
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'none',
                    border: '1px solid #e5e7eb',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  Sair
                </button>
              </div>
            </div>

            <div className={styles.monthSelector}>
              <button className={styles.navButton}>
                <ChevronLeft size={20} color="#6b7280" />
              </button>
              <div className={styles.currentMonth}>
                <Calendar size={18} color="#6b7280" />
                <span>Janeiro 2026</span>
              </div>
              <button className={styles.navButton}>
                <ChevronRight size={20} color="#6b7280" />
              </button>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <p className={styles.cardLabel}>Total do Mês</p>
                <div className={styles.cardIcon + " " + styles.iconTotal}>
                  <TrendingDown size={24} />
                </div>
              </div>
              <h2 className={styles.cardValue + " " + styles.valueTotal}>
                R$ {stats.total.toFixed(2)}
              </h2>
              <p className={styles.cardSub}>+12% vs mês anterior</p>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <p className={styles.cardLabel}>Douglas pagou</p>
                <div className={styles.cardIcon + " " + styles.iconDouglas}>
                  <Wallet size={24} />
                </div>
              </div>
              <h2 className={styles.cardValue + " " + styles.valueDouglas}>
                R$ {stats.douglasPaid.toFixed(2)}
              </h2>
              <p className={styles.cardSub}>
                {(stats.douglasPaid / (stats.total || 1) * 100).toFixed(0)}% do total
              </p>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <p className={styles.cardLabel}>Lara pagou</p>
                <div className={styles.cardIcon + " " + styles.iconLara}>
                  <Wallet size={24} />
                </div>
              </div>
              <h2 className={styles.cardValue + " " + styles.valueLara}>
                R$ {stats.laraPaid.toFixed(2)}
              </h2>
              <p className={styles.cardSub}>
                {(stats.laraPaid / (stats.total || 1) * 100).toFixed(0)}% do total
              </p>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <p className={styles.cardLabel}>Acerto do Mês</p>
                <div className={styles.cardIcon + " " + styles.iconAcerto}>
                  <ArrowRightLeft size={24} />
                </div>
              </div>
              <h2 className={styles.cardValue + " " + styles.valueAcerto}>
                R$ {stats.acerto.toFixed(2)}
              </h2>
              <p className={styles.cardSub}>
                {diff > 0 ? "Lara deve pagar Douglas" : diff < 0 ? "Douglas deve pagar Lara" : "Tudo certo!"}
              </p>
            </div>
          </div>

          <div className={styles.mainContent}>
            {/* Chart Section */}
            <div className={styles.chartSection}>
              <h3 className={styles.chartTitle}>Gastos por Categoria</h3>
              <div className={styles.chartContainer}>
                <div
                  className={styles.donut}
                  style={{ background: gradientString }}
                ></div>
                <div className={styles.legend}>
                  {chartData.map((item, index) => (
                    <div key={item.name} className={styles.legendItem}>
                      <div className={styles.legendLabel}>
                        <span
                          className={styles.legendColor}
                          style={{ background: colors[index % colors.length] }}
                        ></span>
                        {item.name}
                      </div>
                      <span className={styles.legendValue}>
                        R$ {item.value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {chartData.length === 0 && (
                    <p style={{ textAlign: "center", color: "#9ca3af", marginTop: "1rem" }}>
                      Nenhum gasto registrado ainda.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Transaction List Section */}
            <TransactionList
              transactions={transactions}
              onDelete={() => fetchTransactions()}
            />
          </div>

          <ChatSimulator
            onTransactionAdded={fetchTransactions}
            currentUser={currentUser}
          />
        </>
      )}
    </main>
  );
}
