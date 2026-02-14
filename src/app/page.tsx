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
  const [currentDate, setCurrentDate] = useState(new Date());
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

  const checkRecurring = async () => {
    try {
      await fetch("/api/process-recurring");
    } catch (e) {
      console.error("Failed to check recurring expenses:", e);
    }
  };

  useEffect(() => {
    checkRecurring().then(() => fetchTransactions());
  }, []);

  // Filter transactions by current month (Robust String Parsing)
  const filteredTransactions = transactions.filter(t => {
    if (!t.date || t.date.length < 10) return false;

    // Assumes YYYY-MM-DD format from DB
    const tYear = parseInt(t.date.substring(0, 4));
    const tMonth = parseInt(t.date.substring(5, 7)) - 1; // 0-indexed for comparison with getMonth()

    return tMonth === currentDate.getMonth() &&
      tYear === currentDate.getFullYear();
  });

  const stats: DashboardStats = {
    total: filteredTransactions.reduce((acc, t) => acc + Number(t.amount), 0),
    douglasPaid: filteredTransactions
      .filter((t) => t.paid_by === "Douglas")
      .reduce((acc, t) => acc + Number(t.amount), 0),
    laraPaid: filteredTransactions
      .filter((t) => t.paid_by === "Lara")
      .reduce((acc, t) => acc + Number(t.amount), 0),
    acerto: 0,
  };

  // Cálculo do Acerto (Considerando APENAS gastos compartilhados)
  let douglasPaidTotal = 0;
  let laraPaidTotal = 0;
  let douglasShareTotal = 0;
  let laraShareTotal = 0;

  filteredTransactions.forEach(t => {
    if (!t.is_shared) return;

    const amount = Number(t.amount);

    // Contribuição (Quem pagou)
    if (t.paid_by === "Douglas") douglasPaidTotal += amount;
    else laraPaidTotal += amount;

    // Custo (Quem deve)
    if (t.split_type === 'custom' && t.share_douglas !== undefined && t.share_lara !== undefined) {
      douglasShareTotal += Number(t.share_douglas);
      laraShareTotal += Number(t.share_lara);
    } else {
      douglasShareTotal += amount / 2;
      laraShareTotal += amount / 2;
    }
  });

  const douglasBalance = douglasPaidTotal - douglasShareTotal;
  // const laraBalance = laraPaidTotal - laraShareTotal; (inverso do Douglas)

  const diff = douglasBalance; // Se positivo, Douglas pagou a mais (Lara deve). Se negativo, Douglas deve.
  stats.acerto = Math.abs(diff);

  // Group transactions by category for the chart
  const categoryData = filteredTransactions.reduce((acc: any, t) => {
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

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(1); // Avoids end-of-month overflow (e.g. Jan 31 -> Feb -> Mar)
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

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
                <p>Olá, {currentUser}! Visão geral de {currentDate.toLocaleString('pt-BR', { month: 'long' })}</p>
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
              <button className={styles.navButton} onClick={() => navigateMonth('prev')}>
                <ChevronLeft size={20} color="#6b7280" />
              </button>
              <div className={styles.currentMonth}>
                <Calendar size={18} color="#6b7280" />
                <span>{capitalizedMonth}</span>
              </div>
              <button className={styles.navButton} onClick={() => navigateMonth('next')}>
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
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.total)}
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
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.douglasPaid)}
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
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.laraPaid)}
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
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.acerto)}
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
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)}
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
              transactions={filteredTransactions}
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
