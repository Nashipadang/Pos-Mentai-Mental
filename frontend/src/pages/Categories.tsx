import { useState } from 'react'
import { usePOSStore } from '../store/posStore'
import ConfirmModal from '../components/ui/ConfirmModal'
import { 
  Tags, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  FolderPlus, 
  AlertTriangle,
  HelpCircle
} from 'lucide-react'

export default function Categories() {
  const { categories, products, addCategory, updateCategory, deleteCategory } = usePOSStore()

  // State
  const [editingCategory, setEditingCategory] = useState<{ id: number; name: string } | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [editCatName, setEditCatName] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [categoryToDeleteId, setCategoryToDeleteId] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Handlers
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    const name = newCatName.trim()
    if (!name) return

    // Check duplicate name
    const exists = categories.some(c => c.name.toLowerCase() === name.toLowerCase())
    if (exists) {
      setErrorMsg('Nama kategori sudah digunakan.')
      return
    }

    try {
      await addCategory(name)
      setNewCatName('')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Gagal menyimpan kategori baru')
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!editingCategory) return
    const name = editCatName.trim()
    if (!name) return

    // Check duplicate name (excluding itself)
    const exists = categories.some(
      c => c.id !== editingCategory.id && c.name.toLowerCase() === name.toLowerCase()
    )
    if (exists) {
      setErrorMsg('Nama kategori sudah digunakan.')
      return
    }

    try {
      await updateCategory(editingCategory.id, name)
      setEditingCategory(null)
      setEditCatName('')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Gagal mengubah nama kategori')
    }
  }

  const openDeleteConfirm = (id: number) => {
    setCategoryToDeleteId(id)
    setConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (categoryToDeleteId === null) return
    try {
      await deleteCategory(categoryToDeleteId)
    } catch (err) {
      console.error('Gagal menghapus kategori:', err)
    }
    setConfirmOpen(false)
    setCategoryToDeleteId(null)
  }

  // Count products assigned to a category
  const getProductCount = (catId: number) => {
    return products.filter(p => p.category_id === catId).length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-[hsl(var(--foreground))] tracking-tight">
            Kategori Menu
          </h2>
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] font-sans">
            Kelola pengelompokan menu masakan Mentai Mental Anda
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-bold p-3.5 rounded-2xl uppercase tracking-wide">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Form: Add/Edit Category */}
        <div className="bg-white rounded-3xl border border-[hsl(var(--border))] p-6 shadow-sm space-y-6">
          {!editingCategory ? (
            <div className="space-y-4">
              <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-[hsl(var(--primary))]" />
                Tambah Kategori Baru
              </h3>
              
              <form onSubmit={handleAddSubmit} className="space-y-4 text-xs font-bold text-[hsl(var(--muted-foreground))] font-sans uppercase tracking-wider">
                <div className="space-y-1.5">
                  <label>Nama Kategori</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Dimsum Mentai, Minuman"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-normal"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-sm py-3 rounded-xl shadow-lg transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Simpan Kategori
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-[hsl(var(--border))]/50">
                <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-[hsl(var(--primary))]" />
                  Ubah Kategori
                </h3>
                <button
                  onClick={() => setEditingCategory(null)}
                  className="p-1 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-bold text-[hsl(var(--muted-foreground))] font-sans uppercase tracking-wider">
                <div className="space-y-1.5">
                  <label>Nama Kategori</label>
                  <input
                    type="text"
                    required
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-normal"
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
          )}

          {/* Database warning box */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Info Penghapusan
            </h4>
            <p className="text-[11px] font-semibold text-amber-700 font-sans leading-relaxed">
              Jika sebuah kategori dihapus, produk yang terikat di dalamnya tidak akan terhapus. Kategori produk tersebut otomatis akan diatur menjadi kosong (terarsip secara internal).
            </p>
          </div>
        </div>

        {/* Right Pane: Categories List */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-[hsl(var(--border))] overflow-hidden shadow-sm space-y-4">
          <div className="p-6 border-b border-[hsl(var(--border))]/60 flex items-center gap-2">
            <Tags className="w-5 h-5 text-[hsl(var(--primary))]" />
            <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))]">
              Daftar Kategori Menu ({categories.length})
            </h3>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((c) => {
              const productCount = getProductCount(c.id)
              
              return (
                <div 
                  key={c.id} 
                  className="bg-[hsl(var(--background))]/30 border border-[hsl(var(--border))]/70 p-4 rounded-2xl flex flex-col justify-between hover-card-lift transition duration-200"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-display font-bold text-md text-[hsl(var(--foreground))] truncate">
                        {c.name}
                      </h4>
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border border-[hsl(var(--primary))]/10 shrink-0">
                        ID: {c.id}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                      Digunakan pada: <span className="font-bold text-[hsl(var(--foreground))]">{productCount} Menu</span>
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[hsl(var(--border))]/40 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingCategory({ id: c.id, name: c.name })
                        setEditCatName(c.name)
                        setErrorMsg('')
                      }}
                      className="p-1.5 border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] rounded-xl transition cursor-pointer"
                      title="Ubah nama kategori"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => openDeleteConfirm(c.id)}
                      className="p-1.5 border border-red-100 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition cursor-pointer"
                      title="Hapus kategori"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}

            {categories.length === 0 && (
              <div className="col-span-full py-16 text-center text-stone-400 font-sans font-bold text-xs space-y-2">
                <Tags className="w-12 h-12 mx-auto text-stone-300 stroke-[1.5]" />
                <p>Belum ada kategori terdaftar. Silakan tambah kategori di panel sebelah kiri.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Delete Category Modal */}
      <ConfirmModal
        isOpen={confirmOpen}
        title="Hapus Kategori Menu?"
        message="Apakah Anda yakin ingin menghapus kategori ini? Menu yang terkait di dalamnya akan dipindahkan ke kategori kosong (Terhapus). Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus Kategori"
        cancelText="Batal"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setConfirmOpen(false)
          setCategoryToDeleteId(null)
        }}
      />
    </div>
  )
}
