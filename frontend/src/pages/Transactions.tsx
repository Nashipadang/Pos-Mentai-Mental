import { useState, useMemo, useEffect, useCallback } from 'react'
import { usePOSStore } from '../store/posStore'
import { useAuthStore } from '../store/authStore'
import { 
  Receipt, 
  Search, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Printer, 
  ChevronRight, 
  Filter, 
  ArrowRight,
  RefreshCw,
  User,
  ShoppingBag,
  FileText
} from 'lucide-react'
import CustomSelect from '../components/ui/CustomSelect'
import ConfirmModal from '../components/ui/ConfirmModal'
import api, { formatTxId } from '../lib/api'
import Pagination from '../components/ui/Pagination'

export default function Transactions() {
  const { customers, products, cancelTransaction, settings } = usePOSStore()
  const { user } = useAuthStore()

  // State
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | '7days' | '30days' | 'custom'>('today')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null)
  
  // Pagination State
  const [paginatedTxs, setPaginatedTxs] = useState<any[]>([])
  const [totalTxs, setTotalTxs] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)

  // Get active transaction details
  const activeTx = useMemo(() => {
    if (!selectedTxId) return null
    return paginatedTxs.find(t => t.id === selectedTxId) || null
  }, [selectedTxId, paginatedTxs])

  // Void modal state
  const [showVoidConfirm, setShowVoidConfirm] = useState(false)
  const [txToVoidId, setTxToVoidId] = useState<string | null>(null)

  // State variables for WhatsApp Gateway manual sending
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [waPhoneInput, setWaPhoneInput] = useState('')
  const [waSendStatus, setWaSendStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' })

  useEffect(() => {
    if (activeTx) {
      const customer = activeTx.customer_id
        ? customers.find((c) => c.id === activeTx.customer_id)
        : null
      setWaPhoneInput(customer && customer.phone ? customer.phone : '')
      setWaSendStatus({ type: 'idle', message: '' })
    } else {
      setWaPhoneInput('')
      setWaSendStatus({ type: 'idle', message: '' })
    }
  }, [activeTx, customers])

  const handleSendWhatsAppReceipt = async () => {
    if (!activeTx) return

    setSendingWhatsApp(true)
    setWaSendStatus({ type: 'idle', message: '' })

    try {
      const resp = await api.post(`/transactions/${activeTx.id}/send-whatsapp-receipt`, {
        phone: waPhoneInput
      })
      setWaSendStatus({
        type: 'success',
        message: resp.data.message || 'Struk WhatsApp berhasil dikirim ke pelanggan!'
      })
    } catch (err: any) {
      console.error('Failed to send WhatsApp receipt:', err)
      const errMsg = err.response?.data?.message || err.message || 'Gagal terhubung ke server.'
      setWaSendStatus({
        type: 'error',
        message: `Gagal mengirim struk: ${errMsg}`
      })
    } finally {
      setSendingWhatsApp(false)
    }
  }

  // ── Date Filtering Helper Functions ──────────────────────────────
  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getFilterDates = useCallback(() => {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    let startStr = ''
    let endStr = ''

    if (dateFilter === 'today') {
      startStr = toLocalDateString(today)
      endStr = toLocalDateString(today)
    } else if (dateFilter === 'yesterday') {
      startStr = toLocalDateString(yesterday)
      endStr = toLocalDateString(yesterday)
    } else if (dateFilter === '7days') {
      const start = new Date()
      start.setDate(start.getDate() - 7)
      startStr = toLocalDateString(start)
      endStr = toLocalDateString(new Date())
    } else if (dateFilter === '30days') {
      const start = new Date()
      start.setDate(start.getDate() - 30)
      startStr = toLocalDateString(start)
      endStr = toLocalDateString(new Date())
    } else if (dateFilter === 'custom') {
      startStr = startDate
      endStr = endDate
    }
    return { startStr, endStr }
  }, [dateFilter, startDate, endDate])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const { startStr, endStr } = getFilterDates()
      const resp = await api.get('/transactions', {
        params: {
          page,
          limit,
          search,
          status: statusFilter,
          payment_method: paymentFilter,
          start_date: startStr,
          end_date: endStr
        }
      })
      setPaginatedTxs(resp.data.data || [])
      setTotalTxs(resp.data.meta?.total || 0)
    } catch (err) {
      console.error("Gagal memuat transaksi terpaginasi:", err)
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, getFilterDates, paymentFilter, statusFilter])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setPage(1)
  }, [search, dateFilter, startDate, endDate, paymentFilter, statusFilter])



  // Handlers
  const handleSelectTx = (id: string) => {
    setSelectedTxId(id)
  }

  const handleSimulateWebhook = async (tx: any) => {
    try {
      await api.post('/transactions/midtrans-webhook', {
        order_id: tx.id,
        transaction_status: 'settlement',
        payment_type: 'qris',
        status_code: '200',
        gross_amount: tx.total_amount.toString(),
        fraud_status: 'accept'
      })
      fetchTransactions()
    } catch (err) {
      console.error("Gagal mengirim simulasi webhook:", err)
    }
  }

  const handleVoidClick = (id: string) => {
    setTxToVoidId(id)
    setShowVoidConfirm(true)
  }

  const handleConfirmVoid = async () => {
    if (txToVoidId) {
      try {
        await cancelTransaction(txToVoidId)
        fetchTransactions()
      } catch (err) {
        console.error("Gagal membatalkan transaksi:", err)
      }
    }
    setShowVoidConfirm(false)
    setTxToVoidId(null)
  }

  const handleCancelVoid = () => {
    setShowVoidConfirm(false)
    setTxToVoidId(null)
  }

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-[hsl(var(--foreground))] tracking-tight">
            Riwayat Transaksi
          </h2>
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] font-sans">
            Pantau omzet harian, status pembayaran, dan cetak ulang struk pesanan Mentai Mental
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-2xl border border-[hsl(var(--border))] text-xs font-bold text-[hsl(var(--muted-foreground))] shadow-sm">
            <Clock className="w-4 h-4 text-[hsl(var(--primary))]" />
            Hari ini: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          
          <button
            type="button"
            onClick={fetchTransactions}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] font-sans font-bold text-xs rounded-2xl transition shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[hsl(var(--primary))]" />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Main Grid split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT PANE: Filters & Transactions Table (Takes 2 cols on lg) */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          
          {/* Filter Card */}
          <div className="bg-white rounded-3xl border border-[hsl(var(--border))] p-6 space-y-4 shadow-sm">
            <h3 className="font-display font-bold text-sm text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-1.5 border-b border-[hsl(var(--border))]/40 pb-2">
              <Filter className="w-4 h-4 text-[hsl(var(--primary))]" />
              Filter Pencarian
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Search input */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Cari Transaksi
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                  <input
                    type="text"
                    placeholder="ID Transaksi / Pelanggan..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-[hsl(var(--border))] rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
              </div>

              {/* Date Filter Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Rentang Waktu
                </label>
                <CustomSelect
                  value={dateFilter}
                  onChange={(val) => {
                    setDateFilter(val as any)
                    // Reset custom range if not custom
                    if (val !== 'custom') {
                      setStartDate('')
                      setEndDate('')
                    }
                  }}
                  options={[
                    { value: 'all', label: 'Semua Waktu' },
                    { value: 'today', label: 'Hari Ini (Default)' },
                    { value: 'yesterday', label: 'Kemarin' },
                    { value: '7days', label: '7 Hari Terakhir' },
                    { value: '30days', label: '30 Hari Terakhir' },
                    { value: 'custom', label: 'Rentang Kustom...' }
                  ]}
                />
              </div>

              {/* Payment Filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Metode Pembayaran
                </label>
                <CustomSelect
                  value={paymentFilter}
                  onChange={setPaymentFilter}
                  options={[
                    { value: 'all', label: 'Semua Metode' },
                    { value: 'cash', label: 'Tunai (Cash)' },
                    { value: 'transfer', label: 'Transfer Bank' },
                    { value: 'midtrans', label: 'Midtrans QRIS' }
                  ]}
                />
              </div>

              {/* Status Filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Status Transaksi
                </label>
                <CustomSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'Semua Status' },
                    { value: 'completed', label: 'Selesai' },
                    { value: 'pending', label: 'Tertunda (Pending)' },
                    { value: 'cancelled', label: 'Dibatalkan (Void)' }
                  ]}
                />
              </div>
            </div>

            {/* Custom Date Range Panel (Visible only when dateFilter is 'custom') */}
            {dateFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[hsl(var(--border))]/40 animate-fade-in">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[hsl(var(--border))] rounded-xl text-xs bg-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[hsl(var(--border))] rounded-xl text-xs bg-white focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Transactions List Table Card */}
          <div className="bg-white rounded-3xl border border-[hsl(var(--border))] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-[hsl(var(--background))]/50 border-b border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] uppercase font-extrabold tracking-wider">
                    <th className="px-6 py-4">ID Transaksi</th>
                    <th className="px-6 py-4">Waktu</th>
                    <th className="px-6 py-4">Pelanggan</th>
                    <th className="px-6 py-4">Pembayaran</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-stone-400 font-sans font-bold text-xs space-y-2">
                        <RefreshCw className="w-8 h-8 mx-auto text-[hsl(var(--primary))] animate-spin" />
                        <p>Memuat data transaksi...</p>
                      </td>
                    </tr>
                  ) : paginatedTxs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-stone-400 font-sans font-bold text-xs space-y-1">
                        <Receipt className="w-10 h-10 mx-auto text-stone-300 stroke-[1.5]" />
                        <p>Tidak ada transaksi yang cocok dengan filter saat ini.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedTxs.map((tx) => {
                      const isSelected = selectedTxId === tx.id
                      const customer = tx.customer_id ? customers.find(c => c.id === tx.customer_id) : null
                      const timeStr = new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                      const dateStr = new Date(tx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

                      return (
                        <tr 
                          key={tx.id} 
                          onClick={() => handleSelectTx(tx.id)}
                          className={`hover:bg-[hsl(var(--background))]/30 transition-colors cursor-pointer ${
                            isSelected ? 'bg-[hsl(var(--accent))]/40 font-bold' : ''
                          }`}
                        >
                          <td className="px-6 py-4 font-mono font-extrabold text-[hsl(var(--foreground))] text-[10px] uppercase tracking-wider">
                            {formatTxId(tx.id)}
                          </td>
                          <td className="px-6 py-4 text-stone-600 font-medium">
                            {dateStr}, {timeStr}
                          </td>
                          <td className="px-6 py-4 font-bold text-[hsl(var(--foreground))]">
                            {customer ? customer.name : 'Walk-In'}
                          </td>
                          <td className="px-6 py-4 font-extrabold text-stone-500 uppercase tracking-wide">
                            {tx.payment_method}
                          </td>
                          <td className="px-6 py-4 font-extrabold text-[hsl(var(--primary))] text-sm">
                            {formatIDR(tx.total_amount)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                              tx.status === 'completed' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : tx.status === 'pending'
                                ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse'
                                : 'bg-red-50 text-red-600 border border-red-100'
                            }`}>
                              {tx.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5" />}
                              {tx.status === 'pending' && <Clock className="w-2.5 h-2.5" />}
                              {tx.status === 'cancelled' && <XCircle className="w-2.5 h-2.5" />}
                              {tx.status === 'completed' ? 'Selesai' : tx.status === 'pending' ? 'Tertunda' : 'Void'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <ChevronRight className={`w-4 h-4 ml-auto text-stone-400 transition-transform ${
                              isSelected ? 'translate-x-1 text-[hsl(var(--primary))]' : ''
                            }`} />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              totalItems={totalTxs}
              itemsPerPage={limit}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          </div>
        </div>

        {/* RIGHT PANE: Receipt Preview Details panel (Takes 1 col on lg) */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-[hsl(var(--border))] p-6 space-y-6 shadow-sm">
          {!activeTx ? (
            <div className="py-24 text-center text-stone-400 font-sans font-bold text-xs space-y-2">
              <Receipt className="w-12 h-12 mx-auto text-stone-300 stroke-[1.5]" />
              <p>Pilih transaksi di tabel sebelah kiri untuk melihat detail struk penjualan.</p>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* Receipt metadata heading */}
              <div className="flex justify-between items-center border-b border-[hsl(var(--border))]/60 pb-3">
                <h4 className="text-xs font-bold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[hsl(var(--primary))]" />
                  Struk Penjualan
                </h4>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                  activeTx.status === 'completed' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : activeTx.status === 'pending'
                    ? 'bg-amber-50 text-amber-600 border border-amber-100'
                    : 'bg-red-50 text-red-600 border border-red-100'
                }`}>
                  {activeTx.status === 'completed' ? 'LUNAS' : activeTx.status === 'pending' ? 'PENDING' : 'VOID'}
                </span>
              </div>

              {/* Printable Receipt Frame (formatted as actual thermal receipt) */}
              <div className="bg-stone-50 border border-[hsl(var(--border))] rounded-2xl p-5 space-y-4 font-mono text-[11px] text-[hsl(var(--foreground))] max-h-[350px] overflow-y-auto printable-receipt-container">
                <div className="text-center space-y-0.5">
                  <h4 className="font-display font-extrabold text-sm text-[hsl(var(--primary))] tracking-wide">
                    {settings.receipt_header || 'MENTAI MENTAL'}
                  </h4>
                  <p className="text-[10px] text-stone-500">{settings.store_address || 'Jalan Dimsum No. 1, Jakarta'}</p>
                  <p className="border-b border-dashed border-stone-300 py-1" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>ID Transaksi:</span>
                    <span className="font-bold">{formatTxId(activeTx.id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tanggal:</span>
                    <span>{new Date(activeTx.created_at).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span className="font-semibold">Budi (Staff)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span className="font-semibold">
                      {activeTx.customer_id 
                        ? customers.find(c => c.id === activeTx.customer_id)?.name 
                        : 'Walk-In'}
                    </span>
                  </div>
                  <p className="border-b border-dashed border-stone-300 py-1" />
                </div>

                <div className="space-y-2">
                  {activeTx.items?.map((item: any, idx: number) => {
                    const pName = products.find(p => p.id === item.product_id)?.name || 'Menu Dimsum'
                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between font-bold">
                          <span>{pName}</span>
                          <span>{formatIDR(item.subtotal || 0)}</span>
                        </div>
                        <div className="text-stone-500">
                          {item.quantity} porsi x {formatIDR(item.unit_price || 0)}
                        </div>
                      </div>
                    )
                  })}
                  <p className="border-b border-dashed border-stone-300 py-1" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-extrabold text-xs">
                    <span>TOTAL BELANJA</span>
                    <span>{formatIDR(activeTx.total_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>METODE BAYAR:</span>
                    <span className="uppercase font-semibold">{activeTx.payment_method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>STATUS BAYAR:</span>
                    <span className={`uppercase font-bold ${
                      activeTx.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                    }`}>{activeTx.payment_status}</span>
                  </div>
                </div>

                <div className="text-center pt-2 border-t border-dashed border-stone-300 text-[10px] text-stone-500 whitespace-pre-line leading-normal">
                  {(settings.receipt_footer || 'Terima kasih atas pesanan Anda!\nMentai Mental - Dimsum Mentai Juara').replace(/\\n/g, '\n')}
                </div>
              </div>

              {/* WhatsApp Gateway Send Panel */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3 shadow-inner">
                <label className="block text-[10px] font-extrabold uppercase text-stone-500 tracking-wider">
                  Kirim Struk via WhatsApp Gateway
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={waPhoneInput}
                    onChange={(e) => setWaPhoneInput(e.target.value)}
                    placeholder="Nomor HP (contoh: 08123456789)"
                    disabled={sendingWhatsApp}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] disabled:opacity-60 text-[hsl(var(--foreground))]"
                  />
                  <button
                    onClick={handleSendWhatsAppReceipt}
                    disabled={sendingWhatsApp || !waPhoneInput}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {sendingWhatsApp ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Kirim...
                      </>
                    ) : (
                      'Kirim'
                    )}
                  </button>
                </div>
                {waSendStatus.message && (
                  <p className={`text-[10px] font-bold ${waSendStatus.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {waSendStatus.message}
                  </p>
                )}
              </div>

              {/* Action Controls */}
              <div className="space-y-2 pt-2 border-t border-[hsl(var(--border))]/55">
                {activeTx.payment_method === 'midtrans' && activeTx.status === 'pending' && (
                  <button
                    onClick={() => handleSimulateWebhook(activeTx)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Simulasikan Lunas (Webhook)
                  </button>
                )}

                <button
                  onClick={() => {
                    window.print()
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-xs font-bold rounded-xl transition cursor-pointer text-[hsl(var(--foreground))] shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Ulang Struk
                </button>

                {/* Cancel/Void Button: Only owner can void, and only for non-cancelled transactions */}
                {user?.role === 'owner' && activeTx.status !== 'cancelled' && (
                  <button
                    onClick={() => handleVoidClick(activeTx.id)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    Batalkan Transaksi (Void)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Void Confirmation Modal */}
      <ConfirmModal
        isOpen={showVoidConfirm}
        title="Batalkan Transaksi (Void)?"
        message={`Apakah Anda yakin ingin membatalkan transaksi ${txToVoidId ? formatTxId(txToVoidId) : ''}? Tindakan ini akan mengembalikan stok bahan baku ke gudang (BOM Rollback) dan mengurangi akumulasi transaksi pelanggan.`}
        confirmText="Ya, Batalkan"
        cancelText="Tutup"
        type="danger"
        onConfirm={handleConfirmVoid}
        onCancel={handleCancelVoid}
      />
    </div>
  )
}
