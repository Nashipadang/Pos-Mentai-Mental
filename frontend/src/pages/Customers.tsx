import { useState, useMemo, useEffect } from 'react'
import { usePOSStore } from '../store/posStore'
import { useAuthStore } from '../store/authStore'
import ConfirmModal from '../components/ui/ConfirmModal'
import { formatTxId } from '../lib/api'
import { 
  Users, 
  Plus, 
  Search, 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  X, 
  ChevronRight,
  TrendingUp,
  Edit2,
  Trash2
} from 'lucide-react'

export default function Customers() {
  const { customers, transactions, products, addCustomer, updateCustomer, deleteCustomer } = usePOSStore()
  const { user } = useAuthStore()

  // State
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  // Customer Form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  // Edit/Delete Customer State
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [customerToDeleteId, setCustomerToDeleteId] = useState<string | null>(null)

  // Filter customers by search term
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesName = c.name.toLowerCase().includes(search.toLowerCase())
      const matchesPhone = c.phone.includes(search)
      return matchesName || matchesPhone
    })
  }, [customers, search])

  // Select customer detail
  const customerDetail = useMemo(() => {
    if (!selectedCustomerId) return null
    
    const customer = customers.find(c => c.id === selectedCustomerId)
    if (!customer) return null

    // Get all transactions for this customer
    const history = transactions
      .filter(tx => tx.customer_id === selectedCustomerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return {
      ...customer,
      history
    }
  }, [selectedCustomerId, customers, transactions])

  // Smooth scroll to details panel on mobile when customer is selected
  useEffect(() => {
    if (selectedCustomerId) {
      const detailsPanel = document.getElementById('customer-details-panel')
      if (detailsPanel) {
        detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [selectedCustomerId])

  // Handlers
  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !phone) return

    addCustomer({ name, phone })
    
    // Reset Form
    setName('')
    setPhone('')
    setShowAddModal(false)
  }

  const openEditModal = (cust: any) => {
    setEditingCustomerId(cust.id)
    setEditName(cust.name)
    setEditPhone(cust.phone)
    setShowEditModal(true)
  }

  const openDeleteConfirm = (id: string) => {
    setCustomerToDeleteId(id)
    setDeleteConfirmOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCustomerId || !editName || !editPhone) return

    try {
      await updateCustomer(editingCustomerId, { name: editName, phone: editPhone })
      setShowEditModal(false)
      setEditingCustomerId(null)
    } catch (err) {
      console.error("Gagal mengupdate pelanggan:", err)
    }
  }

  const handleConfirmDelete = async () => {
    if (!customerToDeleteId) return
    try {
      await deleteCustomer(customerToDeleteId)
      if (selectedCustomerId === customerToDeleteId) {
        setSelectedCustomerId(null)
      }
    } catch (err) {
      console.error("Gagal menghapus pelanggan:", err)
    }
    setDeleteConfirmOpen(false)
    setCustomerToDeleteId(null)
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
            Data Pelanggan
          </h2>
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] font-sans">
            Kelola data pembeli loyal dan pantau riwayat belanja mereka
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-xs rounded-2xl transition shadow-lg shadow-[hsl(var(--primary))/15] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Registrasi Pelanggan
        </button>
      </div>

      {/* Search & List Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: Customer List Table (takes 2 cols on lg) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-[hsl(var(--border))] overflow-hidden shadow-sm space-y-4">
          <div className="p-6 border-b border-[hsl(var(--border))]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
              <Users className="w-5 h-5 text-[hsl(var(--primary))]" />
              Daftar Member Loyal
            </h3>
            
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
              <input
                type="text"
                placeholder="Cari nama / nomor HP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-[hsl(var(--border))] rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] transition"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-[hsl(var(--background))]/50 border-b border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] uppercase font-extrabold tracking-wider">
                  <th className="px-6 py-4">Nama Pelanggan</th>
                  <th className="px-6 py-4">Nomor HP</th>
                  <th className="px-6 py-4">Total Kunjungan</th>
                  <th className="px-6 py-4">Total Belanja</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]/50">
                {filteredCustomers.map((cust) => (
                  <tr 
                    key={cust.id} 
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`hover:bg-[hsl(var(--background))]/30 transition-colors cursor-pointer ${
                      selectedCustomerId === cust.id ? 'bg-[hsl(var(--accent))]/40 animate-fade-in' : ''
                    }`}
                  >
                    <td className="px-6 py-4 font-bold text-[hsl(var(--foreground))] text-sm">
                      {cust.name}
                    </td>
                    <td className="px-6 py-4 font-semibold text-[hsl(var(--muted-foreground))]">
                      {cust.phone}
                    </td>
                    <td className="px-6 py-4 font-extrabold text-[hsl(var(--foreground))]">
                      {cust.total_transactions} Kali
                    </td>
                    <td className="px-6 py-4 font-extrabold text-[hsl(var(--primary))]">
                      {formatIDR(cust.total_spent)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => setSelectedCustomerId(cust.id)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 font-bold rounded-lg transition text-xs cursor-pointer ${
                            selectedCustomerId === cust.id 
                              ? 'bg-[hsl(var(--primary))] text-white shadow-sm' 
                              : 'bg-[hsl(var(--muted))] hover:bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]'
                          }`}
                        >
                          Detail <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        
                        <button
                          onClick={() => openEditModal(cust)}
                          className="p-1.5 border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] text-[hsl(var(--muted-foreground))] rounded-lg transition cursor-pointer"
                          title="Ubah detail pelanggan"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        
                        {user?.role === 'owner' && (
                          <button
                            onClick={() => openDeleteConfirm(cust.id)}
                            className="p-1.5 border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition cursor-pointer"
                            title="Hapus data pelanggan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected Customer Detail Panel */}
        <div id="customer-details-panel" className="bg-white rounded-3xl border border-[hsl(var(--border))] p-6 space-y-6 shadow-sm">
          {!customerDetail ? (
            <div className="py-24 text-center text-stone-400 font-sans font-bold text-xs space-y-2">
              <Users className="w-12 h-12 mx-auto text-stone-300 stroke-[1.5]" />
              <p>Pilih pelanggan di tabel sebelah kiri untuk memantau riwayat transaksi mereka.</p>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* Customer summary card */}
              <div className="space-y-4 border-b border-[hsl(var(--border))]/60 pb-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-display font-bold text-xl text-[hsl(var(--foreground))] leading-tight">
                      {customerDetail.name}
                    </h3>
                    <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mt-0.5">
                      Hubungi: {customerDetail.phone}
                    </p>
                  </div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                    VIP Member
                  </span>
                </div>

                {/* mini stats */}
                <div className="grid grid-cols-2 gap-3.5 pt-2">
                  <div className="bg-[hsl(var(--background))]/50 border border-[hsl(var(--border))]/40 p-3 rounded-2xl">
                    <p className="text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                      Total Belanja
                    </p>
                    <h4 className="text-sm font-display font-bold text-[hsl(var(--primary))] mt-0.5">
                      {formatIDR(customerDetail.total_spent)}
                    </h4>
                  </div>
                  <div className="bg-[hsl(var(--background))]/50 border border-[hsl(var(--border))]/40 p-3 rounded-2xl">
                    <p className="text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                      Kunjungan
                    </p>
                    <h4 className="text-sm font-display font-bold text-[hsl(var(--foreground))] mt-0.5">
                      {customerDetail.total_transactions} Transaksi
                    </h4>
                  </div>
                </div>
              </div>

              {/* Transaction history list */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-bold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[hsl(var(--primary))]" />
                  Riwayat Pembelian ({customerDetail.history.length})
                </h4>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {customerDetail.history.length === 0 ? (
                    <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] text-center py-4 bg-stone-50 border border-dashed border-[hsl(var(--border))] rounded-2xl">
                      Belum ada transaksi tercatat.
                    </p>
                  ) : (
                    customerDetail.history.map((tx) => (
                      <div key={tx.id} className="bg-[hsl(var(--background))]/30 border border-[hsl(var(--border))]/50 p-3.5 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center text-xs border-b border-[hsl(var(--border))]/30 pb-2">
                          <span className="font-extrabold text-[hsl(var(--foreground))] font-mono">
                            {formatTxId(tx.id)}
                          </span>
                          <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">
                            {new Date(tx.created_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Items */}
                        <div className="space-y-1">
                          {tx.items?.map((item: any, idx: number) => {
                            const pName = products.find(p => p.id === item.product_id)?.name || 'Menu'
                            return (
                              <div key={idx} className="flex justify-between text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                                <span>{pName} x{item.quantity}</span>
                                <span className="font-bold text-[hsl(var(--foreground))]">{formatIDR(item.subtotal)}</span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Total & Payment method */}
                        <div className="flex justify-between items-center pt-2 border-t border-[hsl(var(--border))]/30 text-xs">
                          <span className="inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-orange-100 text-orange-800">
                            {tx.payment_method}
                          </span>
                          <span className="font-extrabold text-[hsl(var(--primary))]">
                            {formatIDR(tx.total_amount)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: Registrasi Pelanggan Baru ────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[hsl(var(--border))] shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[hsl(var(--border))]">
              <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[hsl(var(--primary))]" />
                Registrasi Pelanggan Baru
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-4 text-xs font-bold text-[hsl(var(--muted-foreground))] font-sans uppercase tracking-wider">
              <div className="space-y-1.5">
                <label>Nama Pelanggan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Nakul / Aisyah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-normal"
                />
              </div>

              <div className="space-y-1.5">
                <label>Nomor Handphone (HP)</label>
                <input
                  type="tel"
                  required
                  placeholder="Contoh: 081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-sm py-3 rounded-xl shadow-lg transition cursor-pointer text-center"
              >
                Registrasi Member
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ── MODAL: Ubah Detail Pelanggan ────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[hsl(var(--border))] shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[hsl(var(--border))]">
              <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[hsl(var(--primary))]" />
                Ubah Detail Pelanggan
              </h3>
              <button 
                onClick={() => { setShowEditModal(false); setEditingCustomerId(null) }}
                className="p-1 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-bold text-[hsl(var(--muted-foreground))] font-sans uppercase tracking-wider">
              <div className="space-y-1.5">
                <label>Nama Pelanggan</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Nakul / Aisyah"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-normal"
                />
              </div>

              <div className="space-y-1.5">
                <label>Nomor Handphone (HP)</label>
                <input
                  type="tel"
                  required
                  placeholder="Contoh: 081234567890"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-sm py-3 rounded-xl shadow-lg transition cursor-pointer text-center"
              >
                Simpan Perubahan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Deletion Confirm Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Hapus Data Pelanggan?"
        message="Apakah Anda yakin ingin menghapus data pelanggan ini? Tindakan ini akan menghapusnya secara permanen dari daftar member dan mengosongkan relasi pelanggan di riwayat transaksi terkait."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setCustomerToDeleteId(null)
        }}
      />
    </div>
  )
}
