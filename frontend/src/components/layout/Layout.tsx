import { useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { usePOSStore } from '../../store/posStore'
import Navbar from './Navbar'

export default function Layout() {
  const { isAuthenticated } = useAuthStore()
  const { fetchInitialData } = usePOSStore()

  useEffect(() => {
    if (isAuthenticated) {
      fetchInitialData()
    }
  }, [isAuthenticated, fetchInitialData])

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col lg:flex-row">
      <Navbar />
      
      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <div className="flex-grow p-4 md:p-6 w-full space-y-6">
          <Outlet />
        </div>
        
        {/* Subtle footer */}
        <footer className="py-6 text-center text-xs font-semibold text-[hsl(var(--muted-foreground))] border-t border-[hsl(var(--border))]/40">
          © {new Date().getFullYear()} Mentai Mental POS. Handcrafted with Care.
        </footer>
      </main>
    </div>
  )
}
