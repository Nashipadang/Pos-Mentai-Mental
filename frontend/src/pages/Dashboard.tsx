import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePOSStore } from '../store/posStore'
import { useAuthStore } from '../store/authStore'
import { 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle, 
  Clock,
  ArrowUpRight,
  TrendingUp,
  UtensilsCrossed,
  BarChart3,
  Users,
  Printer,
  Flame,
  X,
  Plus,
  FileText,
  CreditCard,
  Wallet,
  Activity,
  UserPlus
} from 'lucide-react'
import { 
  ResponsiveContainer, 
  AreaChart,
  Area,
  XAxis, 
  YAxis,
  Tooltip, 
  CartesianGrid,
  Cell
} from 'recharts'
import { Ingredient, Transaction } from '../types'
import { formatTxId } from '../lib/api'

export default function Dashboard() {
  const { 
    transactions, 
    products, 
    ingredients, 
    customers, 
    restockIngredient,
    addCustomer,
    cancelTransaction 
  } = usePOSStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  // ── States ──────────────────────────────────────────────────
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [restockIng, setRestockIng] = useState<Ingredient | null>(null)
  const [restockQty, setRestockQty] = useState<string>('')
  const [restockNotes, setRestockNotes] = useState<string>('Restock via Dashboard')
  const [isRestockLoading, setIsRestockLoading] = useState(false)

  // Customer Quick Register State
  const [isCustModalOpen, setIsCustModalOpen] = useState(false)
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [custError, setCustError] = useState('')
  const [isCustLoading, setIsCustLoading] = useState(false)

  const formatIDR = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val)

  // ── TODAY stats ────────────────────────────────────────────
  const todayStr = new Date().toDateString()

  const stats = useMemo(() => {
    const todayTx = transactions.filter(tx => new Date(tx.created_at).toDateString() === todayStr && tx.status === 'completed')
    const revenue = todayTx.reduce((s, tx) => s + tx.total_amount, 0)
    const count = todayTx.length
    const avg = count > 0 ? revenue / count : 0
    const lowStock = ingredients.filter(i => i.current_stock <= (i.min_threshold ?? 0)).length

    // Yesterday comparison
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yStr = yesterday.toDateString()
    const yTx = transactions.filter(tx => new Date(tx.created_at).toDateString() === yStr && tx.status === 'completed')
    const yRevenue = yTx.reduce((s, tx) => s + tx.total_amount, 0)
    const revDelta = yRevenue > 0 ? ((revenue - yRevenue) / yRevenue * 100) : 0

    // Payment methods breakdown
    const cashSales = todayTx.filter(tx => tx.payment_method === 'cash').reduce((s, tx) => s + tx.total_amount, 0)
    const transferSales = todayTx.filter(tx => tx.payment_method === 'transfer').reduce((s, tx) => s + tx.total_amount, 0)
    const midtransSales = todayTx.filter(tx => tx.payment_method === 'midtrans').reduce((s, tx) => s + tx.total_amount, 0)

    return { revenue, count, avg, lowStock, revDelta, cashSales, transferSales, midtransSales }
  }, [transactions, ingredients, todayStr])

  // Hourly Sales for Today (08:00 - 22:00)
  const todayHourlySales = useMemo(() => {
    const hours = Array.from({ length: 15 }, (_, i) => i + 8) // Hours 8 to 22
    return hours.map(h => {
      const txs = transactions.filter(tx => {
        const date = new Date(tx.created_at)
        return date.toDateString() === todayStr && date.getHours() === h && tx.status === 'completed'
      })
      const sales = txs.reduce((s, tx) => s + tx.total_amount, 0)
      const count = txs.length
      return {
        label: `${String(h).padStart(2, '0')}:00`,
        sales,
        count
      }
    })
  }, [transactions, todayStr])

  // ── TODAY's top selling menu ───────────────────────────────
  const todayTopMenu = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {}
    transactions.forEach(tx => {
      if (tx.status !== 'completed' || new Date(tx.created_at).toDateString() !== todayStr) return
      tx.items?.forEach(item => {
        const prod = products.find(p => p.id === item.product_id)
        if (!prod) return
        if (!map[prod.id]) map[prod.id] = { name: prod.name, qty: 0, revenue: 0 }
        map[prod.id].qty += item.quantity
        map[prod.id].revenue += item.subtotal ?? 0
      })
    })
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [transactions, products, todayStr])

  // ── Low stock items ────────────────────────────────────────
  const lowStockAlerts = useMemo(() =>
    ingredients
      .filter(i => i.current_stock <= (i.min_threshold ?? 0))
      .sort((a, b) => a.current_stock - b.current_stock),
  [ingredients])

  // ── Recent transactions (last 5 today) ─────────────────────
  const recentTx = useMemo(() =>
    transactions
      .filter(tx => new Date(tx.created_at).toDateString() === todayStr)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
  [transactions, todayStr])

  // Quick stats for info cards
  const totalProducts = products.filter(p => p.is_active).length

  // Handle Restock Submission
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restockIng) return
    const qty = parseFloat(restockQty)
    if (isNaN(qty) || qty <= 0) return
    
    setIsRestockLoading(true)
    try {
      await restockIngredient(restockIng.id, qty, restockNotes)
      setRestockIng(null)
      setRestockQty('')
      setRestockNotes('Restock via Dashboard')
    } catch (err) {
      console.error(err)
    } finally {
      setIsRestockLoading(false)
    }
  }

  // Handle Customer Quick Add
  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCustError('')
    if (!custName || !custPhone) {
      setCustError('Nama dan Telepon wajib diisi')
      return
    }
    
    setIsCustLoading(true)
    try {
      await addCustomer({ name: custName, phone: custPhone })
      setCustName('')
      setCustPhone('')
      setIsCustModalOpen(false)
    } catch (err: any) {
      setCustError(err.response?.data?.message || 'Nomor telepon sudah terdaftar')
    } finally {
      setIsCustLoading(false)
    }
  }

  // Trigger Receipt Printing
  const triggerPrintReceipt = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-[hsl(var(--foreground))] tracking-tight">
            Selamat datang, {user?.name?.split(' ')[0] ?? 'Owner'} 👋
          </h2>
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] font-sans">
            Ringkasan performa & operasional harian kedai Mentai Mental
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-2xl border border-[hsl(var(--border))] text-xs font-bold text-[hsl(var(--muted-foreground))]">
            <Clock className="w-4 h-4 text-[hsl(var(--primary))]" />
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <button
            onClick={() => navigate('/analytics')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[hsl(var(--primary))] text-white rounded-2xl text-xs font-bold hover:opacity-90 transition-opacity shadow-lg shadow-[hsl(var(--primary))]/15"
          >
            <BarChart3 className="w-4 h-4" />
            Laporan Analitik
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Omzet Hari Ini */}
        <div className="bg-white rounded-3xl p-5 border border-[hsl(var(--border))] hover-card-lift relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[hsl(var(--primary))]">
              <DollarSign className="w-5 h-5" />
            </div>
            {stats.revDelta !== 0 && (
              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                stats.revDelta > 0
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  : 'bg-rose-50 text-rose-500 border border-rose-100'
              }`}>
                {stats.revDelta > 0 ? '+' : ''}{stats.revDelta.toFixed(0)}% <TrendingUp className="w-3 h-3" />
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">Omzet Hari Ini</p>
          <h3 className="text-2xl font-display font-bold text-[hsl(var(--foreground))]">{formatIDR(stats.revenue)}</h3>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">vs kemarin ({formatIDR(stats.revenue - (stats.revenue * (stats.revDelta / 100)))})</p>
        </div>

        {/* Pesanan */}
        <div className="bg-white rounded-3xl p-5 border border-[hsl(var(--border))] hover-card-lift">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
              AOV: {formatIDR(stats.avg)}
            </span>
          </div>
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">Pesanan Hari Ini</p>
          <h3 className="text-2xl font-display font-bold text-[hsl(var(--foreground))]">{stats.count} pesanan</h3>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Pesanan terselesaikan</p>
        </div>

        {/* Kas Laci Kasir */}
        <div className="bg-white rounded-3xl p-5 border border-[hsl(var(--border))] hover-card-lift">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
              Cash Only
            </span>
          </div>
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">Estimasi Kas Laci</p>
          <h3 className="text-2xl font-display font-bold text-[hsl(var(--foreground))]">{formatIDR(stats.cashSales)}</h3>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">Wajib disamakan saat tutup laci</p>
        </div>

        {/* Stok Kritis */}
        <div className="bg-white rounded-3xl p-5 border border-[hsl(var(--border))] hover-card-lift">
          <div className="flex justify-between items-start mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.lowStock > 0 ? 'bg-rose-50 text-rose-500 animate-pulse' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">Stok Kritis</p>
          <h3 className={`text-2xl font-display font-bold ${stats.lowStock > 0 ? 'text-rose-600' : 'text-[hsl(var(--foreground))]'}`}>
            {stats.lowStock} bahan
          </h3>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
            {stats.lowStock > 0 ? 'Perlu restock segera!' : 'Semua stok aman ✓'}
          </p>
        </div>
      </div>

      {/* Main Grid: Today's Hourly Graph + Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Sales Progression (Hourly) */}
        <div className="bg-white rounded-3xl p-6 border border-[hsl(var(--border))] lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-base text-[hsl(var(--foreground))] mb-0.5">Laju Penjualan Hari Ini</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">Berdasarkan jam transaksi (08:00 - 22:00)</p>
            </div>
            <div className="flex items-center gap-1 bg-orange-50 text-[hsl(var(--primary))] px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase border border-orange-100">
              <Activity className="w-3.5 h-3.5" />
              Live
            </div>
          </div>

          <div className="h-60 w-full font-sans text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={todayHourlySales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="todaySalesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(14, 96%, 58%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(14, 96%, 58%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(33, 14%, 90%)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(24, 10%, 40%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(24, 10%, 40%)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid hsl(33, 14%, 85%)', fontSize: '11px', fontWeight: 600 }}
                  formatter={(value: any) => [formatIDR(value), 'Penjualan']}
                />
                <Area type="monotone" dataKey="sales" stroke="hsl(14, 96%, 58%)" strokeWidth={2.5} fill="url(#todaySalesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Breakdowns */}
        <div className="bg-white rounded-3xl p-6 border border-[hsl(var(--border))] flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-base text-[hsl(var(--foreground))] mb-0.5">Distribusi Pembayaran</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium mb-5">Metode pembayaran omzet hari ini</p>
            
            <div className="space-y-4">
              {/* Cash */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[hsl(var(--foreground))] flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Uang Tunai (Cash)
                  </span>
                  <span className="text-[hsl(var(--foreground))]">{formatIDR(stats.cashSales)}</span>
                </div>
                <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${stats.revenue > 0 ? (stats.cashSales / stats.revenue) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-right font-semibold text-emerald-600">
                  {stats.revenue > 0 ? ((stats.cashSales / stats.revenue) * 100).toFixed(0) : 0}% porsi
                </p>
              </div>

              {/* Transfer */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[hsl(var(--foreground))] flex items-center gap-1.5">
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" /> Bank Transfer
                  </span>
                  <span className="text-[hsl(var(--foreground))]">{formatIDR(stats.transferSales)}</span>
                </div>
                <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${stats.revenue > 0 ? (stats.transferSales / stats.revenue) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-right font-semibold text-blue-600">
                  {stats.revenue > 0 ? ((stats.transferSales / stats.revenue) * 100).toFixed(0) : 0}% porsi
                </p>
              </div>

              {/* Midtrans */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[hsl(var(--foreground))] flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-orange-600" /> E-Wallet / Midtrans
                  </span>
                  <span className="text-[hsl(var(--foreground))]">{formatIDR(stats.midtransSales)}</span>
                </div>
                <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-[hsl(var(--primary))] h-full rounded-full transition-all duration-500" 
                    style={{ width: `${stats.revenue > 0 ? (stats.midtransSales / stats.revenue) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-right font-semibold text-orange-600">
                  {stats.revenue > 0 ? ((stats.midtransSales / stats.revenue) * 100).toFixed(0) : 0}% porsi
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[hsl(var(--border))]/40 mt-4 text-[10px] text-[hsl(var(--muted-foreground))] font-medium text-center">
            Omzet hari ini bersumber dari {stats.count} transaksi tervalidasi
          </div>
        </div>
      </div>

      {/* Row: Quick Actions + Low Stock + Top Menu */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Panel */}
        <div className="bg-white rounded-3xl p-6 border border-[hsl(var(--border))] flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-base text-[hsl(var(--foreground))] mb-1">Tindakan Cepat</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium mb-4">Pintas cepat operasional kasir & admin</p>
            
            <div className="grid grid-cols-1 gap-2.5">
              <button 
                onClick={() => navigate('/pos')}
                className="flex items-center gap-3 p-3.5 bg-orange-50/50 hover:bg-orange-50 border border-orange-100/50 hover:border-orange-200 text-[hsl(var(--primary))] font-sans font-bold text-xs rounded-2xl text-left transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-[hsl(var(--primary))] text-white flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-display text-[hsl(var(--foreground))] font-bold leading-tight">Buka Kasir POS</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold">Mulai pencatatan transaksi baru</p>
                </div>
              </button>

              <button 
                onClick={() => setIsCustModalOpen(true)}
                className="flex items-center gap-3 p-3.5 bg-blue-50/40 hover:bg-blue-50 border border-blue-100/40 hover:border-blue-200 text-blue-600 font-sans font-bold text-xs rounded-2xl text-left transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-display text-[hsl(var(--foreground))] font-bold leading-tight">Daftarkan Pelanggan</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold">Daftar loyalty pelanggan baru</p>
                </div>
              </button>

              <button 
                onClick={() => navigate('/inventory')}
                className="flex items-center gap-3 p-3.5 bg-amber-50/40 hover:bg-amber-50 border border-amber-100/40 hover:border-amber-200 text-amber-600 font-sans font-bold text-xs rounded-2xl text-left transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-display text-[hsl(var(--foreground))] font-bold leading-tight">Kelola Resep Menu</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold">Sesuaikan takaran Bill of Material</p>
                </div>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[hsl(var(--border))]/40 mt-4 flex items-center justify-between text-[11px]">
            <span className="font-bold text-[hsl(var(--muted-foreground))]">Jumlah Menu Aktif:</span>
            <span className="font-display font-extrabold text-[hsl(var(--primary))] bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">{totalProducts} item</span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-3xl p-6 border border-[hsl(var(--border))]">
          <h3 className="font-display font-bold text-base text-[hsl(var(--foreground))] mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            Stok Kritis
          </h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium mb-4">Bahan baku di bawah batas aman</p>

          {lowStockAlerts.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-xs text-[hsl(var(--muted-foreground))] text-center bg-emerald-50/30 rounded-2xl border border-dashed border-emerald-200">
              <span className="text-xl mb-1">🎉</span>
              <p className="font-bold text-emerald-700">Semua bahan baku aman</p>
              <p className="text-[10px]">Stok saat ini di atas ambang batas</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
              {lowStockAlerts.map(ing => (
                <div key={ing.id} className="flex items-center justify-between p-2.5 bg-rose-50/40 rounded-2xl border border-rose-100">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[hsl(var(--foreground))] truncate">{ing.name}</p>
                    <p className="text-[9px] text-rose-600 font-bold">Min: {ing.min_threshold ?? 0} {ing.unit}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-extrabold text-rose-700 bg-rose-100/50 px-2 py-1 rounded-lg border border-rose-200/50">
                      {ing.current_stock} {ing.unit}
                    </span>
                    <button 
                      onClick={() => setRestockIng(ing)}
                      className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-[10px] font-extrabold transition-colors"
                    >
                      Restock
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Top Selling */}
        <div className="bg-white rounded-3xl p-6 border border-[hsl(var(--border))]">
          <h3 className="font-display font-bold text-base text-[hsl(var(--foreground))] mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Top Terlaris Hari Ini
          </h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium mb-4">Menu dengan volume penjualan tertinggi</p>

          {todayTopMenu.length > 0 ? (
            <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
              {todayTopMenu.map((prod, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl bg-stone-50/50 border border-[hsl(var(--border))]/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-display font-bold text-[10px] ${
                      idx === 0 ? 'bg-amber-100 text-amber-700' :
                      idx === 1 ? 'bg-stone-200 text-stone-700' :
                      'bg-stone-100 text-stone-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <p className="text-xs font-bold text-[hsl(var(--foreground))] truncate">{prod.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-[hsl(var(--primary))] bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-lg">{prod.qty} porsi</span>
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] mt-0.5">{formatIDR(prod.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-xs text-[hsl(var(--muted-foreground))] text-center bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
              <p>Belum ada produk terjual hari ini</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions List */}
      <div className="bg-white rounded-3xl p-6 border border-[hsl(var(--border))]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-base text-[hsl(var(--foreground))] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[hsl(var(--primary))]" />
            Daftar Transaksi Hari Ini
          </h3>
          <button 
            onClick={() => navigate('/transactions')} 
            className="text-xs font-bold text-[hsl(var(--primary))] flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            Semua Transaksi <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTx.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  <th className="py-3 px-3">Waktu</th>
                  <th className="py-3 px-3">ID Transaksi</th>
                  <th className="py-3 px-3">Produk</th>
                  <th className="py-3 px-3">Pembayaran</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.map(tx => {
                  const custName = customers.find(c => c.id === tx.customer_id)?.name
                  return (
                    <tr key={tx.id} className="border-b border-[hsl(var(--border))]/40 hover:bg-stone-50/50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-[hsl(var(--muted-foreground))]">
                        {new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-[hsl(var(--foreground))] text-[10px]">
                        {formatTxId(tx.id)}
                      </td>
                      <td className="py-3 px-3 font-medium text-[hsl(var(--foreground))] max-w-[200px] truncate">
                        {tx.items?.map(it => {
                          const prod = products.find(p => p.id === it.product_id)
                          return `${prod?.name ?? 'Menu'} (${it.quantity}x)`
                        }).join(', ')}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 font-bold">
                          {tx.payment_method === 'cash' ? '💵 Tunai' : tx.payment_method === 'transfer' ? '🏦 Transfer' : '🌐 Midtrans'}
                          {custName && <span className="text-[9px] font-normal text-[hsl(var(--muted-foreground))]">({custName})</span>}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-display font-extrabold text-[hsl(var(--foreground))]">
                        {formatIDR(tx.total_amount)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          tx.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          tx.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse' :
                          'bg-rose-50 text-rose-500 border border-rose-100'
                        }`}>
                          {tx.status === 'completed' ? 'Selesai' : tx.status === 'pending' ? 'Pending' : 'Batal'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => setSelectedTx(tx)}
                            className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg font-bold transition-all"
                            title="Detail / Struk"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          {tx.status === 'pending' && (
                            <button 
                              onClick={async () => {
                                if (window.confirm('Batalkan transaksi pending ini?')) {
                                  await cancelTransaction(tx.id)
                                }
                              }}
                              className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-extrabold transition-all"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-sm text-[hsl(var(--muted-foreground))] bg-stone-50/50 rounded-3xl border border-dashed border-[hsl(var(--border))]">
            <ShoppingBag className="w-8 h-8 text-[hsl(var(--border))] mb-2" />
            <p className="font-semibold text-[hsl(var(--foreground))]">Belum ada transaksi</p>
            <p className="text-xs">Segala transaksi kasir hari ini akan muncul di sini</p>
          </div>
        )}
      </div>

      {/* ── Receipt/Struk Printable Modal ───────────────────────── */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-[hsl(var(--border))] flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-[hsl(var(--border))]/50">
              <h4 className="font-display font-bold text-sm text-[hsl(var(--foreground))]">Detail Struk Belanja</h4>
              <button 
                onClick={() => setSelectedTx(null)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content / Receipt view */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 font-sans text-xs">
              <div className="printable-receipt-container p-4 bg-white border border-stone-200 rounded-2xl mx-auto shadow-sm max-w-[80mm] text-stone-800">
                {/* Header Struk */}
                <div className="text-center space-y-1 mb-4 border-b border-dashed border-stone-300 pb-3">
                  <Flame className="w-8 h-8 text-[hsl(var(--primary))] fill-current mx-auto" />
                  <h5 className="font-display font-extrabold text-base text-stone-900 tracking-tight">Mentai Mental</h5>
                  <p className="text-[10px] font-medium text-stone-500">Kawasan Kuliner Mentai Spesial</p>
                  <p className="text-[9px] text-stone-400">Telp: 0812-3456-7890</p>
                </div>

                {/* Meta Struk */}
                <div className="space-y-1 border-b border-dashed border-stone-300 pb-3 mb-3 text-[10px] text-stone-600">
                  <div className="flex justify-between">
                    <span>No. Invoice:</span>
                    <span className="font-mono font-bold text-stone-900">{selectedTx.id.substring(0, 12).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu:</span>
                    <span>{new Date(selectedTx.created_at).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Metode:</span>
                    <span className="font-bold">{selectedTx.payment_method.toUpperCase()}</span>
                  </div>
                  {selectedTx.customer_id && (
                    <div className="flex justify-between">
                      <span>Pelanggan:</span>
                      <span className="font-semibold">{customers.find(c => c.id === selectedTx.customer_id)?.name}</span>
                    </div>
                  )}
                </div>

                {/* Item List */}
                <div className="space-y-2 border-b border-dashed border-stone-300 pb-3 mb-3">
                  {selectedTx.items?.map((item, idx) => {
                    const prodName = products.find(p => p.id === item.product_id)?.name || 'Menu Mentai'
                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between text-stone-900 font-bold">
                          <span className="truncate max-w-[150px]">{prodName}</span>
                          <span>{formatIDR((item.unit_price ?? 0) * item.quantity)}</span>
                        </div>
                        <div className="flex justify-between text-[9px] text-stone-500">
                          <span>{item.quantity} x {formatIDR(item.unit_price ?? 0)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Ringkasan Biaya */}
                <div className="space-y-1 border-b border-dashed border-stone-300 pb-3 mb-3 text-[10px]">
                  <div className="flex justify-between text-stone-900 font-extrabold text-sm">
                    <span>TOTAL AKHIR:</span>
                    <span>{formatIDR(selectedTx.total_amount)}</span>
                  </div>
                </div>

                {/* Footer Struk */}
                <div className="text-center text-[9px] text-stone-400 pt-2 space-y-1">
                  <p className="font-bold text-stone-500">Terima kasih atas kunjungan Anda!</p>
                  <p>Mentai panggang lezat bikin ketagihan.</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-4 border-t border-[hsl(var(--border))]/50 bg-stone-50 rounded-b-3xl flex gap-2">
              <button 
                onClick={() => setSelectedTx(null)}
                className="flex-1 py-2.5 border border-[hsl(var(--border))] hover:bg-stone-100 text-[hsl(var(--muted-foreground))] font-sans font-bold text-xs rounded-xl transition-colors"
              >
                Tutup
              </button>
              <button 
                onClick={triggerPrintReceipt}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[hsl(var(--primary))] hover:opacity-90 text-white font-sans font-bold text-xs rounded-xl transition-all shadow-lg shadow-[hsl(var(--primary))]/15"
              >
                <Printer className="w-4 h-4" />
                Cetak Struk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Restock Ingredient Modal ──────────────────────── */}
      {restockIng && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleRestockSubmit}
            className="bg-white rounded-3xl max-w-sm w-full border border-[hsl(var(--border))] flex flex-col"
          >
            <div className="flex justify-between items-center px-5 py-4 border-b border-[hsl(var(--border))]/50">
              <h4 className="font-display font-bold text-sm text-[hsl(var(--foreground))]">Restock Bahan Baku</h4>
              <button 
                type="button"
                onClick={() => setRestockIng(null)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className="block text-[10px] font-extrabold uppercase text-[hsl(var(--muted-foreground))] tracking-wider mb-1">Nama Bahan</span>
                <p className="text-sm font-bold text-[hsl(var(--foreground))] bg-stone-50 p-3 rounded-2xl border border-[hsl(var(--border))]/30">
                  {restockIng.name}
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[hsl(var(--muted-foreground))] tracking-wider mb-1">
                  Jumlah Tambahan ({restockIng.unit})
                </label>
                <input 
                  type="number"
                  step="any"
                  required
                  placeholder={`Contoh: 1000`}
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-4 py-3 bg-white rounded-2xl border border-[hsl(var(--border))] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[hsl(var(--muted-foreground))] tracking-wider mb-1">
                  Catatan
                </label>
                <input 
                  type="text"
                  required
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-white rounded-2xl border border-[hsl(var(--border))] text-sm font-bold focus:outline-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[hsl(var(--border))]/50 bg-stone-50 rounded-b-3xl flex gap-2">
              <button 
                type="button"
                onClick={() => setRestockIng(null)}
                className="flex-1 py-2.5 border border-[hsl(var(--border))] hover:bg-stone-100 text-[hsl(var(--muted-foreground))] font-sans font-bold text-xs rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                type="submit"
                disabled={isRestockLoading}
                className="flex-1 py-2.5 bg-[hsl(var(--primary))] hover:opacity-90 disabled:opacity-50 text-white font-sans font-bold text-xs rounded-xl transition-all"
              >
                {isRestockLoading ? 'Menyimpan...' : 'Simpan Stok'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Quick Add Customer Modal ────────────────────────────── */}
      {isCustModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleAddCustomerSubmit}
            className="bg-white rounded-3xl max-w-sm w-full border border-[hsl(var(--border))] flex flex-col"
          >
            <div className="flex justify-between items-center px-5 py-4 border-b border-[hsl(var(--border))]/50">
              <h4 className="font-display font-bold text-sm text-[hsl(var(--foreground))]">Daftarkan Pelanggan Baru</h4>
              <button 
                type="button"
                onClick={() => setIsCustModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {custError && (
                <div className="p-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-[11px] font-bold">
                  {custError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[hsl(var(--muted-foreground))] tracking-wider mb-1">
                  Nama Lengkap
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Contoh: Adi Wijaya"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-4 py-3 bg-white rounded-2xl border border-[hsl(var(--border))] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[hsl(var(--muted-foreground))] tracking-wider mb-1">
                  Nomor HP (WhatsApp)
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Contoh: 08123456789"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-white rounded-2xl border border-[hsl(var(--border))] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[hsl(var(--border))]/50 bg-stone-50 rounded-b-3xl flex gap-2">
              <button 
                type="button"
                onClick={() => setIsCustModalOpen(false)}
                className="flex-1 py-2.5 border border-[hsl(var(--border))] hover:bg-stone-100 text-[hsl(var(--muted-foreground))] font-sans font-bold text-xs rounded-xl transition-colors"
              >
                Batal
              </button>
              <button 
                type="submit"
                disabled={isCustLoading}
                className="flex-1 py-2.5 bg-[hsl(var(--primary))] hover:opacity-90 disabled:opacity-50 text-white font-sans font-bold text-xs rounded-xl transition-all"
              >
                {isCustLoading ? 'Mendaftarkan...' : 'Daftar Pelanggan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

