import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { 
  LayoutDashboard, 
  ShoppingCart, 
  UtensilsCrossed, 
  Package, 
  Users, 
  LogOut, 
  Menu, 
  X,
  Flame,
  Receipt,
  UserCog,
  Tags,
  BarChart3,
  Sliders
} from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Define links based on roles
  const allLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner'] },
    { to: '/pos', label: 'Kasir POS', icon: ShoppingCart, roles: ['owner', 'kasir'] },
    { to: '/transactions', label: 'Transaksi', icon: Receipt, roles: ['owner', 'kasir'] },
    { to: '/products', label: 'Menu & Resep', icon: UtensilsCrossed, roles: ['owner'] },
    { to: '/categories', label: 'Kategori Menu', icon: Tags, roles: ['owner'] },
    { to: '/inventory', label: 'Bahan Baku', icon: Package, roles: ['owner', 'staff'] },
    { to: '/customers', label: 'Pelanggan', icon: Users, roles: ['owner', 'kasir'] },
    { to: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['owner'] },
    { to: '/settings', label: 'Pengaturan', icon: Sliders, roles: ['owner'] },
  ]

  const allowedLinks = allLinks.filter(link => link.roles.includes(user.role))

  const toggleSidebar = () => setIsOpen(!isOpen)

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-white border-b border-[hsl(var(--border))] sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center text-white">
            <Flame className="w-5 h-5 fill-current animate-pulse" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-[hsl(var(--foreground))]">
            Mentai Mental
          </span>
        </div>
        
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
          aria-label="Toggle navigation"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-45"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-white border-r border-[hsl(var(--border))] z-50 flex flex-col justify-between
        transform lg:transform-none transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Top Header */}
        <div>
          <div className="p-6 border-b border-[hsl(var(--border))] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center text-white shadow-lg shadow-[hsl(var(--primary))/20]">
              <Flame className="w-6 h-6 fill-current animate-pulse" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-tight tracking-tight text-[hsl(var(--foreground))]">
                Mentai Mental
              </h1>
              <p className="text-[11px] font-medium tracking-wider text-[hsl(var(--muted-foreground))] uppercase">
                Point of Sale
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {allowedLinks.map((link) => {
              const Icon = link.icon
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3.5 px-4 py-3 rounded-xl font-sans font-semibold text-sm transition-all duration-200
                    ${isActive 
                      ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-sm border border-[hsl(var(--primary))/10]' 
                      : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {link.label}
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/50 m-2 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 flex items-center justify-center font-bold text-[hsl(var(--primary))] font-display">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-sans font-bold text-sm text-[hsl(var(--foreground))] truncate leading-tight">
                {user.name}
              </p>
              <span className="inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-extrabold uppercase tracking-wide bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                {user.role}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--destructive))]/5 hover:border-[hsl(var(--destructive))]/20 hover:text-[hsl(var(--destructive))] font-sans font-bold text-xs text-[hsl(var(--muted-foreground))] transition-all"
          >
            <LogOut className="w-4 h-4" />
            Keluar Sistem
          </button>
        </div>
      </aside>
    </>
  )
}
