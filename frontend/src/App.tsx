import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import Products from './pages/Products'
import Inventory from './pages/Inventory'
import Customers from './pages/Customers'
import Transactions from './pages/Transactions'
import Users from './pages/Users'
import Categories from './pages/Categories'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'

// ── Protected Route Helper ──────────────────────────────────────────
interface ProtectedRouteProps {
  children: React.ReactElement
  allowedRoles: ('owner' | 'kasir' | 'staff')[]
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect unauthorized user to their primary role page
    if (user.role === 'staff') {
      return <Navigate to="/inventory" replace />
    }
    if (user.role === 'kasir') {
      return <Navigate to="/pos" replace />
    }
    return <Navigate to="/login" replace />
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected Dashboard/App Layout */}
        <Route path="/" element={<Layout />}>
          {/* Owner Dashboard */}
          <Route
            index
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Cashier POS */}
          <Route
            path="pos"
            element={
              <ProtectedRoute allowedRoles={['owner', 'kasir']}>
                <POS />
              </ProtectedRoute>
            }
          />

          {/* User Management */}
          <Route
            path="users"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <Users />
              </ProtectedRoute>
            }
          />

          {/* Centralized Settings */}
          <Route
            path="settings"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Product and Recipe Editor */}
          <Route
            path="products"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <Products />
              </ProtectedRoute>
            }
          />

          {/* Category Management */}
          <Route
            path="categories"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <Categories />
              </ProtectedRoute>
            }
          />

          {/* Analytics */}
          <Route
            path="analytics"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <Analytics />
              </ProtectedRoute>
            }
          />

          {/* Inventory Management */}
          <Route
            path="inventory"
            element={
              <ProtectedRoute allowedRoles={['owner', 'staff']}>
                <Inventory />
              </ProtectedRoute>
            }
          />

          {/* Customer Ledger */}
          <Route
            path="customers"
            element={
              <ProtectedRoute allowedRoles={['owner', 'kasir']}>
                <Customers />
              </ProtectedRoute>
            }
          />

          {/* Transaction History */}
          <Route
            path="transactions"
            element={
              <ProtectedRoute allowedRoles={['owner', 'kasir']}>
                <Transactions />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
