import { useState, useMemo, useEffect } from 'react'
import { usePOSStore } from '../store/posStore'
import { useAuthStore } from '../store/authStore'
import api, { formatTxId } from '../lib/api'
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  UserPlus, 
  QrCode, 
  CheckCircle2, 
  Printer, 
  X, 
  User, 
  Flame,
  CreditCard,
  Banknote,
  ShoppingCart
} from 'lucide-react'
import { PaymentMethod } from '../types'
import CustomSelect from '../components/ui/CustomSelect'
import ConfirmModal from '../components/ui/ConfirmModal'

interface CartItem {
  product_id: string
  quantity: number
}

export default function POS() {
  const { 
    products, 
    categories, 
    ingredients, 
    recipes, 
    customers, 
    addCustomer,
    createTransaction,
    checkPromoCode,
    settings
  } = usePOSStore()
  const { user } = useAuthStore()

  // State
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  
  // Checkout & Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  
  // Midtrans Simulation Modal
  const [showMidtransModal, setShowMidtransModal] = useState(false)
  const [pendingTxRequest, setPendingTxRequest] = useState<any>(null)
  
  // Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [completedTransaction, setCompletedTransaction] = useState<any>(null)

  // Confirm Modal state variables
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false)
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Promo & Voucher state variables
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string
    discountAmount: number
    type?: string
    value?: number
  } | null>(null)
  const [promoStatus, setPromoStatus] = useState<{
    type: 'success' | 'error' | 'idle'
    message: string
  }>({ type: 'idle', message: '' })

  // State variables for WhatsApp Gateway manual sending
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [waPhoneInput, setWaPhoneInput] = useState('')
  const [waSendStatus, setWaSendStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' })

  useEffect(() => {
    if (completedTransaction) {
      const customer = completedTransaction.customer_id
        ? customers.find((c) => c.id === completedTransaction.customer_id)
        : null
      setWaPhoneInput(customer && customer.phone ? customer.phone : '')
      setWaSendStatus({ type: 'idle', message: '' })
    } else {
      setWaPhoneInput('')
      setWaSendStatus({ type: 'idle', message: '' })
    }
  }, [completedTransaction, customers])

  // ── BOM Dynamic Stock Calculation ────────────────────────────────
  const productStocks = useMemo(() => {
    const stocks: { [productId: string]: number } = {}

    products.forEach((prod) => {
      const prodRecipes = recipes.filter((r) => r.product_id === prod.id)
      
      if (prodRecipes.length === 0) {
        stocks[prod.id] = 99
        return
      }

      let maxPossible = Infinity
      prodRecipes.forEach((rec) => {
        const ing = ingredients.find((i) => i.id === rec.ingredient_id)
        if (!ing) {
          maxPossible = 0
          return
        }
        const possible = Math.floor(ing.current_stock / rec.quantity)
        if (possible < maxPossible) {
          maxPossible = possible
        }
      })

      stocks[prod.id] = maxPossible === Infinity ? 0 : maxPossible
    })

    return stocks
  }, [products, ingredients, recipes])

  // ── Filtered Products ────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesSearch = prod.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = selectedCategory === null || prod.category_id === selectedCategory
      return matchesSearch && matchesCategory && prod.is_active
    })
  }, [products, search, selectedCategory])

  // ── Cart Actions ─────────────────────────────────────────────────
  const addToCart = (productId: string) => {
    const maxStock = productStocks[productId] ?? 0
    if (maxStock <= 0) return

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === productId)
      if (existing) {
        if (existing.quantity >= maxStock) return prev
        return prev.map((item) => 
          item.product_id === productId 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        )
      }
      return [...prev, { product_id: productId, quantity: 1 }]
    })
  }

  const updateCartQty = (productId: string, delta: number) => {
    const maxStock = productStocks[productId] ?? 0
    setCart((prev) => {
      return prev.map((item) => {
        if (item.product_id === productId) {
          const newQty = item.quantity + delta
          if (newQty <= 0) return null
          if (newQty > maxStock) return item
          return { ...item, quantity: newQty }
        }
        return item
      }).filter(Boolean) as CartItem[]
    })
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId))
  }

  const cartDetails = useMemo(() => {
    let subtotal = 0
    const items = cart.map((c) => {
      const prod = products.find((p) => p.id === c.product_id)
      const price = prod?.price ?? 0
      const total = price * c.quantity
      subtotal += total
      return {
        ...c,
        product: prod,
        unitPrice: price,
        subtotal: total
      }
    })
    return { items, subtotal }
  }, [cart, products])

  // Helper to reset cart and promo states
  const resetCartAndPromo = () => {
    setCart([])
    setSelectedCustomerId('')
    setAppliedPromo(null)
    setPromoCodeInput('')
    setPromoStatus({ type: 'idle', message: '' })
  }

  // Revalidate or clear promo on subtotal changes
  useEffect(() => {
    if (appliedPromo) {
      if (cartDetails.subtotal === 0) {
        setAppliedPromo(null)
        setPromoStatus({ type: 'idle', message: '' })
        return
      }
      checkPromoCode(appliedPromo.code, cartDetails.subtotal).then((res) => {
        if (res.valid) {
          setAppliedPromo({
            code: appliedPromo.code,
            discountAmount: res.discount_amount,
            type: res.type,
            value: res.value
          })
          setPromoStatus({ type: 'success', message: res.message })
        } else {
          setAppliedPromo(null)
          setPromoStatus({ type: 'error', message: `Promo dilepas: ${res.message}` })
        }
      }).catch(() => {
        setAppliedPromo(null)
        setPromoStatus({ type: 'error', message: 'Koneksi gagal saat re-validasi promo' })
      })
    }
  }, [cartDetails.subtotal, checkPromoCode])

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) return
    if (cartDetails.subtotal === 0) {
      setPromoStatus({ type: 'error', message: 'Pilih produk terlebih dahulu' })
      return
    }
    setPromoStatus({ type: 'idle', message: '' })
    try {
      const res = await checkPromoCode(promoCodeInput.trim().toUpperCase(), cartDetails.subtotal)
      if (res.valid) {
        setAppliedPromo({
          code: promoCodeInput.trim().toUpperCase(),
          discountAmount: res.discount_amount,
          type: res.type,
          value: res.value
        })
        setPromoStatus({ type: 'success', message: res.message })
      } else {
        setAppliedPromo(null)
        setPromoStatus({ type: 'error', message: res.message })
      }
    } catch (err) {
      setAppliedPromo(null)
      setPromoStatus({ type: 'error', message: 'Gagal memproses kode promo' })
    }
  }

  const handleRemovePromo = () => {
    setAppliedPromo(null)
    setPromoCodeInput('')
    setPromoStatus({ type: 'idle', message: '' })
  }

  // ── Inline Customer Creation ─────────────────────────────────────
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustName || !newCustPhone) return
    try {
      const newCust = await addCustomer({ name: newCustName, phone: newCustPhone })
      setSelectedCustomerId(newCust.id)
      setNewCustName('')
      setNewCustPhone('')
      setIsAddingCustomer(false)
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Gagal mendaftarkan customer')
      setShowErrorModal(true)
    }
  }

  // ── Checkout & Payment Simulation ────────────────────────────────
  const handleCheckoutClick = () => {
    if (cart.length === 0) return
    setShowCheckoutConfirm(true)
  }

  const triggerMidtransSnap = (snapToken: string, transaction: any) => {
    const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || 'dummy'
    const scriptId = 'midtrans-snap-script'
    let script = document.getElementById(scriptId) as HTMLScriptElement

    if (!script) {
      script = document.createElement('script')
      script.src = 'https://app.sandbox.midtrans.com/snap/snap.js'
      script.id = scriptId
      script.setAttribute('data-client-key', clientKey)
      document.body.appendChild(script)
    }

    const showSnapPopup = () => {
      if ((window as any).snap) {
        (window as any).snap.pay(snapToken, {
          onSuccess: async (result: any) => {
            console.log('Payment success:', result)
            try {
              const updatedTx = await api.get(`/transactions/${transaction.id}`)
              setCompletedTransaction(updatedTx.data.data)
              setShowReceiptModal(true)
              resetCartAndPromo()
            } catch (err) {
              console.error('Failed to get transaction status:', err)
              setShowReceiptModal(true)
              resetCartAndPromo()
            }
          },
          onPending: async (result: any) => {
            console.log('Payment pending:', result)
            try {
              const updatedTx = await api.get(`/transactions/${transaction.id}`)
              setCompletedTransaction(updatedTx.data.data)
              setShowReceiptModal(true)
              resetCartAndPromo()
            } catch (err) {
              console.error('Failed to get transaction status:', err)
              setShowReceiptModal(true)
              resetCartAndPromo()
            }
          },
          onError: (result: any) => {
            console.error('Payment error:', result)
            setErrorMessage('Pembayaran Midtrans gagal atau dibatalkan.')
            setShowErrorModal(true)
          },
          onClose: () => {
            console.log('Payment popup closed without finishing')
          }
        })
      } else {
        setTimeout(showSnapPopup, 100)
      }
    }

    showSnapPopup()
  }

  const executeCheckout = async () => {
    setShowCheckoutConfirm(false)
    const txRequest = {
      customer_id: selectedCustomerId || undefined,
      payment_method: paymentMethod,
      items: cart.map(c => ({ product_id: c.product_id, quantity: c.quantity })),
      user_id: user?.id || 'u-1',
      promo_code: appliedPromo ? appliedPromo.code : undefined
    }

    const result = await createTransaction(txRequest)
    if (result.success && result.transaction) {
      setCompletedTransaction(result.transaction)
      if (paymentMethod === 'midtrans') {
        if (result.snap_token && result.snap_token.startsWith('snap-token-mock-')) {
          setPendingTxRequest({
            token: result.snap_token,
            redirect_url: result.snap_redirect_url,
            transaction: result.transaction
          })
          setShowMidtransModal(true)
        } else if (result.snap_token) {
          triggerMidtransSnap(result.snap_token, result.transaction)
        } else {
          setErrorMessage('Token pembayaran Midtrans tidak ditemukan.')
          setShowErrorModal(true)
        }
      } else {
        setShowReceiptModal(true)
        resetCartAndPromo()
      }
    } else {
      setErrorMessage(result.error || 'Terjadi kesalahan saat transaksi')
      setShowErrorModal(true)
    }
  }

  const handleSimulateMidtransPaid = async () => {
    if (!completedTransaction) return
    
    try {
      // Call public webhook directly to simulate Midtrans notification!
      await api.post('/transactions/midtrans-webhook', {
        order_id: completedTransaction.id,
        transaction_status: 'settlement',
        payment_type: 'qris',
        status_code: '200',
        gross_amount: completedTransaction.total_amount.toString(),
        fraud_status: 'accept'
      })

      // Fetch latest transaction state from backend
      const updatedTx = await api.get(`/transactions/${completedTransaction.id}`)
      setCompletedTransaction(updatedTx.data.data)

      setShowReceiptModal(true)
      setShowMidtransModal(false)
      setPendingTxRequest(null)
      resetCartAndPromo()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Terjadi kesalahan saat checkout QRIS')
      setShowErrorModal(true)
    }
  }

  const handleClearCart = () => {
    resetCartAndPromo()
    setShowClearCartConfirm(false)
  }

  const handleSendWhatsAppReceipt = async () => {
    if (!completedTransaction) return

    setSendingWhatsApp(true)
    setWaSendStatus({ type: 'idle', message: '' })

    try {
      const resp = await api.post(`/transactions/${completedTransaction.id}/send-whatsapp-receipt`, {
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

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 relative">
      {/* LEFT: Product catalog */}
      <div className="flex-1 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-[hsl(var(--foreground))] tracking-tight">
              Kasir POS
            </h2>
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] font-sans">
              Pilih menu dimsum mentai lezat untuk pelanggan
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Cari nama menu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-[hsl(var(--border))] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] transition"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4.5 py-2.5 rounded-2xl font-sans font-bold text-xs shrink-0 transition cursor-pointer border ${
              selectedCategory === null
                ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))] shadow-md shadow-[hsl(var(--primary))/25]'
                : 'bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
            }`}
          >
            Semua Menu
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4.5 py-2.5 rounded-2xl font-sans font-bold text-xs shrink-0 transition cursor-pointer border ${
                selectedCategory === cat.id
                  ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))] shadow-md shadow-[hsl(var(--primary))/25]'
                  : 'bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-[hsl(var(--border))]">
            <p className="font-sans font-bold text-[hsl(var(--muted-foreground))] text-sm">
              Menu tidak ditemukan. Silakan ganti kata pencarian atau kategori.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map((prod) => {
              const stock = productStocks[prod.id] ?? 0
              const isOutOfStock = stock <= 0
              return (
                <div 
                  key={prod.id} 
                  onClick={() => !isOutOfStock && addToCart(prod.id)}
                  className={`bg-white rounded-3xl border p-5 transition-all select-none flex flex-col justify-between cursor-pointer border-[hsl(var(--border))] ${
                    isOutOfStock 
                      ? 'opacity-60 cursor-not-allowed bg-stone-50 border-stone-200' 
                      : 'hover:shadow-lg hover:border-[hsl(var(--primary))]/30 hover-card-lift'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border border-[hsl(var(--primary))]/10">
                        {categories.find(c => c.id === prod.category_id)?.name || 'Tanpa Kategori'}
                      </span>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                        isOutOfStock 
                          ? 'bg-red-50 text-red-600 border border-red-100' 
                          : stock <= 5 
                          ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse' 
                          : 'bg-green-50 text-green-700 border border-green-100'
                      }`}>
                        {isOutOfStock ? 'Habis' : `Sisa: ${stock} porsi`}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-base text-[hsl(var(--foreground))] leading-tight">
                      {prod.name}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-3 border-t border-[hsl(var(--border))]/50">
                    <span className="font-sans font-extrabold text-base text-[hsl(var(--foreground))]">
                      {formatIDR(prod.price)}
                    </span>
                    <button
                      disabled={isOutOfStock}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm transition ${
                        isOutOfStock 
                          ? 'bg-stone-300' 
                          : 'bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90'
                      }`}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* RIGHT: Shopping Cart sidebar */}
      <div className="w-full lg:w-96 shrink-0 bg-white rounded-3xl border border-[hsl(var(--border))] p-6 space-y-6 lg:sticky lg:top-8 h-fit shadow-sm">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))]/60 pb-3">
          <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[hsl(var(--primary))]" />
            Keranjang Belanja
          </h3>
          {cart.length > 0 && (
            <button
              onClick={() => setShowClearCartConfirm(true)}
              className="text-xs font-bold text-red-500 hover:text-red-600 transition flex items-center gap-1 cursor-pointer"
              title="Kosongkan Keranjang"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>

        {/* Cart items list */}
        {cartDetails.items.length === 0 ? (
          <div className="py-12 text-center text-stone-400 font-sans font-bold text-xs space-y-2">
            <ShoppingCart className="w-10 h-10 mx-auto text-stone-300 stroke-[1.5]" />
            <p>Keranjang masih kosong.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
            {cartDetails.items.map((item) => (
              <div key={item.product_id} className="flex justify-between items-center gap-3 bg-[hsl(var(--background))]/30 p-2.5 rounded-2xl border border-[hsl(var(--border))]/40">
                <div className="min-w-0 flex-1">
                  <h4 className="font-sans font-bold text-xs text-[hsl(var(--foreground))] truncate">
                    {item.product?.name}
                  </h4>
                  <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))]">
                    {formatIDR(item.unitPrice)} / porsi
                  </span>
                </div>
                
                <div className="flex items-center gap-2 bg-white rounded-lg border border-[hsl(var(--border))] px-1.5 py-0.5">
                  <button
                    onClick={() => updateCartQty(item.product_id, -1)}
                    className="p-1 hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-sans font-extrabold text-xs text-[hsl(var(--foreground))] min-w-4 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateCartQty(item.product_id, 1)}
                    className="p-1 hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => removeFromCart(item.product_id)}
                  className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Customer Select / Register Block */}
        <div className="pt-4 border-t border-[hsl(var(--border))]/60 space-y-3.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
              Pelanggan (Opsional)
            </label>
            <button
              onClick={() => setIsAddingCustomer(!isAddingCustomer)}
              className="text-xs font-bold text-[hsl(var(--primary))] flex items-center gap-1 hover:underline cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {isAddingCustomer ? 'Batal' : 'Daftar Baru'}
            </button>
          </div>

          {isAddingCustomer ? (
            <form onSubmit={handleCreateCustomer} className="bg-[hsl(var(--background))]/50 p-3 rounded-2xl border border-[hsl(var(--border))] space-y-2">
              <input
                type="text"
                required
                placeholder="Nama Pelanggan"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-xs focus:ring-1 focus:ring-[hsl(var(--primary))] bg-white focus:outline-none"
              />
              <input
                type="tel"
                required
                placeholder="Nomor HP (Contoh: 0812...)"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-xs focus:ring-1 focus:ring-[hsl(var(--primary))] bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="w-full py-1.5 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-xs rounded-lg transition"
              >
                Simpan & Pilih Pelanggan
              </button>
            </form>
          ) : (
            <CustomSelect
              value={selectedCustomerId}
              onChange={setSelectedCustomerId}
              placeholder="Pilih Pelanggan (Walk-In)"
              options={customers.map(c => ({ value: c.id, label: `${c.name} (${c.phone})` }))}
              icon={<User className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
              searchable={true}
              searchPlaceholder="Cari nama/no HP..."
            />
          )}
        </div>

        {/* Promo / Voucher Block */}
        <div className="pt-4 border-t border-[hsl(var(--border))]/60 space-y-3">
          <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider block">
            Voucher & Promo
          </label>
          
          {appliedPromo ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between animate-fade-in">
              <div className="min-w-0">
                <span className="inline-block text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-white mr-1.5">
                  {appliedPromo.code}
                </span>
                <span className="text-xs font-bold text-emerald-800">
                  Hemat {formatIDR(appliedPromo.discountAmount)}
                </span>
              </div>
              <button
                onClick={handleRemovePromo}
                className="p-1 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-800 rounded-lg transition cursor-pointer"
                title="Hapus Promo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Masukkan kode promo (MENTAIPAS / MENTAIHEBAT)"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[hsl(var(--border))] text-xs focus:ring-1 focus:ring-[hsl(var(--primary))] bg-white focus:outline-none uppercase font-sans font-bold"
                />
                <button
                  onClick={handleApplyPromo}
                  className="px-4 py-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Terapkan
                </button>
              </div>
              {promoStatus.type !== 'idle' && (
                <p className={`text-[10px] font-bold ${
                  promoStatus.type === 'success' ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {promoStatus.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            Metode Pembayaran
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`p-2.5 rounded-2xl border text-[10px] font-extrabold uppercase flex flex-col items-center gap-1 transition cursor-pointer ${
                paymentMethod === 'cash'
                  ? 'bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                  : 'bg-white border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
              }`}
            >
              <Banknote className="w-4 h-4" />
              Tunai
            </button>
            <button
              onClick={() => setPaymentMethod('transfer')}
              className={`p-2.5 rounded-2xl border text-[10px] font-extrabold uppercase flex flex-col items-center gap-1 transition cursor-pointer ${
                paymentMethod === 'transfer'
                  ? 'bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                  : 'bg-white border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Transfer
            </button>
            <button
              onClick={() => setPaymentMethod('midtrans')}
              className={`p-2.5 rounded-2xl border text-[10px] font-extrabold uppercase flex flex-col items-center gap-1 transition cursor-pointer ${
                paymentMethod === 'midtrans'
                  ? 'bg-[hsl(var(--primary))]/10 border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                  : 'bg-white border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
              }`}
            >
              <QrCode className="w-4 h-4" />
              Midtrans QRIS
            </button>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="pt-4 border-t border-[hsl(var(--border))]/60 space-y-2">
          <div className="flex justify-between text-xs font-bold text-[hsl(var(--muted-foreground))]">
            <span>Subtotal</span>
            <span>{formatIDR(cartDetails.subtotal)}</span>
          </div>
          {appliedPromo && (
            <div className="flex justify-between text-xs font-bold text-emerald-600">
              <span>Diskon ({appliedPromo.code})</span>
              <span>-{formatIDR(appliedPromo.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs font-bold text-[hsl(var(--muted-foreground))]">
            <span>Pajak (0%)</span>
            <span>Rp0</span>
          </div>
          <div className="flex justify-between text-sm font-extrabold text-[hsl(var(--foreground))] pt-1">
            <span>Total Belanja</span>
            <span className="text-base text-[hsl(var(--primary))]">
              {formatIDR(cartDetails.subtotal - (appliedPromo ? appliedPromo.discountAmount : 0))}
            </span>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={handleCheckoutClick}
          disabled={cart.length === 0}
          className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-sm py-3.5 rounded-2xl shadow-lg shadow-[hsl(var(--primary))/15] hover:shadow-xl disabled:opacity-50 transition cursor-pointer"
        >
          Konfirmasi Transaksi
        </button>
      </div>

      {/* ── MODAL 1: Midtrans Snap simulator ────────────────────────── */}
      {showMidtransModal && pendingTxRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-[hsl(var(--border))] shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-1.5 text-blue-600 font-extrabold font-display">
                <QrCode className="w-5 h-5" />
                Midtrans Snap
              </div>
              <button 
                onClick={() => { setShowMidtransModal(false); setPendingTxRequest(null) }} 
                className="p-1 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center space-y-3">
              <p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">
                Pindai kode QRIS di bawah untuk menyelesaikan pembayaran online.
              </p>
              
              <div className="w-48 h-48 mx-auto border-2 border-[hsl(var(--border))] rounded-2xl p-3 bg-white flex flex-col justify-center items-center relative overflow-hidden">
                <svg className="w-full h-full text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                  <rect x="5" y="5" width="25" height="25" />
                  <rect x="8" y="8" width="19" height="19" fill="white" />
                  <rect x="12" y="12" width="11" height="11" />
                  
                  <rect x="70" y="5" width="25" height="25" />
                  <rect x="73" y="8" width="19" height="19" fill="white" />
                  <rect x="77" y="12" width="11" height="11" />
                  
                  <rect x="5" y="70" width="25" height="25" />
                  <rect x="8" y="73" width="19" height="19" fill="white" />
                  <rect x="12" y="77" width="11" height="11" />
                  <circle cx="50" cy="50" r="10" fill="white" />
                  <circle cx="50" cy="50" r="7" fill="orange" />
                  <rect x="35" y="10" width="8" height="5" />
                  <rect x="45" y="5" width="5" height="12" />
                  <rect x="55" y="15" width="10" height="4" />
                  <rect x="40" y="25" width="6" height="15" />
                  <rect x="35" y="45" width="5" height="5" />
                  <rect x="10" y="35" width="15" height="8" />
                  <rect x="15" y="50" width="8" height="12" />
                  <rect x="50" y="65" width="12" height="15" />
                  <rect x="35" y="75" width="15" height="5" />
                  <rect x="75" y="35" width="8" height="18" />
                  <rect x="65" y="55" width="5" height="8" />
                  <rect x="85" y="65" width="10" height="5" />
                  <rect x="75" y="80" width="12" height="6" />
                </svg>
              </div>

              <div className="pt-2">
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded bg-blue-50 text-blue-600 border border-blue-100">
                  Total Tagihan: {formatIDR(cartDetails.subtotal)}
                </span>
              </div>
            </div>

            <button
              onClick={handleSimulateMidtransPaid}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-sm py-2.5 rounded-xl shadow-md transition cursor-pointer text-center"
            >
              Simulasikan Pembayaran Sukses (Webhook Callback)
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Completed Receipt modal ───────────────────────── */}
      {showReceiptModal && completedTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[hsl(var(--border))] shadow-2xl p-6 space-y-6">
            <div className="text-center space-y-1.5 border-b border-[hsl(var(--border))]/60 pb-4">
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 flex items-center justify-center text-[hsl(var(--primary))] mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))]">
                Transaksi Sukses
              </h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Stok bahan baku otomatis terpotong sesuai resep (BOM)
              </p>
            </div>

            <div className="bg-stone-50 border border-[hsl(var(--border))] rounded-2xl p-5 space-y-4 font-mono text-[11px] text-[hsl(var(--foreground))] max-h-72 overflow-y-auto printable-receipt-container">
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
                  <span className="font-bold">{formatTxId(completedTransaction.id)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tanggal:</span>
                  <span>{new Date(completedTransaction.created_at).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kasir:</span>
                  <span>{user?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pelanggan:</span>
                  <span>
                    {completedTransaction.customer_id 
                      ? customers.find(c => c.id === completedTransaction.customer_id)?.name 
                      : 'Walk-In'}
                  </span>
                </div>
                <p className="border-b border-dashed border-stone-300 py-1" />
              </div>

              <div className="space-y-2">
                {completedTransaction.items?.map((item: any, idx: number) => {
                  const pName = products.find(p => p.id === item.product_id)?.name || 'Menu'
                  return (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between font-bold">
                        <span>{pName}</span>
                        <span>{formatIDR(item.subtotal)}</span>
                      </div>
                      <div className="text-stone-500">
                        {item.quantity} porsi x {formatIDR(item.unit_price)}
                      </div>
                    </div>
                  )
                })}
                <p className="border-b border-dashed border-stone-300 py-1" />
              </div>

              <div className="space-y-1">
                {completedTransaction.discount_amount > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>SUBTOTAL</span>
                      <span>{formatIDR(completedTransaction.total_amount + completedTransaction.discount_amount)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 font-bold">
                      <span>DISKON ({completedTransaction.promo_code || 'PROMO'})</span>
                      <span>-{formatIDR(completedTransaction.discount_amount)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-extrabold text-xs">
                  <span>TOTAL BELANJA</span>
                  <span>{formatIDR(completedTransaction.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>METODE BAYAR:</span>
                  <span className="uppercase">{completedTransaction.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span>STATUS PEMBAYARAN:</span>
                  <span className="uppercase text-emerald-600 font-bold">{completedTransaction.payment_status}</span>
                </div>
              </div>

              <div className="text-center pt-2 border-t border-dashed border-stone-300 text-[10px] text-stone-500 whitespace-pre-line leading-normal">
                {(settings.receipt_footer || 'Terima kasih atas pesanan Anda!\nMentai Mental - Dimsum Mentai Juara').replace(/\\n/g, '\n')}
              </div>
            </div>

            <div className="space-y-3">
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

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    window.print()
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-xs font-bold rounded-xl transition cursor-pointer text-[hsl(var(--foreground))]"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Struk
                </button>
                <button
                  onClick={() => {
                    setShowReceiptModal(false)
                    setCompletedTransaction(null)
                  }}
                  className="flex-1 py-2.5 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer text-center"
                >
                  Tutup & Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {/* 1. Checkout Confirmation Modal */}
      <ConfirmModal
        isOpen={showCheckoutConfirm}
        title="Proses Transaksi?"
        message={`Apakah Anda yakin ingin memproses transaksi senilai ${formatIDR(
          cartDetails.subtotal - (appliedPromo ? appliedPromo.discountAmount : 0)
        )} dengan metode ${
          paymentMethod === 'cash' 
            ? 'Tunai' 
            : paymentMethod === 'transfer' 
            ? 'Transfer Bank' 
            : 'Midtrans QRIS'
        }?`}
        confirmText="Ya, Proses"
        cancelText="Batal"
        type="info"
        onConfirm={executeCheckout}
        onCancel={() => setShowCheckoutConfirm(false)}
      />

      {/* 2. Clear Cart Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearCartConfirm}
        title="Kosongkan Keranjang?"
        message="Apakah Anda yakin ingin menghapus seluruh item dari keranjang belanja? Tindakan ini akan mereset pesanan saat ini."
        confirmText="Ya, Kosongkan"
        cancelText="Batal"
        type="warning"
        onConfirm={handleClearCart}
        onCancel={() => setShowClearCartConfirm(false)}
      />

      {/* 3. Error Alert Modal (No Cancel Button) */}
      <ConfirmModal
        isOpen={showErrorModal}
        title="Transaksi Gagal"
        message={errorMessage}
        confirmText="Tutup"
        type="danger"
        onConfirm={() => {
          setShowErrorModal(false)
          setErrorMessage('')
        }}
      />
    </div>
  )
}
