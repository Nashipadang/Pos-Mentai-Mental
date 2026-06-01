import { create } from 'zustand'
import api from '../lib/api'
import { useAuthStore } from './authStore'
import { 
  Product, Category, Ingredient, RecipeItem, Customer, 
  Transaction, PaymentMethod, TransactionStatus, PaymentStatus, User, Promo
} from '../types'

interface POSState {
  products: Product[]
  categories: Category[]
  ingredients: Ingredient[]
  recipes: RecipeItem[]
  customers: Customer[]
  transactions: Transaction[]
  users: User[]
  promos: Promo[]
  settings: Record<string, string>
  
  // Actions
  fetchInitialData: () => Promise<void>
  fetchUsers: () => Promise<void>
  fetchSettings: () => Promise<void>
  updateSettings: (updates: Record<string, string>) => Promise<void>
  
  addProduct: (product: Omit<Product, 'id' | 'created_at'>) => Promise<void>
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  
  addIngredient: (ingredient: Omit<Ingredient, 'id' | 'created_at'>) => Promise<void>
  updateIngredient: (id: string, updates: Partial<Ingredient>) => Promise<void>
  deleteIngredient: (id: string) => Promise<void>
  restockIngredient: (id: string, quantity: number, notes?: string) => Promise<void>
  
  saveRecipe: (productId: string, items: { ingredient_id: string; quantity: number }[]) => Promise<void>
  
  addCustomer: (customer: Omit<Customer, 'id' | 'created_at' | 'total_transactions' | 'total_spent'>) => Promise<Customer>
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  addCategory: (name: string) => Promise<void>
  updateCategory: (id: number, name: string) => Promise<void>
  deleteCategory: (id: number) => Promise<void>
  
  createTransaction: (request: {
    customer_id?: string
    payment_method: PaymentMethod
    payment_status?: PaymentStatus
    status?: TransactionStatus
    items: { product_id: string; quantity: number }[]
    user_id: string
    promo_code?: string
  }) => Promise<{ success: boolean; error?: string; transaction?: Transaction; snap_token?: string; snap_redirect_url?: string }>
  cancelTransaction: (id: string) => Promise<void>
  
  // User Management actions
  addUser: (user: Omit<User, 'id' | 'created_at'> & { password?: string }) => Promise<void>
  updateUser: (id: string, updates: Partial<User> & { password?: string }) => Promise<void>
  deleteUser: (id: string) => Promise<void>
  checkPromoCode: (code: string, totalAmount: number) => Promise<{
    valid: boolean
    message: string
    discount_amount: number
    final_amount: number
    type?: string
    value?: number
  }>

  // Promo Management actions
  fetchPromos: () => Promise<void>
  addPromo: (promo: Omit<Promo, 'id' | 'created_at'>) => Promise<void>
  updatePromo: (id: string, updates: Partial<Promo>) => Promise<void>
  deletePromo: (id: string) => Promise<void>
}

export const usePOSStore = create<POSState>()((set, get) => ({
  products: [],
  categories: [],
  ingredients: [],
  recipes: [],
  customers: [],
  transactions: [],
  users: [],
  promos: [],
  settings: {},

  fetchInitialData: async () => {
    try {
      const [prods, cats, ings, recs, custs, txs, settingsResp] = await Promise.all([
        api.get('/products'),
        api.get('/categories'),
        api.get('/ingredients'),
        api.get('/recipes'),
        api.get('/customers'),
        api.get('/transactions'),
        api.get('/settings').catch(e => {
          console.error("Gagal sinkronisasi settings:", e)
          return { data: { data: {} } }
        })
      ])

      const userRole = useAuthStore.getState().user?.role
      if (userRole === 'owner') {
        try {
          const usersResp = await api.get('/users')
          set({ users: usersResp.data.data || [] })
        } catch (e) {
          console.error("Gagal sinkronisasi data pengguna:", e)
        }
      }

      set({
        products: prods.data.data || [],
        categories: cats.data.data || [],
        ingredients: ings.data.data || [],
        recipes: recs.data.data || [],
        customers: custs.data.data || [],
        transactions: txs.data.data || [],
        settings: settingsResp.data.data || {}
      })
    } catch (err) {
      console.error("Gagal sinkronisasi data dari Go Backend POS:", err)
    }
  },

  fetchUsers: async () => {
    try {
      const resp = await api.get('/users')
      set({ users: resp.data.data || [] })
    } catch (err) {
      console.error("Gagal mengambil data pengguna:", err)
    }
  },

  // ── Products ──────────────────────────────────────────────
  addProduct: async (product) => {
    try {
      await api.post('/products', product)
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal menambah produk:", err)
    }
  },
  
  updateProduct: async (id, updates) => {
    try {
      const existing = get().products.find(p => p.id === id)
      const payload = {
        category_id: existing?.category_id,
        name: existing?.name,
        price: existing?.price,
        is_active: existing?.is_active,
        image_url: existing?.image_url,
        ...updates
      }
      await api.put(`/products/${id}`, payload)
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal mengupdate produk:", err)
    }
  },
  
  deleteProduct: async (id) => {
    try {
      await api.delete(`/products/${id}`)
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal menghapus produk:", err)
    }
  },

  // ── Ingredients ───────────────────────────────────────────
  addIngredient: async (ingredient) => {
    try {
      await api.post('/ingredients', ingredient)
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal menambah bahan baku:", err)
    }
  },
  
  updateIngredient: async (id, updates) => {
    try {
      await api.put(`/ingredients/${id}`, updates)
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal mengupdate bahan baku:", err)
    }
  },
  
  deleteIngredient: async (id) => {
    try {
      await api.delete(`/ingredients/${id}`)
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal menghapus bahan baku:", err)
    }
  },

  restockIngredient: async (id, quantity, notes) => {
    try {
      await api.post(`/ingredients/${id}/restock`, { quantity, notes })
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal merestock bahan baku:", err)
    }
  },

  // ── Recipes ───────────────────────────────────────────────
  saveRecipe: async (productId, items) => {
    try {
      await api.post(`/recipes/product/${productId}`, items)
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal menyimpan resep:", err)
    }
  },

  // ── Customers ─────────────────────────────────────────────
  addCustomer: async (customer) => {
    try {
      const resp = await api.post('/customers', customer)
      await get().fetchInitialData()
      return resp.data.data
    } catch (err) {
      console.error("Gagal menambah customer:", err)
      throw err
    }
  },
  
  updateCustomer: async (id, updates) => {
    try {
      await api.put(`/customers/${id}`, updates)
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal mengupdate customer:", err)
    }
  },
  
  deleteCustomer: async (id) => {
    try {
      await api.delete(`/customers/${id}`)
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal menghapus customer:", err)
    }
  },

  addCategory: async (name) => {
    try {
      await api.post('/categories', { name })
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal menambah kategori:", err)
    }
  },

  updateCategory: async (id, name) => {
    try {
      await api.put(`/categories/${id}`, { name })
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal mengupdate kategori:", err)
      throw err
    }
  },

  deleteCategory: async (id) => {
    try {
      await api.delete(`/categories/${id}`)
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal menghapus kategori:", err)
      throw err
    }
  },

  // ── Transaction & Auto-Deduction ───────────────────────────
  createTransaction: async (request) => {
    try {
      const resp = await api.post('/transactions', request)
      await get().fetchInitialData()
      return {
        success: true,
        transaction: resp.data.data.transaction,
        snap_token: resp.data.data.snap_token,
        snap_redirect_url: resp.data.data.snap_redirect_url
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal memproses checkout transaksi'
      return {
        success: false,
        error: msg
      }
    }
  },

  cancelTransaction: async (id) => {
    try {
      await api.post(`/transactions/${id}/cancel`)
      await get().fetchInitialData()
    } catch (err) {
      console.error("Gagal membatalkan transaksi:", err)
    }
  },

  // ── User Management CRUD ──────────────────────────────────
  addUser: async (user) => {
    try {
      await api.post('/users', user)
      await get().fetchUsers()
    } catch (err) {
      console.error("Gagal menambah pengguna:", err)
      throw err
    }
  },

  updateUser: async (id, updates) => {
    try {
      await api.put(`/users/${id}`, updates)
      await get().fetchUsers()
    } catch (err) {
      console.error("Gagal mengupdate pengguna:", err)
      throw err
    }
  },

  deleteUser: async (id) => {
    try {
      await api.delete(`/users/${id}`)
      await get().fetchUsers()
    } catch (err) {
      console.error("Gagal menghapus pengguna:", err)
      throw err
    }
  },

  fetchSettings: async () => {
    try {
      const resp = await api.get('/settings')
      set({ settings: resp.data.data || {} })
    } catch (err) {
      console.error("Gagal mengambil pengaturan:", err)
    }
  },

  updateSettings: async (updates) => {
    try {
      await api.put('/settings', updates)
      await get().fetchSettings()
    } catch (err) {
      console.error("Gagal mengupdate pengaturan:", err)
      throw err
    }
  },

  checkPromoCode: async (code: string, totalAmount: number) => {
    try {
      const resp = await api.post('/promos/check', { code, total_amount: totalAmount })
      return resp.data.data
    } catch (err) {
      console.error("Gagal memvalidasi kode promo:", err)
      return { valid: false, message: "Gagal memproses kode promo di server" }
    }
  },

  fetchPromos: async () => {
    try {
      const resp = await api.get('/promos/all')
      set({ promos: resp.data.data || [] })
    } catch (err) {
      console.error("Gagal mengambil daftar voucher:", err)
    }
  },

  addPromo: async (promo) => {
    try {
      await api.post('/promos', promo)
      await get().fetchPromos()
    } catch (err) {
      console.error("Gagal menambah voucher baru:", err)
      throw err
    }
  },

  updatePromo: async (id, updates) => {
    try {
      const existing = get().promos.find(p => p.id === id)
      const payload = {
        code: existing?.code,
        type: existing?.type,
        value: existing?.value,
        min_transaction: existing?.min_transaction,
        max_discount: existing?.max_discount,
        is_active: existing?.is_active,
        ...updates
      }
      await api.put(`/promos/${id}`, payload)
      await get().fetchPromos()
    } catch (err) {
      console.error("Gagal mengupdate voucher:", err)
      throw err
    }
  },

  deletePromo: async (id) => {
    try {
      await api.delete(`/promos/${id}`)
      await get().fetchPromos()
    } catch (err) {
      console.error("Gagal menghapus voucher:", err)
      throw err
    }
  }
}))
