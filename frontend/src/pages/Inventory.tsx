import { useState, useEffect, useCallback } from 'react'
import { usePOSStore } from '../store/posStore'
import { useAuthStore } from '../store/authStore'
import CustomSelect from '../components/ui/CustomSelect'
import ConfirmModal from '../components/ui/ConfirmModal'
import api from '../lib/api'
import { 
  Package, 
  Plus, 
  RefreshCw, 
  AlertTriangle, 
  TrendingDown, 
  CheckCircle,
  Calendar,
  X,
  Edit2,
  Trash2
} from 'lucide-react'

export default function Inventory() {
  const { ingredients, addIngredient, restockIngredient, updateIngredient, deleteIngredient } = usePOSStore()
  const { user } = useAuthStore()

  // State
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRestockModal, setShowRestockModal] = useState(false)
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [restockQty, setRestockQty] = useState('')
  const [restockNotes, setRestockNotes] = useState('')
  
  // New Ingredient state
  const [newName, setNewName] = useState('')
  const [newUnit, setNewUnit] = useState('g')
  const [newStock, setNewStock] = useState('')
  const [newMinThreshold, setNewMinThreshold] = useState('')

  // Edit/Delete Ingredient state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUnit, setEditUnit] = useState('g')
  const [editStock, setEditStock] = useState('')
  const [editMinThreshold, setEditMinThreshold] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [ingredientToDeleteId, setIngredientToDeleteId] = useState<string | null>(null)

  // ── Backend Stock Depletion Predictions (FR-022) ────────────────
  const [predictions, setPredictions] = useState<{[key: string]: any}>({})
  
  const fetchPredictions = useCallback(async () => {
    try {
      const resp = await api.get('/analytics/runout-predictions')
      const dict: {[key: string]: any} = {}
      if (resp.data && Array.isArray(resp.data.data)) {
        resp.data.data.forEach((p: any) => {
          dict[p.ingredient_id] = p
        })
      }
      setPredictions(dict)
    } catch (err) {
      console.error('Gagal mengambil data prediksi sisa stok:', err)
    }
  }, [])

  useEffect(() => {
    fetchPredictions()
  }, [ingredients, fetchPredictions])

  // Handlers
  const handleAddIngredient = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newStock) return

    addIngredient({
      name: newName,
      unit: newUnit,
      current_stock: parseFloat(newStock),
      min_threshold: newMinThreshold ? parseFloat(newMinThreshold) : undefined
    })

    // Reset Form
    setNewName('')
    setNewUnit('g')
    setNewStock('')
    setNewMinThreshold('')
    setShowAddModal(false)
  }

  const handleRestock = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedIngredientId || !restockQty) return

    restockIngredient(
      selectedIngredientId, 
      parseFloat(restockQty), 
      restockNotes || 'Restock bahan baku harian'
    )

    // Reset Form
    setSelectedIngredientId('')
    setRestockQty('')
    setRestockNotes('')
    setShowRestockModal(false)
  }

  const openEditModal = (ing: any) => {
    setEditingIngredientId(ing.id)
    setEditName(ing.name)
    setEditUnit(ing.unit)
    setEditStock(String(ing.current_stock))
    setEditMinThreshold(ing.min_threshold ? String(ing.min_threshold) : '')
    setShowEditModal(true)
  }

  const openDeleteConfirm = (id: string) => {
    setIngredientToDeleteId(id)
    setDeleteConfirmOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingIngredientId || !editName || !editStock) return

    try {
      await updateIngredient(editingIngredientId, {
        name: editName,
        unit: editUnit,
        current_stock: parseFloat(editStock),
        min_threshold: editMinThreshold ? parseFloat(editMinThreshold) : undefined
      })
      setShowEditModal(false)
      setEditingIngredientId(null)
    } catch (err) {
      console.error("Gagal mengupdate bahan baku:", err)
    }
  }

  const handleConfirmDelete = async () => {
    if (!ingredientToDeleteId) return
    try {
      await deleteIngredient(ingredientToDeleteId)
    } catch (err) {
      console.error("Gagal menghapus bahan baku:", err)
    }
    setDeleteConfirmOpen(false)
    setIngredientToDeleteId(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-[hsl(var(--foreground))] tracking-tight">
            Manajemen Inventori
          </h2>
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] font-sans">
            Kelola pasokan bahan baku & prediksi stok habis Mentai Mental
          </p>
        </div>

        {/* Action buttons (only staff or owner can restock/add) */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowRestockModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] font-sans font-bold text-xs rounded-2xl transition shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[hsl(var(--primary))]" />
            Catat Restock
          </button>
          
          {user?.role === 'owner' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-xs rounded-2xl transition shadow-lg shadow-[hsl(var(--primary))/15] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Bahan Baku Baru
            </button>
          )}
        </div>
      </div>

      {/* Ingredients Stock Table Card */}
      <div className="bg-white rounded-3xl border border-[hsl(var(--border))] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-[hsl(var(--border))]/60">
          <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
            <Package className="w-5 h-5 text-[hsl(var(--primary))]" />
            Daftar Stok Bahan Baku Aktif
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-[hsl(var(--background))]/50 border-b border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] uppercase font-extrabold tracking-wider">
                <th className="px-6 py-4">Bahan Baku</th>
                <th className="px-6 py-4">Stok Saat Ini</th>
                <th className="px-6 py-4">Batas Minimum</th>
                <th className="px-6 py-4">Rata-rata Harian (7 Hari)</th>
                <th className="px-6 py-4">Prediksi Habis</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]/50">
              {ingredients.map((ing) => {
                const pred = predictions[ing.id]
                const isLow = ing.current_stock <= (ing.min_threshold ?? 0)
                const isCritical = ing.current_stock === 0
                
                let daysRemainingText = 'Aman (Stok Pasif)'
                if (pred) {
                  if (pred.days_remaining >= 0) {
                    const days = Math.round(pred.days_remaining)
                    daysRemainingText = days <= 0 ? 'Habis hari ini' : `${days} hari lagi`
                  } else if (ing.current_stock === 0) {
                    daysRemainingText = 'Habis'
                  }
                } else if (ing.current_stock === 0) {
                  daysRemainingText = 'Habis'
                }
                
                return (
                  <tr key={ing.id} className="hover:bg-[hsl(var(--background))]/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-[hsl(var(--foreground))] text-sm">
                      {ing.name}
                    </td>
                    <td className="px-6 py-4 font-extrabold text-sm text-[hsl(var(--foreground))]">
                      {ing.current_stock} <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-semibold">{ing.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-[hsl(var(--muted-foreground))] font-semibold">
                      {ing.min_threshold ? `${ing.min_threshold} ${ing.unit}` : '-'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-[hsl(var(--muted-foreground))]">
                      {pred ? `${pred.avg_daily_usage.toFixed(1)} ${ing.unit} / hari` : '0'}
                    </td>
                    <td className="px-6 py-4 font-bold text-[hsl(var(--foreground))] flex items-center gap-1.5 pt-4.5">
                      <TrendingDown className={`w-3.5 h-3.5 ${isLow ? 'text-red-500' : 'text-stone-400'}`} />
                      <span className={isLow ? 'text-red-600 font-extrabold' : ''}>
                        {daysRemainingText}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        isCritical 
                          ? 'bg-red-100 text-red-800 border border-red-200' 
                          : isLow 
                          ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse' 
                          : 'bg-green-50 text-green-700 border border-green-100'
                      }`}>
                        {isCritical ? (
                          <>
                            <AlertTriangle className="w-3 h-3" />
                            Habis Total
                          </>
                        ) : isLow ? (
                          <>
                            <AlertTriangle className="w-3 h-3" />
                            Kritis
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Aman
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(ing)}
                          className="p-2 border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] text-[hsl(var(--muted-foreground))] rounded-xl transition cursor-pointer"
                          title="Ubah detail bahan baku"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        
                        {user?.role === 'owner' && (
                          <button
                            onClick={() => openDeleteConfirm(ing.id)}
                            className="p-2 border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition cursor-pointer"
                            title="Hapus bahan baku"
                          >
                            <Trash2 className="w-4 h-4" />
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
      </div>

      {/* ── MODAL 1: Catat Restock ─────────────────────────────────── */}
      {showRestockModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[hsl(var(--border))] shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[hsl(var(--border))]">
              <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[hsl(var(--primary))]" />
                Catat Pengisian Stok (Restock)
              </h3>
              <button 
                onClick={() => setShowRestockModal(false)}
                className="p-1 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestock} className="space-y-4 text-xs font-bold text-[hsl(var(--muted-foreground))] font-sans uppercase tracking-wider">
              <div className="space-y-1.5">
                <label>Pilih Bahan Baku</label>
                <CustomSelect
                  value={selectedIngredientId}
                  onChange={setSelectedIngredientId}
                  placeholder="Pilih Bahan Baku"
                  options={ingredients.map(ing => ({ value: ing.id, label: `${ing.name} (Stok: ${ing.current_stock} ${ing.unit})` }))}
                />
              </div>

              <div className="space-y-1.5">
                <label>Jumlah Tambah</label>
                <div className="flex items-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]/30 overflow-hidden focus-within:ring-2 focus-within:ring-[hsl(var(--primary))] transition-all">
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="Contoh: 1000"
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                    className="flex-grow px-3.5 py-2.5 bg-transparent text-[hsl(var(--foreground))] text-sm focus:outline-none"
                  />
                  {selectedIngredientId && (
                    <span className="px-4 py-2.5 bg-[hsl(var(--background))]/80 border-l border-[hsl(var(--border))] text-xs font-extrabold text-[hsl(var(--primary))] shrink-0 uppercase">
                      {ingredients.find(i => i.id === selectedIngredientId)?.unit}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label>Catatan Restock (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Beli dari pasar / Supplier utama"
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] uppercase-none font-normal"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-sm py-3 rounded-xl shadow-lg transition cursor-pointer text-center"
              >
                Konfirmasi Restock Bahan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Tambah Bahan Baku ────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[hsl(var(--border))] shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[hsl(var(--border))]">
              <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[hsl(var(--primary))]" />
                Tambah Bahan Baku Baru
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddIngredient} className="space-y-4 text-xs font-bold text-[hsl(var(--muted-foreground))] font-sans uppercase tracking-wider">
              <div className="space-y-1.5">
                <label>Nama Bahan Baku</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Daging Ayam Fillet"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-normal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label>Satuan Ukur</label>
                  <CustomSelect
                    value={newUnit}
                    onChange={setNewUnit}
                    options={[
                      { value: 'g', label: 'gram (g)' },
                      { value: 'ml', label: 'mililiter (ml)' },
                      { value: 'pcs', label: 'pieces (pcs)' },
                      { value: 'box', label: 'box' }
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label>Stok Awal</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Contoh: 100"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label>Batas Minimum (Threshold)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Contoh: 20 (Sistem akan alert jika stok <= nilai ini)"
                  value={newMinThreshold}
                  onChange={(e) => setNewMinThreshold(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-sm py-3 rounded-xl shadow-lg transition cursor-pointer text-center"
              >
                Simpan Bahan Baku
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ── MODAL 3: Edit Bahan Baku ────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[hsl(var(--border))] shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[hsl(var(--border))]">
              <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[hsl(var(--primary))]" />
                Ubah Bahan Baku
              </h3>
              <button 
                onClick={() => { setShowEditModal(false); setEditingIngredientId(null) }}
                className="p-1 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-bold text-[hsl(var(--muted-foreground))] font-sans uppercase tracking-wider">
              <div className="space-y-1.5">
                <label>Nama Bahan Baku</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Daging Ayam Fillet"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-normal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label>Satuan Ukur</label>
                  <CustomSelect
                    value={editUnit}
                    onChange={setEditUnit}
                    options={[
                      { value: 'g', label: 'gram (g)' },
                      { value: 'ml', label: 'mililiter (ml)' },
                      { value: 'pcs', label: 'pieces (pcs)' },
                      { value: 'box', label: 'box' }
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label>Stok Saat Ini</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.001"
                    placeholder="Contoh: 100"
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label>Batas Minimum (Threshold)</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="Contoh: 20 (Sistem akan alert jika stok <= nilai ini)"
                  value={editMinThreshold}
                  onChange={(e) => setEditMinThreshold(e.target.value)}
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
        title="Hapus Bahan Baku?"
        message="Apakah Anda yakin ingin menghapus bahan baku ini? Tindakan ini akan menghapusnya secara permanen dari sistem dan mempengaruhi menu resep (BOM) yang menggunakannya."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setIngredientToDeleteId(null)
        }}
      />
    </div>
  )
}
