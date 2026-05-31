import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePOSStore } from '../store/posStore'
import CustomSelect from '../components/ui/CustomSelect'
import ConfirmModal from '../components/ui/ConfirmModal'
import { 
  UtensilsCrossed, 
  Plus, 
  Edit2, 
  Trash2, 
  Settings, 
  X, 
  ChevronRight,
  PlusCircle,
  FolderPlus,
  MoreVertical,
  Eye,
  EyeOff
} from 'lucide-react'

interface RecipeInputItem {
  ingredient_id: string
  quantity: number
}

export default function Products() {
  const navigate = useNavigate()
  const { 
    products, 
    categories, 
    ingredients, 
    recipes, 
    addProduct, 
    updateProduct, 
    deleteProduct,
    saveRecipe,
    addCategory
  } = usePOSStore()

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false)
  const [showRecipeModal, setShowRecipeModal] = useState(false)
  
  // Confirm Modal state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [productToDeleteId, setProductToDeleteId] = useState<string | null>(null)
  
  // Active editing ids
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [openMenuProductId, setOpenMenuProductId] = useState<string | null>(null)
  
  // Product Form states
  const [prodName, setProdName] = useState('')
  const [prodPrice, setProdPrice] = useState('')
  const [prodCategoryId, setProdCategoryId] = useState('1')
  
  
  // Recipe Editor states
  const [recipeItems, setRecipeItems] = useState<RecipeInputItem[]>([])
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [ingredientQty, setIngredientQty] = useState('')

  // ── Handlers: Product CRUD ─────────────────────────────────────────
  const openAddProductModal = () => {
    setEditingProductId(null)
    setProdName('')
    setProdPrice('')
    setProdCategoryId(categories.length > 0 ? categories[0].id.toString() : '1')
    setShowProductModal(true)
  }

  const openEditProductModal = (prod: any) => {
    setEditingProductId(prod.id)
    setProdName(prod.name)
    setProdPrice(prod.price.toString())
    setProdCategoryId(prod.category_id.toString())
    setShowProductModal(true)
  }

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prodName || !prodPrice) return

    const priceNum = parseFloat(prodPrice)
    const catId = parseInt(prodCategoryId)

    if (editingProductId) {
      updateProduct(editingProductId, {
        name: prodName,
        price: priceNum,
        category_id: catId
      })
    } else {
      addProduct({
        name: prodName,
        price: priceNum,
        category_id: catId,
        is_active: true
      })
    }
    setShowProductModal(false)
  }

  const handleToggleActive = (id: string, current: boolean) => {
    updateProduct(id, { is_active: !current })
  }

  const handleDeleteProduct = (id: string) => {
    setProductToDeleteId(id)
    setConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (productToDeleteId) {
      deleteProduct(productToDeleteId)
    }
    setConfirmOpen(false)
    setProductToDeleteId(null)
  }

  const handleCancelDelete = () => {
    setConfirmOpen(false)
    setProductToDeleteId(null)
  }

  // ── Handlers: Recipe BOM Editor ────────────────────────────────────
  const openRecipeModal = (productId: string) => {
    setEditingProductId(productId)
    
    // Load current recipe from store
    const existing = recipes
      .filter(r => r.product_id === productId)
      .map(r => ({
        ingredient_id: r.ingredient_id,
        quantity: r.quantity
      }))
    
    setRecipeItems(existing)
    setSelectedIngredientId('')
    setIngredientQty('')
    setShowRecipeModal(true)
  }

  const handleAddRecipeItem = () => {
    if (!selectedIngredientId || !ingredientQty) return
    const qty = parseFloat(ingredientQty)
    if (qty <= 0) return

    // If ingredient already in list, sum quantity
    setRecipeItems(prev => {
      const existingIdx = prev.findIndex(item => item.ingredient_id === selectedIngredientId)
      if (existingIdx > -1) {
        return prev.map((item, idx) => 
          idx === existingIdx 
            ? { ...item, quantity: item.quantity + qty } 
            : item
        )
      }
      return [...prev, { ingredient_id: selectedIngredientId, quantity: qty }]
    })

    // Reset selectors
    setSelectedIngredientId('')
    setIngredientQty('')
  }

  const handleRemoveRecipeItem = (ingredientId: string) => {
    setRecipeItems(prev => prev.filter(item => item.ingredient_id !== ingredientId))
  }

  const handleSaveRecipe = () => {
    if (!editingProductId) return
    saveRecipe(editingProductId, recipeItems)
    setShowRecipeModal(false)
    setEditingProductId(null)
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
            Menu & Resep (BOM)
          </h2>
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] font-sans">
            Atur menu jualan Mentai Mental dan tentukan komposisi bahan baku (BOM)
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate('/categories')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] font-sans font-bold text-xs rounded-2xl transition shadow-sm cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-[hsl(var(--primary))]" />
            Kelola Kategori
          </button>
          
          <button
            onClick={openAddProductModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-xs rounded-2xl transition shadow-lg shadow-[hsl(var(--primary))/15] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Menu Baru
          </button>
        </div>
      </div>

      {/* Product List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {products.map((prod) => {
          // Get recipe items count
          const recipeCount = recipes.filter(r => r.product_id === prod.id).length
          
          return (
            <div key={prod.id} className="bg-white rounded-3xl border border-[hsl(var(--border))] p-6 space-y-5 flex flex-col justify-between hover-card-lift">
              <div className="space-y-3.5">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-block text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border border-[hsl(var(--primary))]/10">
                      {categories.find(c => c.id === prod.category_id)?.name || 'Kategori Terhapus'}
                    </span>
                    
                    {/* Status Indicator Badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      prod.is_active 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                        : 'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${prod.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                      {prod.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  {/* Dropdown Options */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuProductId(openMenuProductId === prod.id ? null : prod.id)
                      }}
                      className="p-1 rounded-xl hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
                      title="Pilihan menu"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {openMenuProductId === prod.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuProductId(null)
                          }} 
                        />
                        <div className="absolute right-0 mt-1 w-44 bg-white border border-[hsl(var(--border))] rounded-2xl shadow-xl py-1.5 z-50 animate-fade-in origin-top-right">
                          <button
                            onClick={() => {
                              openEditProductModal(prod)
                              setOpenMenuProductId(null)
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] flex items-center gap-2 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
                            Ubah Detail
                          </button>

                          <button
                            onClick={() => {
                              handleToggleActive(prod.id, prod.is_active)
                              setOpenMenuProductId(null)
                            }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2 transition ${
                              prod.is_active 
                                ? 'text-amber-600 hover:bg-amber-50' 
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {prod.is_active ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                Nonaktifkan
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                Aktifkan
                              </>
                            )}
                          </button>
                          
                          <div className="border-t border-[hsl(var(--border))]/50 my-1" />

                          <button
                            onClick={() => {
                              handleDeleteProduct(prod.id)
                              setOpenMenuProductId(null)
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus Menu
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] leading-tight">
                    {prod.name}
                  </h3>
                  <p className="font-sans font-extrabold text-base text-[hsl(var(--primary))]">
                    {formatIDR(prod.price)}
                  </p>
                </div>

                {/* Recipe status indicator */}
                <div className="bg-[hsl(var(--background))]/50 px-3.5 py-2 rounded-2xl border border-[hsl(var(--border))]/40 flex items-center justify-between text-xs font-semibold">
                  <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                    Komposisi Bahan:
                  </span>
                  <span className={`px-2 py-0.5 rounded-md font-bold ${
                    recipeCount > 0 
                      ? 'bg-orange-50 text-[hsl(var(--primary))]' 
                      : 'bg-red-50 text-red-600 animate-pulse'
                  }`}>
                    {recipeCount > 0 ? `${recipeCount} Bahan (BOM)` : 'Belum Atur Resep'}
                  </span>
                </div>
              </div>

              {/* Actions row */}
              <div className="pt-4 border-t border-[hsl(var(--border))]/50">
                <button
                  onClick={() => openRecipeModal(prod.id)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[hsl(var(--accent))] hover:bg-[hsl(var(--primary))]/10 text-[hsl(var(--accent-foreground))] font-sans font-bold text-sm rounded-2xl transition cursor-pointer shadow-xs border border-[hsl(var(--primary))]/5"
                >
                  <Settings className="w-4 h-4" />
                  Atur Resep (BOM)
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── MODAL 1: Tambah/Edit Product ───────────────────────────── */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[hsl(var(--border))] shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[hsl(var(--border))]">
              <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-[hsl(var(--primary))]" />
                {editingProductId ? 'Edit Menu Jualan' : 'Tambah Menu Jualan Baru'}
              </h3>
              <button 
                onClick={() => setShowProductModal(false)}
                className="p-1 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs font-bold text-[hsl(var(--muted-foreground))] font-sans uppercase tracking-wider">
              <div className="space-y-1.5">
                <label>Nama Menu</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dimsum Mentai Original Isi 5"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-normal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label>Kategori</label>
                  <CustomSelect
                    value={prodCategoryId}
                    onChange={setProdCategoryId}
                    options={categories.map(c => ({ value: c.id, label: c.name }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label>Harga Jual (IDR)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Contoh: 25000"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-sm py-3 rounded-xl shadow-lg transition cursor-pointer text-center"
              >
                {editingProductId ? 'Update Menu' : 'Simpan Menu'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Recipe BOM Editor ──────────────────────────────── */}
      {showRecipeModal && editingProductId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-[hsl(var(--border))] shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-[hsl(var(--border))]">
              <div>
                <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))]">
                  Komposisi Resep (BOM)
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] font-semibold font-sans">
                  Menu: {products.find(p => p.id === editingProductId)?.name}
                </p>
              </div>
              <button 
                onClick={() => { setShowRecipeModal(false); setEditingProductId(null) }}
                className="p-1 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Add Ingredient to recipe Form */}
            <div className="bg-[hsl(var(--background))]/50 p-4 rounded-2xl border border-[hsl(var(--border))]/80 space-y-3">
              <h4 className="text-xs font-bold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-1">
                <PlusCircle className="w-4 h-4 text-[hsl(var(--primary))]" />
                Tambah Bahan Baku ke Resep
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                {/* Ingredient Selector */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                    Pilih Bahan Baku
                  </label>
                  <CustomSelect
                    value={selectedIngredientId}
                    onChange={setSelectedIngredientId}
                    placeholder="Pilih Bahan"
                    options={ingredients.map(ing => ({ value: ing.id, label: ing.name }))}
                    className="w-full"
                  />
                </div>
                
                {/* Quantity Input */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-[#8E7E73] uppercase tracking-wider">
                    JUMLAH TAMBAH
                  </label>
                  <div className="flex items-center justify-between border border-[hsl(var(--border))] rounded-xl bg-white px-3 focus-within:ring-2 focus-within:ring-[hsl(var(--primary))] focus-within:border-[hsl(var(--primary))] transition-all h-[38px]">
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder="Contoh: 1000"
                      value={ingredientQty}
                      onChange={(e) => setIngredientQty(e.target.value)}
                      className="w-full bg-transparent text-xs font-sans font-semibold text-[hsl(var(--foreground))] placeholder-[#BCAAA4]/60 border-none focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      {/* Spinner Arrows (Up/Down) */}
                      <div className="flex flex-col items-center justify-center -space-y-1">
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => {
                            const val = parseFloat(ingredientQty) || 0;
                            const unit = ingredients.find(i => String(i.id).toLowerCase() === String(selectedIngredientId).toLowerCase())?.unit?.toUpperCase() || 'PCS';
                            const step = (unit === 'PCS' || unit === 'BKS' || unit === 'BUTIR') ? 1 : 0.1;
                            setIngredientQty(String(Number((val + step).toFixed(3))));
                          }}
                          className="p-0.5 text-[#8E7E73] hover:text-[hsl(var(--primary))] transition cursor-pointer flex items-center justify-center"
                        >
                          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                            <path d="M12 8l-6 6h12z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => {
                            const val = parseFloat(ingredientQty) || 0;
                            const unit = ingredients.find(i => String(i.id).toLowerCase() === String(selectedIngredientId).toLowerCase())?.unit?.toUpperCase() || 'PCS';
                            const step = (unit === 'PCS' || unit === 'BKS' || unit === 'BUTIR') ? 1 : 0.1;
                            setIngredientQty(String(Number(Math.max(0, val - step).toFixed(3))));
                          }}
                          className="p-0.5 text-[#8E7E73] hover:text-[hsl(var(--primary))] transition cursor-pointer flex items-center justify-center"
                        >
                          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                            <path d="M12 16l6-6H6z" />
                          </svg>
                        </button>
                      </div>

                      {/* Unit Text */}
                      <span className="font-sans font-bold text-xs text-[#F95A2C] tracking-wider uppercase min-w-[30px] text-right">
                        {selectedIngredientId 
                          ? (ingredients.find(i => String(i.id).toLowerCase() === String(selectedIngredientId).toLowerCase())?.unit || 'PCS')
                          : 'PCS'
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={handleAddRecipeItem}
                    className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-xs py-2.5 rounded-xl transition cursor-pointer text-center shadow-md shadow-[hsl(var(--primary))/10] h-[38px] flex items-center justify-center"
                  >
                    Tambahkan
                  </button>
                </div>
              </div>
            </div>

            {/* Active Recipe Items List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Komposisi Saat Ini (Auto-Deduct Aktif)
              </h4>
              
              {recipeItems.length === 0 ? (
                <div className="p-8 text-center text-xs font-semibold text-[hsl(var(--muted-foreground))] bg-stone-50 border border-dashed border-[hsl(var(--border))] rounded-2xl">
                  Belum ada komposisi bahan. Transaksi menu ini tidak akan mengurangi stok bahan baku.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {recipeItems.map((item, idx) => {
                    const ing = ingredients.find(i => i.id === item.ingredient_id)
                    return (
                      <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-[hsl(var(--border))] text-xs font-bold">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                          <span className="text-[hsl(var(--foreground))] text-sm">
                            {ing ? ing.name : 'Bahan Terhapus'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-[hsl(var(--foreground))] text-sm">
                            {item.quantity} <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{ing?.unit}</span>
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipeItem(item.ingredient_id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Save Buttons */}
            <button
              onClick={handleSaveRecipe}
              className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-sm py-3 rounded-xl shadow-lg transition cursor-pointer text-center"
            >
              Simpan & Aktifkan Resep
            </button>
          </div>
        </div>
      )}



      {/* ── MODAL 4: Custom Confirm Modal ────────────────────────── */}
      <ConfirmModal
        isOpen={confirmOpen}
        title="Hapus Menu Jualan?"
        message="Apakah Anda yakin ingin menghapus menu ini beserta seluruh komposisi resepnya? Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  )
}
