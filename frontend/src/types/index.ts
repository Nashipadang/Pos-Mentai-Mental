// Common API types matching Go backend response format

export interface ApiResponse<T> {
  status: 'success' | 'error'
  message?: string
  data?: T
  meta?: {
    page?: number
    per_page?: number
    total: number
  }
}

// ── Auth ────────────────────────────────────────────────────
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  access_token: string
  refresh_token: string
}

// ── User ────────────────────────────────────────────────────
export type UserRole = 'owner' | 'kasir' | 'staff'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

// ── Category ────────────────────────────────────────────────
export interface Category {
  id: number
  name: string
}

// ── Product ─────────────────────────────────────────────────
export interface Product {
  id: string
  category_id: number
  category?: Category
  name: string
  price: number
  image_url?: string
  is_active: boolean
  created_at: string
}

// ── Ingredient ──────────────────────────────────────────────
export interface Ingredient {
  id: string
  name: string
  unit: string
  current_stock: number
  min_threshold?: number
  is_low?: boolean
  prediction_days?: number
  created_at: string
}

// ── Recipe ──────────────────────────────────────────────────
export interface RecipeItem {
  id: string
  product_id: string
  ingredient_id: string
  ingredient?: Ingredient
  quantity: number
}

// ── Customer ────────────────────────────────────────────────
export interface Customer {
  id: string
  name: string
  phone: string
  total_transactions: number
  total_spent: number
  created_at: string
}

// ── Transaction ─────────────────────────────────────────────
export type PaymentMethod = 'cash' | 'transfer' | 'midtrans'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired'
export type TransactionStatus = 'pending' | 'completed' | 'cancelled'

export interface TransactionItem {
  product_id: string
  quantity: number
  product?: Product
  unit_price?: number
  subtotal?: number
}

export interface CreateTransactionRequest {
  customer_id?: string
  payment_method: PaymentMethod
  items: { product_id: string; quantity: number }[]
}

export interface Transaction {
  id: string
  user_id: string
  customer_id?: string
  total_amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  midtrans_order_id?: string
  snap_token?: string
  snap_redirect_url?: string
  status: TransactionStatus
  created_at: string
  promo_code?: string
  discount_amount?: number
  items?: TransactionItem[]
}

export interface Promo {
  id: string
  code: string
  type: 'percentage' | 'flat'
  value: number
  min_transaction: number
  max_discount?: number | null
  is_active: boolean
  created_at: string
}

// ── Analytics ───────────────────────────────────────────────
export interface DashboardData {
  today: {
    total_transactions: number
    total_revenue: number
  }
  top_selling: {
    product: string
    qty_sold: number
    revenue: number
  }[]
  busy_hours: {
    hour: number
    transaction_count: number
  }[]
  low_stock_alerts: {
    ingredient: string
    current: number
    threshold: number
  }[]
}
