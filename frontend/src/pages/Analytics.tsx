import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import * as XLSX from 'xlsx'
import {
  TrendingUp,
  Clock,
  Crown,
  Package,
  BarChart3,
  Calendar,
  RefreshCw,
  AlertTriangle,
  ArrowDownRight,
  Phone,
  Download,
  CreditCard,
  Layers,
  FileText,
  FileSpreadsheet,
  ChevronDown
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Cell as PieCell
} from 'recharts'

interface SalesTrendItem {
  date: string
  sales: number
  orders: number
}

interface BusyHourItem {
  hour: number
  transaction_count: number
}

interface CustomerRankingItem {
  id: string
  name: string
  phone: string
  total_spent: number
  total_transactions: number
}

interface RunoutPrediction {
  ingredient_id: string
  ingredient_name: string
  current_stock: number
  unit: string
  avg_daily_usage: number
  days_remaining: number
  estimated_runout_date?: string
}

interface PaymentMethodItem {
  payment_method: string
  total_sales: number
  transaction_count: number
}

interface CategorySalesItem {
  category_name: string
  total_sales: number
  total_quantity: number
}

export default function Analytics() {
  const [salesTrend, setSalesTrend] = useState<SalesTrendItem[]>([])
  const [busyHours, setBusyHours] = useState<BusyHourItem[]>([])
  const [customerRanking, setCustomerRanking] = useState<CustomerRankingItem[]>([])
  const [runoutPredictions, setRunoutPredictions] = useState<RunoutPrediction[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([])
  const [categorySales, setCategorySales] = useState<CategorySalesItem[]>([])
  const [salesPeriod, setSalesPeriod] = useState<'7' | '30' | '90' | 'custom'>('30')
  const [salesTrendPeriod, setSalesTrendPeriod] = useState<'daily' | 'monthly'>('daily')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [showSalesExport, setShowSalesExport] = useState(false)
  const [showStockExport, setShowStockExport] = useState(false)

  const formatIDR = (val: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val)

  const fetchAnalytics = useCallback(async () => {
    if (salesPeriod === 'custom' && (!startDate || !endDate)) {
      console.log('Analytics: Custom range selected but dates are incomplete:', { startDate, endDate })
      return
    }

    setLoading(true)
    try {
      let queryStr = `period=${salesTrendPeriod}`
      if (salesPeriod === 'custom') {
        queryStr += `&start_date=${startDate}&end_date=${endDate}`
      } else {
        queryStr += `&days=${salesPeriod}`
      }

      console.log('Analytics: Fetching data with params:', queryStr)

      const [trendRes, busyRes, rankRes, runoutRes, payRes, catRes] = await Promise.all([
        api.get(`/analytics/sales-trend?${queryStr}`),
        api.get(`/analytics/busy-hours?${queryStr}`),
        api.get('/analytics/customers/ranking?limit=10'),
        api.get('/analytics/runout-predictions'),
        api.get(`/analytics/payment-methods?${queryStr}`),
        api.get(`/analytics/category-sales?${queryStr}`)
      ])

      console.log('Analytics: Fetch successful. SalesTrend size:', trendRes.data.data?.length || 0)

      setSalesTrend(trendRes.data.data || [])
      setBusyHours(busyRes.data.data || [])
      setCustomerRanking(rankRes.data.data || [])
      setRunoutPredictions(runoutRes.data.data || [])
      setPaymentMethods(payRes.data.data || [])
      setCategorySales(catRes.data.data || [])
    } catch (err) {
      console.error('Gagal memuat analytics:', err)
    } finally {
      setLoading(false)
    }
  }, [salesPeriod, salesTrendPeriod, startDate, endDate])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Compute summary stats from sales trend
  const totalRevenue = salesTrend.reduce((s, d) => s + d.sales, 0)
  const totalOrders = salesTrend.reduce((s, d) => s + d.orders, 0)
  const avgDailyRevenue = salesTrend.length > 0 ? totalRevenue / salesTrend.length : 0

  // Find peak hour
  const peakHour = busyHours.reduce((max, h) => h.transaction_count > max.transaction_count ? h : max, { hour: 0, transaction_count: 0 })

  // Critical stock items
  const criticalItems = runoutPredictions.filter(p => p.days_remaining >= 0 && p.days_remaining <= 3)

  // Format sales trend dates for display
  const formattedTrend = salesTrend.map(d => {
    if (salesTrendPeriod === 'monthly') {
      const parts = d.date.split('-')
      if (parts.length === 2) {
        const year = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10) - 1
        const dateObj = new Date(year, month, 1)
        return {
          ...d,
          label: dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
        }
      }
    }
    return {
      ...d,
      label: new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
    }
  })

  // Busy hours filter to operational hours (08:00 - 22:00)
  const operatingHours = busyHours.filter(h => h.hour >= 8 && h.hour <= 22)
  const maxBusyCount = Math.max(...operatingHours.map(h => h.transaction_count), 1)

  // Pie chart helper for payment methods
  const paymentPieData = paymentMethods.map(item => ({
    name: item.payment_method === 'cash' ? '💵 Tunai' : item.payment_method === 'transfer' ? '🏦 Transfer' : '🌐 Midtrans',
    value: item.total_sales,
    count: item.transaction_count
  }))

  const PIE_COLORS = ['#10B981', '#3B82F6', '#F95A2C'] // Green, Blue, Mentai Orange

  // File Exporter helper
  const exportFile = (headers: string[], rows: any[][], baseFilename: string, format: 'csv' | 'xlsx') => {
    if (format === 'csv') {
      const csvContent = [headers.join(",")].concat(rows.map(r => r.map(val => {
        const stringVal = val === null || val === undefined ? '' : String(val)
        return `"${stringVal.replace(/"/g, '""')}"`
      }).join(","))).join("\r\n")

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${baseFilename}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      const data = [headers, ...rows]
      const worksheet = XLSX.utils.aoa_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan')
      XLSX.writeFile(workbook, `${baseFilename}.xlsx`)
    }
  }

  const exportSalesTrend = (format: 'csv' | 'xlsx') => {
    const headers = ['Tanggal', 'Omzet Penjualan (IDR)', 'Jumlah Pesanan']
    const rows = salesTrend.map(item => [
      item.date,
      item.sales,
      item.orders
    ])
    const name = salesPeriod === 'custom'
      ? `Laporan_Penjualan_POS_${startDate}_sd_${endDate}`
      : `Laporan_Penjualan_POS_${salesPeriod}D`
    exportFile(headers, rows, name, format)
  }

  const exportStockPredictions = (format: 'csv' | 'xlsx') => {
    const headers = ['Bahan Baku', 'Stok Saat Ini', 'Satuan', 'Rata-rata Laju Pemakaian Harian', 'Estimasi Sisa Hari', 'Estimasi Tanggal Kehabisan']
    const rows = runoutPredictions.map(item => [
      item.ingredient_name,
      item.current_stock.toFixed(2),
      item.unit,
      item.avg_daily_usage.toFixed(2),
      item.days_remaining >= 0 ? `${item.days_remaining.toFixed(1)} hari` : 'Tidak ada penggunaan',
      item.estimated_runout_date || '—'
    ])
    exportFile(headers, rows, `Laporan_Prediksi_Stok_Bahan_Baku`, format)
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter Section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-[hsl(var(--foreground))] tracking-tight">
              Analytics & Laporan
            </h2>
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] font-sans">
              Laporan performa keuangan, grafik operasional, dan prediksi bahan baku Mentai Mental
            </p>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto">
            <div className="flex gap-1 bg-white rounded-2xl border border-[hsl(var(--border))] p-1">
              {(['7', '30', '90', 'custom'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => {
                    setSalesPeriod(p)
                    if (p !== 'custom') {
                      setStartDate('')
                      setEndDate('')
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                    salesPeriod === p
                      ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  {p === 'custom' ? 'Kustom' : `${p} Hari`}
                </button>
              ))}
            </div>
            <button
              onClick={fetchAnalytics}
              disabled={loading || (salesPeriod === 'custom' && (!startDate || !endDate))}
              className="flex items-center justify-center p-2.5 bg-white border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] rounded-2xl text-xs font-bold hover:bg-stone-50 transition-colors disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker Row */}
        {salesPeriod === 'custom' && (
          <div className="flex flex-wrap items-center justify-end gap-3 bg-white rounded-3xl p-4 border border-[hsl(var(--border))] animate-fade-in self-end">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" /> Mulai:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-[hsl(var(--border))] rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" /> Selesai:
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-[hsl(var(--border))] rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              />
            </div>
            <button
              onClick={fetchAnalytics}
              disabled={loading || !startDate || !endDate}
              className="px-4 py-1.5 bg-[hsl(var(--primary))] text-white text-[11px] font-extrabold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Terapkan
            </button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Omzet */}
        <div className="bg-white rounded-3xl p-5 border border-[hsl(var(--border))] hover-card-lift">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[hsl(var(--primary))]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200/50">
              Periode
            </span>
          </div>
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">Total Omzet</p>
          <p className="text-2xl font-display font-bold text-[hsl(var(--foreground))]">{formatIDR(totalRevenue)}</p>
        </div>

        {/* Total Pesanan */}
        <div className="bg-white rounded-3xl p-5 border border-[hsl(var(--border))] hover-card-lift">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">Total Pesanan</p>
          <p className="text-2xl font-display font-bold text-[hsl(var(--foreground))]">{totalOrders.toLocaleString('id-ID')} pesanan</p>
        </div>

        {/* Rata-rata Penjualan */}
        <div className="bg-white rounded-3xl p-5 border border-[hsl(var(--border))] hover-card-lift">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">Rata-rata / Hari</p>
          <p className="text-2xl font-display font-bold text-[hsl(var(--foreground))]">{formatIDR(avgDailyRevenue)}</p>
        </div>

        {/* Jam Sibuk */}
        <div className="bg-white rounded-3xl p-5 border border-[hsl(var(--border))] hover-card-lift">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1">Jam Tersibuk</p>
          <p className="text-2xl font-display font-bold text-[hsl(var(--foreground))]">
            {peakHour.transaction_count > 0 ? `${String(peakHour.hour).padStart(2, '0')}:00` : '—'}
          </p>
          {peakHour.transaction_count > 0 && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold mt-0.5">{peakHour.transaction_count} transaksi historis</p>
          )}
        </div>
      </div>

      {/* Main Charts Area: Sales Trend */}
      <div className="bg-white rounded-3xl p-6 border border-[hsl(var(--border))]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-base font-display font-bold text-[hsl(var(--foreground))]">
              Tren Perkembangan Omzet
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
              Analisis pertumbuhan omzet {salesTrendPeriod === 'daily' ? 'harian' : 'bulanan'} Mentai Mental
            </p>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            {/* Daily / Monthly Toggle */}
            <div className="flex gap-0.5 bg-stone-100 rounded-xl p-0.5 border border-stone-200">
              <button
                onClick={() => setSalesTrendPeriod('daily')}
                className={`px-3 py-1 rounded-lg text-[10px] font-extrabold tracking-wide uppercase transition-all ${
                  salesTrendPeriod === 'daily'
                    ? 'bg-white text-[hsl(var(--primary))] shadow-sm'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Harian
              </button>
              <button
                onClick={() => setSalesTrendPeriod('monthly')}
                className={`px-3 py-1 rounded-lg text-[10px] font-extrabold tracking-wide uppercase transition-all ${
                  salesTrendPeriod === 'monthly'
                    ? 'bg-white text-[hsl(var(--primary))] shadow-sm'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Bulanan
              </button>
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowSalesExport(!showSalesExport)}
                disabled={salesTrend.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 border border-[hsl(var(--border))] rounded-xl text-[11px] font-extrabold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-all disabled:opacity-50"
              >
              <Download className="w-3.5 h-3.5" />
              Ekspor
              <ChevronDown className="w-3 h-3 text-stone-400" />
            </button>
            {showSalesExport && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowSalesExport(false)} 
                />
                <div className="absolute right-0 mt-1.5 w-40 bg-white rounded-2xl border border-[hsl(var(--border))] shadow-xl py-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-100">
                  <button
                    onClick={() => {
                      exportSalesTrend('csv')
                      setShowSalesExport(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-bold text-stone-600 hover:text-[hsl(var(--foreground))] hover:bg-stone-50 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-stone-400" />
                    Ekspor ke CSV
                  </button>
                  <button
                    onClick={() => {
                      exportSalesTrend('xlsx')
                      setShowSalesExport(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-bold text-stone-600 hover:text-[hsl(var(--foreground))] hover:bg-stone-50 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                    Ekspor ke Excel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

        {formattedTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={formattedTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(14, 96%, 58%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(14, 96%, 58%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(33, 14%, 90%)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: 'hsl(24, 10%, 40%)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: 'hsl(24, 10%, 40%)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '16px',
                  border: '1px solid hsl(33, 14%, 85%)',
                  fontSize: '11px',
                  fontWeight: 600,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.04)'
                }}
                formatter={(value: any) => [formatIDR(value as number), 'Omzet']}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="hsl(14, 96%, 58%)"
                strokeWidth={2.5}
                fill="url(#salesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-[hsl(var(--muted-foreground))] text-sm bg-stone-50/50 rounded-2xl border border-dashed">
            {loading ? 'Memuat data tren...' : 'Belum ada data penjualan pada periode ini'}
          </div>
        )}
      </div>

      {/* Grid: Payment Method Pie Chart + Category Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Method Distribution */}
        <div className="bg-white rounded-3xl p-6 border border-[hsl(var(--border))] flex flex-col justify-between">
          <div>
            <h3 className="text-base font-display font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[hsl(var(--primary))]" />
              Porsi Metode Pembayaran
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium mb-6">
              Metode pembayaran paling disukai pelanggan
            </p>
          </div>

          {paymentPieData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 h-56">
              <div className="h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {paymentPieData.map((_, index) => (
                        <PieCell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid hsl(33, 14%, 85%)', fontSize: '11px' }}
                      formatter={(value: any) => [formatIDR(value as number), 'Total Omzet']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2.5">
                {paymentPieData.map((item, idx) => {
                  const percent = totalRevenue > 0 ? ((item.value / totalRevenue) * 100).toFixed(0) : 0
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} 
                      />
                      <div>
                        <p className="text-xs font-bold text-[hsl(var(--foreground))]">{item.name}</p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold">
                          {formatIDR(item.value)} • {percent}% ({item.count} order)
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-[hsl(var(--muted-foreground))] text-sm">
              {loading ? 'Memuat data...' : 'Tidak ada data metode pembayaran'}
            </div>
          )}
        </div>

        {/* Category Performance */}
        <div className="bg-white rounded-3xl p-6 border border-[hsl(var(--border))] flex flex-col justify-between">
          <div>
            <h3 className="text-base font-display font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-600" />
              Kontribusi Omzet Kategori
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium mb-6">
              Total omzet yang dikontribusikan oleh setiap kategori menu
            </p>
          </div>

          {categorySales.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categorySales} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(33, 14%, 92%)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(24, 10%, 40%)' }} axisLine={false} tickLine={false} />
                  <YAxis 
                    dataKey="category_name" 
                    type="category" 
                    width={85} 
                    tick={{ fontSize: 9, fill: 'hsl(24, 10%, 40%)' }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(33, 14%, 85%)', fontSize: '11px', fontWeight: 600 }}
                    formatter={(value: any) => [formatIDR(value), 'Total Omzet']}
                  />
                  <Bar dataKey="total_sales" radius={[0, 6, 6, 0]}>
                    {categorySales.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? 'hsl(14, 96%, 58%)' : `hsl(14, ${80 - i * 15}%, ${68 + i * 5}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-[hsl(var(--muted-foreground))] text-sm">
              {loading ? 'Memuat data...' : 'Tidak ada data kategori'}
            </div>
          )}
        </div>
      </div>

      {/* Grid: Historical Busy Hours + Loyal Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Busy Hours */}
        <div className="bg-white rounded-3xl p-6 border border-[hsl(var(--border))]">
          <div className="mb-5">
            <h3 className="text-base font-display font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[hsl(var(--primary))]" />
              Kepadatan Transaksi Historis
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
              Frekuensi transaksi berdasarkan jam buka toko (periode terpilih)
            </p>
          </div>

          {operatingHours.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={operatingHours} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(33, 14%, 92%)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9, fill: 'hsl(24, 10%, 40%)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(h) => `${h}:00`}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'hsl(24, 10%, 40%)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid hsl(33, 14%, 85%)',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                  formatter={(value: any) => [value, 'Transaksi']}
                  labelFormatter={(h) => `Jam ${h}:00`}
                />
                <Bar dataKey="transaction_count" radius={[6, 6, 0, 0]}>
                  {operatingHours.map((entry) => (
                    <Cell
                      key={`cell-${entry.hour}`}
                      fill={
                        entry.transaction_count >= maxBusyCount * 0.8
                          ? 'hsl(14, 96%, 58%)'
                          : entry.transaction_count >= maxBusyCount * 0.5
                          ? 'hsl(24, 80%, 68%)'
                          : 'hsl(24, 25%, 82%)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-[hsl(var(--muted-foreground))] text-sm bg-stone-50/30 rounded-2xl border border-dashed">
              {loading ? 'Memuat...' : 'Tidak ada data jam sibuk'}
            </div>
          )}
        </div>

        {/* Customer Loyalty Ranking */}
        <div className="bg-white rounded-3xl p-6 border border-[hsl(var(--border))]">
          <div className="mb-5">
            <h3 className="text-base font-display font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              10 Pelanggan Terloyal
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
              Pelanggan yang terdaftar dengan total pembelanjaan tertinggi
            </p>
          </div>

          {customerRanking.length > 0 ? (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {customerRanking.map((cust, idx) => (
                <div
                  key={cust.id}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-stone-50 transition-colors border border-transparent hover:border-[hsl(var(--border))]/40"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-display font-bold text-xs ${
                    idx === 0 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                    idx === 1 ? 'bg-stone-200 text-stone-700 border border-stone-300' :
                    idx === 2 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                    'bg-stone-100 text-stone-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[hsl(var(--foreground))] truncate">{cust.name}</p>
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))] flex items-center gap-1 font-semibold">
                      <Phone className="w-3 h-3 text-stone-400" /> {cust.phone} • {cust.total_transactions} pesanan
                    </p>
                  </div>
                  <p className="text-xs font-display font-extrabold text-[hsl(var(--primary))] bg-orange-50/50 border border-orange-100/50 px-2.5 py-1 rounded-xl">
                    {formatIDR(cust.total_spent)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-[hsl(var(--muted-foreground))] text-sm bg-stone-50/30 rounded-2xl border border-dashed">
              {loading ? 'Memuat...' : 'Belum ada data pelanggan'}
            </div>
          )}
        </div>
      </div>

      {/* Stock Runout Predictions Table */}
      <div className="bg-white rounded-3xl p-6 border border-[hsl(var(--border))]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-display font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
              <Package className="w-4 h-4 text-[hsl(var(--primary))]" />
              Estimasi Kehabisan Bahan Baku
            </h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
              Analisis laju habis persediaan dihitung dari rata-rata penjualan 7 hari terakhir
            </p>
          </div>
          <div className="flex items-center gap-2">
            {criticalItems.length > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-extrabold uppercase border border-rose-100">
                <AlertTriangle className="w-3.5 h-3.5" />
                {criticalItems.length} Kritis
              </span>
            )}
            <div className="relative">
              <button 
                onClick={() => setShowStockExport(!showStockExport)}
                disabled={runoutPredictions.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 border border-[hsl(var(--border))] rounded-xl text-[11px] font-extrabold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-all disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Ekspor
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>
              {showStockExport && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowStockExport(false)} 
                  />
                  <div className="absolute right-0 mt-1.5 w-40 bg-white rounded-2xl border border-[hsl(var(--border))] shadow-xl py-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-100">
                    <button
                      onClick={() => {
                        exportStockPredictions('csv')
                        setShowStockExport(false)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-bold text-stone-600 hover:text-[hsl(var(--foreground))] hover:bg-stone-50 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-stone-400" />
                      Ekspor ke CSV
                    </button>
                    <button
                      onClick={() => {
                        exportStockPredictions('xlsx')
                        setShowStockExport(false)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-bold text-stone-600 hover:text-[hsl(var(--foreground))] hover:bg-stone-50 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                      Ekspor ke Excel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {runoutPredictions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                  <th className="py-3 px-3">Bahan Baku</th>
                  <th className="py-3 px-3 text-right">Stok Saat Ini</th>
                  <th className="py-3 px-3 text-right">Rata-rata Terpakai / Hari</th>
                  <th className="py-3 px-3 text-center">Status Sisa Hari</th>
                  <th className="py-3 px-3 text-right">Perkiraan Habis</th>
                </tr>
              </thead>
              <tbody>
                {runoutPredictions
                  .sort((a, b) => {
                    // Critical first (0 to 3 days), then warning (4 to 7), then infinity/safe
                    if (a.days_remaining >= 0 && b.days_remaining < 0) return -1
                    if (a.days_remaining < 0 && b.days_remaining >= 0) return 1
                    if (a.days_remaining >= 0 && b.days_remaining >= 0) return a.days_remaining - b.days_remaining
                    return 0
                  })
                  .map((pred) => {
                    const isCritical = pred.days_remaining >= 0 && pred.days_remaining <= 3
                    const isWarning = pred.days_remaining > 3 && pred.days_remaining <= 7
                    const noUsage = pred.days_remaining < 0

                    return (
                      <tr
                        key={pred.ingredient_id}
                        className={`border-b border-[hsl(var(--border))]/50 transition-colors ${
                          isCritical ? 'bg-rose-50/20' : isWarning ? 'bg-amber-50/20' : 'hover:bg-stone-50/30'
                        }`}
                      >
                        <td className="py-3.5 px-3 font-semibold text-[hsl(var(--foreground))]">
                          <div className="flex items-center gap-2">
                            {isCritical && <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 animate-bounce" />}
                            {isWarning && <ArrowDownRight className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                            {pred.ingredient_name}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-[hsl(var(--foreground))]">
                          {pred.current_stock.toFixed(1)} <span className="text-[9px] text-[hsl(var(--muted-foreground))] uppercase font-semibold">{pred.unit}</span>
                        </td>
                        <td className="py-3.5 px-3 text-right font-medium text-[hsl(var(--muted-foreground))]">
                          {noUsage ? '—' : `${pred.avg_daily_usage.toFixed(1)} ${pred.unit}`}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {noUsage ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold text-stone-400 bg-stone-100">
                              Tidak Ada Penggunaan
                            </span>
                          ) : (
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              isCritical
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : isWarning
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {pred.days_remaining.toFixed(0)} hari lagi
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-[hsl(var(--muted-foreground))]">
                          {pred.estimated_runout_date
                            ? new Date(pred.estimated_runout_date).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-[hsl(var(--muted-foreground))] text-sm bg-stone-50/30 rounded-2xl border border-dashed">
            {loading ? 'Memuat laporan sisa stok...' : 'Belum ada bahan baku terdaftar'}
          </div>
        )}
      </div>
    </div>
  )
}
