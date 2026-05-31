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
  FileText
} from 'lucide-react'

export default function Settings() {
  const { settings, fetchSettings, updateSettings } = usePOSStore()
  const { user } = useAuthStore()

  // State
  const [activeTab, setActiveTab] = useState<'profile' | 'users'>('profile')
  const [storeName, setStoreName] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const [receiptHeader, setReceiptHeader] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load settings on mount
  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

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
        ) : (
          <div className="bg-white rounded-3xl border border-[hsl(var(--border))] shadow-sm overflow-hidden p-6">
            <Users />
          </div>
        )}
      </div>
    </div>
  )
}
