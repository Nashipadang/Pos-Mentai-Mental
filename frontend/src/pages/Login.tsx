import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, UserRole } from '../store/authStore'
import { Flame, Lock, Mail, ArrowRight, User } from 'lucide-react'

export default function Login() {
  const { login } = useAuthStore()
  const navigate = useNavigate()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const res = await login(email, password)
    if (res.success) {
      const currentUser = useAuthStore.getState().user
      if (currentUser) {
        if (currentUser.role === 'staff') {
          navigate('/inventory')
        } else if (currentUser.role === 'kasir') {
          navigate('/pos')
        } else {
          navigate('/')
        }
      }
    } else {
      setError(res.error || 'Email atau password salah.')
    }
    setIsLoading(false)
  }

  // Quick Login Handler
  const handleQuickLogin = async (role: UserRole) => {
    setError('')
    setIsLoading(true)
    let emailStr = ''
    const passwordStr = 'password123' // Seeded password for demo accounts

    if (role === 'owner') {
      emailStr = 'owner@mentaimental.com'
    } else if (role === 'kasir') {
      emailStr = 'kasir@mentaimental.com'
    } else if (role === 'staff') {
      emailStr = 'staff@mentaimental.com'
    }

    const res = await login(emailStr, passwordStr)
    if (res.success) {
      if (role === 'staff') {
        navigate('/inventory')
      } else if (role === 'kasir') {
        navigate('/pos')
      } else {
        navigate('/')
      }
    } else {
      setError(res.error || 'Gagal login demo.')
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col items-center justify-center p-4">
      {/* Visual background details */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-[hsl(var(--primary))]/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-48 h-48 bg-[hsl(var(--primary))]/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-md space-y-8 z-10">
        {/* Brand Logo Header */}
        <div className="text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-[hsl(var(--primary))] items-center justify-center text-white shadow-xl shadow-[hsl(var(--primary))/20] mb-4">
            <Flame className="w-8 h-8 fill-current animate-pulse" />
          </div>
          <h2 className="text-3xl font-display font-bold text-[hsl(var(--foreground))] tracking-tight">
            Mentai Mental
          </h2>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))] font-medium font-sans">
            Masuk ke Sistem POS & Manajemen Inventori
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl border border-[hsl(var(--border))] shadow-xl p-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-[hsl(var(--border))] text-sm bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-[hsl(var(--border))] text-sm bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 mt-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-sm py-3 rounded-xl shadow-lg shadow-[hsl(var(--primary))/20] hover:shadow-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? 'Menghubungkan...' : 'Masuk Akun'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Login Section for Demo Approval */}
          <div className="pt-6 border-t border-[hsl(var(--border))]">
            <h3 className="text-xs font-bold text-[hsl(var(--foreground))] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4 text-[hsl(var(--primary))]" />
              Uji Coba Demo Akun (1-Click)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleQuickLogin('owner')}
                className="px-2 py-2 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30 hover:bg-[hsl(var(--accent))] rounded-xl font-sans font-bold text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent-foreground))] transition text-center cursor-pointer"
              >
                Owner<br/>(Reza)
              </button>
              <button
                onClick={() => handleQuickLogin('kasir')}
                className="px-2 py-2 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30 hover:bg-[hsl(var(--accent))] rounded-xl font-sans font-bold text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent-foreground))] transition text-center cursor-pointer"
              >
                Kasir<br/>(Dewi)
              </button>
              <button
                onClick={() => handleQuickLogin('staff')}
                className="px-2 py-2 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/30 hover:bg-[hsl(var(--accent))] rounded-xl font-sans font-bold text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent-foreground))] transition text-center cursor-pointer"
              >
                Staff Dapur<br/>(Budi)
              </button>
            </div>
            
            {/* Guide notes */}
            <div className="mt-4 p-3 bg-[hsl(var(--background))] rounded-xl text-[10px] text-[hsl(var(--muted-foreground))] space-y-1">
              <p>💡 <b>Owner:</b> Akses penuh ke dashboard & resep.</p>
              <p>💡 <b>Kasir:</b> Fokus pada POS & pencatatan pesanan.</p>
              <p>💡 <b>Staff Dapur:</b> Hanya dapat melihat & mengupdate stok.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
