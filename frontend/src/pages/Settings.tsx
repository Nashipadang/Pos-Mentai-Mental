import { useState, useEffect } from 'react'
import { usePOSStore } from '../store/posStore'
import { useAuthStore } from '../store/authStore'
import Users from './Users'
import { 
  Store, 
  UserCog, 
  Save, 
  Settings as SettingsIcon,
  CheckCircle,
  FileText,
  Ticket,
  Plus,
  Trash2,
  Edit,
  X
} from 'lucide-react'
import ConfirmModal from '../components/ui/ConfirmModal'

const formatIDR = (val: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(val)
}

export default function Settings() {
  const { 
    settings, 
    fetchSettings, 
    updateSettings, 
    promos, 
    fetchPromos, 
    addPromo, 
    updatePromo, 
    deletePromo 
  } = usePOSStore()
  const { user } = useAuthStore()

  // State
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'promos'>('profile')
  const [storeName, setStoreName] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const [receiptHeader, setReceiptHeader] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Promo management form states
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState<any | null>(null)
  const [pCode, setPCode] = useState('')
  const [pType, setPType] = useState<'percentage' | 'flat'>('percentage')
  const [pValue, setPValue] = useState(0)
  const [pMinTx, setPMinTx] = useState(0)
  const [pMaxDiscount, setPMaxDiscount] = useState<number | ''>('')
  const [pIsActive, setPIsActive] = useState(true)
  const [promoError, setPromoError] = useState('')
  const [promoSaving, setPromoSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [promoToDelete, setPromoToDelete] = useState<any | null>(null)

  // Load settings on mount
  useEffect(() => {
    fetchSettings()
    fetchPromos()
  }, [fetchSettings, fetchPromos])

  // Bind settings values
  useEffect(() => {
    if (settings) {
      setStoreName(settings.store_name || 'Mentai Mental')
      setStoreAddress(settings.store_address || 'Jl. Margonda Raya No. 123, Depok')
      setReceiptHeader(settings.receipt_header || 'MENTAI MENTAL')
      const rawFooter = settings.receipt_footer || 'Terima kasih atas pesanan Anda!\nMentai Mental - Dimsum Mentai Juara'
      setReceiptFooter(rawFooter.replace(/\\n/g, '\n'))
    }
  }, [settings])

  const openAddPromoModal = () => {
    setEditingPromo(null)
    setPCode('')
    setPType('percentage')
    setPValue(0)
    setPMinTx(0)
    setPMaxDiscount('')
    setPIsActive(true)
    setPromoError('')
    setShowPromoModal(true)
  }

  const openEditPromoModal = (promo: any) => {
    setEditingPromo(promo)
    setPCode(promo.code)
    setPType(promo.type)
    setPValue(promo.value)
    setPMinTx(promo.min_transaction)
    setPMaxDiscount(promo.max_discount !== undefined && promo.max_discount !== null ? promo.max_discount : '')
    setPIsActive(promo.is_active)
    setPromoError('')
    setShowPromoModal(true)
  }

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pCode.trim()) {
      setPromoError('Kode voucher tidak boleh kosong')
      return
    }
    if (pValue <= 0) {
      setPromoError('Nilai potongan harus lebih besar dari 0')
      return
    }
    if (pMinTx < 0) {
      setPromoError('Minimal belanja tidak boleh negatif')
      return
    }
    if (pType === 'percentage' && pValue > 100) {
      setPromoError('Nilai persentase potongan tidak boleh melebihi 100%')
      return
    }
    if (pType === 'percentage' && pMaxDiscount !== '' && pMaxDiscount <= 0) {
      setPromoError('Maksimal potongan harus lebih besar dari 0')
      return
    }

    setPromoError('')
    setPromoSaving(true)

    const payload = {
      code: pCode.trim().toUpperCase(),
      type: pType,
      value: pValue,
      min_transaction: pMinTx,
      max_discount: pType === 'percentage' && pMaxDiscount !== '' ? Number(pMaxDiscount) : null,
      is_active: pIsActive
    }

    try {
      if (editingPromo) {
        await updatePromo(editingPromo.id, payload)
      } else {
        await addPromo(payload)
      }
      setShowPromoModal(false)
    } catch (err: any) {
      setPromoError(err.response?.data?.message || 'Gagal menyimpan voucher')
    } finally {
      setPromoSaving(false)
    }
  }

  const handleDeletePromoClick = (promo: any) => {
    setPromoToDelete(promo)
    setShowDeleteConfirm(true)
  }

  const executeDeletePromo = async () => {
    if (!promoToDelete) return
    try {
      await deletePromo(promoToDelete.id)
      setShowDeleteConfirm(false)
      setPromoToDelete(null)
    } catch (err) {
      console.error('Gagal menghapus voucher:', err)
    }
  }

  const handleTogglePromoStatus = async (promo: any) => {
    try {
      await updatePromo(promo.id, { is_active: !promo.is_active })
    } catch (err) {
      console.error('Gagal mengubah status voucher:', err)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveSuccess(false)
    try {
      await updateSettings({
        store_name: storeName,
        store_address: storeAddress,
        receipt_header: receiptHeader,
        receipt_footer: receiptFooter
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Gagal memperbarui pengaturan:', err)
    } finally {
      setSaving(false)
    }
  }

  // Double check access (only Owner can view Settings)
  if (user?.role !== 'owner') {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-3">
        <SettingsIcon className="w-16 h-16 text-stone-300 stroke-[1.5]" />
        <h3 className="text-lg font-display font-bold text-stone-800">Akses Ditolak</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-sm">
          Halaman pengaturan sistem hanya dapat diakses oleh peran Owner toko.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-display font-bold text-[hsl(var(--foreground))] tracking-tight">
          Pengaturan Sistem
        </h2>
        <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] font-sans">
          Pusat kendali operasional kedai, profil cetak struk, dan hak akses pengguna
        </p>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-[hsl(var(--border))]/60 gap-1.5 pb-px">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-display text-sm font-bold transition-all transition-all duration-200 cursor-pointer ${
            activeTab === 'profile'
              ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
              : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          }`}
        >
          <Store className="w-4 h-4" />
          Profil & Struk Kedai
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-display text-sm font-bold transition-all transition-all duration-200 cursor-pointer ${
            activeTab === 'users'
              ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
              : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          }`}
        >
          <UserCog className="w-4 h-4" />
          Manajemen Pengguna
        </button>
        <button
          onClick={() => setActiveTab('promos')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-display text-sm font-bold transition-all transition-all duration-200 cursor-pointer ${
            activeTab === 'promos'
              ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
              : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          }`}
        >
          <Ticket className="w-4 h-4" />
          Voucher & Promo
        </button>
      </div>

      {/* Content Area */}
      <div className="animate-fade-in">
        {activeTab === 'profile' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Form Card (takes 2 cols on lg) */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-[hsl(var(--border))] shadow-sm overflow-hidden p-6 space-y-6">
              <div>
                <h3 className="font-display font-bold text-base text-[hsl(var(--foreground))]">
                  Informasi Profil Toko
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
                  Detail ini akan dicantumkan secara otomatis pada bagian atas dan bawah struk transaksi POS
                </p>
              </div>

              <form onSubmit={handleSave} className="space-y-5 text-xs font-bold text-[hsl(var(--muted-foreground))] font-sans uppercase tracking-wider">
                <div className="space-y-1.5">
                  <label htmlFor="store-name">Nama Toko / Kedai</label>
                  <input
                    id="store-name"
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="store-address">Alamat Toko</label>
                  <input
                    id="store-address"
                    type="text"
                    required
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="receipt-header">Header Struk Belanja</label>
                    <input
                      id="receipt-header"
                      type="text"
                      required
                      value={receiptHeader}
                      onChange={(e) => setReceiptHeader(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="receipt-footer">Footer Struk Belanja</label>
                    <textarea
                      id="receipt-footer"
                      required
                      rows={3}
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-2">
                    {saveSuccess && (
                      <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold normal-case">
                        <CheckCircle className="w-4 h-4" /> Pengaturan berhasil disimpan ke sistem!
                      </span>
                    )}
                  </div>
                  
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-3 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-xs rounded-2xl transition shadow-lg shadow-[hsl(var(--primary))/15] cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                  </button>
                </div>
              </form>
            </div>

            {/* Receipt Preview Card */}
            <div className="bg-stone-50 border border-stone-200 rounded-3xl p-6 space-y-4">
              <div>
                <h3 className="font-display font-bold text-base text-stone-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-stone-500" />
                  Pratinjau Struk Thermal
                </h3>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] font-semibold">
                  Ilustrasi tampilan struk 58mm POS Mentai Mental
                </p>
              </div>

              <div className="bg-white border border-stone-200 rounded-2xl shadow-inner p-4 font-mono text-[10px] text-stone-700 space-y-3 leading-relaxed max-w-[280px] mx-auto select-none">
                <div className="text-center space-y-1">
                  <h4 className="font-extrabold text-xs tracking-wider uppercase text-stone-900">
                    {receiptHeader}
                  </h4>
                  <p className="text-[9px] text-stone-500 normal-case">
                    {storeAddress}
                  </p>
                </div>

                <div className="border-t border-dashed border-stone-300 my-2" />

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span>1x Dimsum Mentai</span>
                    <span>Rp 25.000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1x Es Teh Manis</span>
                    <span>Rp 5.000</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-stone-300 my-2" />

                <div className="space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>TOTAL</span>
                    <span>Rp 30.000</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>Tunai</span>
                    <span>Rp 50.000</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>Kembalian</span>
                    <span>Rp 20.000</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-stone-300 my-2" />

                <div className="text-center text-[9px] text-stone-500 whitespace-pre-line leading-normal">
                  {receiptFooter}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'users' ? (
          <div className="bg-white rounded-3xl border border-[hsl(var(--border))] shadow-sm overflow-hidden p-6">
            <Users />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Promo Management Panel */}
            <div className="bg-white rounded-3xl border border-[hsl(var(--border))] shadow-sm overflow-hidden p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display font-bold text-base text-[hsl(var(--foreground))]">
                    Daftar Voucher & Kode Promo
                  </h3>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
                    Atur potongan harga, diskon persentase, dan minimum belanja untuk transaksi POS kasir
                  </p>
                </div>
                <button
                  onClick={openAddPromoModal}
                  className="flex items-center gap-1.5 px-4.5 py-2.5 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-xs rounded-2xl transition shadow-lg shadow-[hsl(var(--primary))/15] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Voucher
                </button>
              </div>

              {promos.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-[hsl(var(--border))] rounded-2xl">
                  <Ticket className="w-10 h-10 mx-auto text-stone-300 stroke-[1.5] mb-2" />
                  <p className="font-sans font-bold text-[hsl(var(--muted-foreground))] text-sm">
                    Belum ada voucher yang terdaftar
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    Silakan klik tombol "Tambah Voucher" untuk membuat voucher baru.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))]/60 text-[10px] font-extrabold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        <th className="py-3 px-4">Kode Voucher</th>
                        <th className="py-3 px-4">Jenis</th>
                        <th className="py-3 px-4">Nilai Potongan</th>
                        <th className="py-3 px-4">Min. Belanja</th>
                        <th className="py-3 px-4">Maks. Potongan</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]/40 font-sans text-xs">
                      {promos.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50/50 transition">
                          <td className="py-3 px-4">
                            <span className="inline-block font-extrabold text-[11px] uppercase px-2 py-0.5 rounded bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/20">
                              {p.code}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-stone-600">
                            {p.type === 'percentage' ? 'Persentase (%)' : 'Uang Tunai (Flat)'}
                          </td>
                          <td className="py-3 px-4 font-extrabold text-stone-800">
                            {p.type === 'percentage' ? `${p.value}%` : formatIDR(p.value)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-stone-700">
                            {formatIDR(p.min_transaction)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-stone-700">
                            {p.type === 'percentage' && p.max_discount ? formatIDR(p.max_discount) : '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleTogglePromoStatus(p)}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                p.is_active ? 'bg-emerald-500' : 'bg-stone-200'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                  p.is_active ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => openEditPromoModal(p)}
                              className="p-1.5 hover:bg-stone-100 text-blue-600 rounded-lg transition cursor-pointer inline-flex"
                              title="Edit Voucher"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePromoClick(p)}
                              className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition cursor-pointer inline-flex"
                              title="Hapus Voucher"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── PROMO FORM MODAL ── */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[hsl(var(--border))] shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-[hsl(var(--border))]">
              <h3 className="font-display font-bold text-base text-[hsl(var(--foreground))]">
                {editingPromo ? 'Edit Voucher / Promo' : 'Tambah Voucher Baru'}
              </h3>
              <button 
                onClick={() => setShowPromoModal(false)} 
                className="p-1 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePromo} className="space-y-4 text-xs font-bold text-[hsl(var(--muted-foreground))] font-sans uppercase tracking-wider font-semibold">
              <div className="space-y-1.5">
                <label htmlFor="promo-code">Kode Voucher</label>
                <input
                  id="promo-code"
                  type="text"
                  required
                  placeholder="Contoh: MENTAIPAS"
                  value={pCode}
                  onChange={(e) => setPCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl bg-white text-[hsl(var(--foreground))] text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label>Tipe Potongan</label>
                <div className="grid grid-cols-2 gap-3 normal-case font-bold">
                  <div 
                    onClick={() => setPType('percentage')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition select-none ${
                      pType === 'percentage'
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))]'
                        : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    <span className="font-bold text-sm">% Persentase</span>
                    <span className="text-[10px] opacity-70">Potongan persen dari total</span>
                  </div>
                  <div 
                    onClick={() => setPType('flat')}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition select-none ${
                      pType === 'flat'
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 text-[hsl(var(--primary))]'
                        : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    <span className="font-bold text-sm">Rp Tunai (Flat)</span>
                    <span className="text-[10px] opacity-70">Potongan nominal langsung</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="promo-value">Nilai Potongan</label>
                  <div className="relative">
                    {pType === 'flat' && (
                      <span className="absolute left-3.5 top-3 text-stone-400 font-sans font-bold normal-case text-xs">
                        Rp
                      </span>
                    )}
                    <input
                      id="promo-value"
                      type="number"
                      required
                      min={1}
                      value={pValue || ''}
                      onChange={(e) => setPValue(Number(e.target.value))}
                      className={`w-full py-2.5 border border-stone-200 rounded-xl bg-white text-[hsl(var(--foreground))] text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] ${
                        pType === 'flat' ? 'pl-9 pr-3.5' : 'pl-3.5 pr-8'
                      }`}
                    />
                    {pType === 'percentage' && (
                      <span className="absolute right-3.5 top-3 text-stone-400 font-sans font-bold normal-case text-xs">
                        %
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="promo-mintx">Min. Belanja</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-stone-400 font-sans font-bold normal-case text-xs">
                      Rp
                    </span>
                    <input
                      id="promo-mintx"
                      type="number"
                      required
                      min={0}
                      value={pMinTx || ''}
                      onChange={(e) => setPMinTx(e.target.value === '' ? 0 : Number(e.target.value))}
                      className="w-full pl-9 pr-3.5 py-2.5 border border-stone-200 rounded-xl bg-white text-[hsl(var(--foreground))] text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                  </div>
                </div>
              </div>

              {pType === 'percentage' && (
                <div className="space-y-1.5 animate-fade-in">
                  <label htmlFor="promo-maxdiscount">Maks. Potongan (Rp - Opsional)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-stone-400 font-sans font-bold normal-case text-xs">
                      Rp
                    </span>
                    <input
                      id="promo-maxdiscount"
                      type="number"
                      min={0}
                      placeholder="Tanpa batas"
                      value={pMaxDiscount || ''}
                      onChange={(e) => setPMaxDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full pl-9 pr-3.5 py-2.5 border border-stone-200 rounded-xl bg-white text-[hsl(var(--foreground))] text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1.5 normal-case">
                <input
                  id="promo-isactive"
                  type="checkbox"
                  checked={pIsActive}
                  onChange={(e) => setPIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))] border-stone-300"
                />
                <label htmlFor="promo-isactive" className="text-xs font-semibold text-stone-700 cursor-pointer">
                  Aktifkan voucher ini segera
                </label>
              </div>

              {promoError && (
                <p className="text-red-500 text-[10px] font-bold normal-case">
                  {promoError}
                </p>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPromoModal(false)}
                  className="flex-1 py-2.5 border border-stone-200 hover:bg-stone-50 text-xs font-bold rounded-xl transition cursor-pointer text-[hsl(var(--foreground))]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={promoSaving}
                  className="flex-1 py-2.5 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer text-center disabled:opacity-50"
                >
                  {promoSaving ? 'Menyimpan...' : 'Simpan Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Hapus Voucher?"
        message={`Apakah Anda yakin ingin menghapus voucher ${promoToDelete?.code}? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        type="danger"
        onConfirm={executeDeletePromo}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
