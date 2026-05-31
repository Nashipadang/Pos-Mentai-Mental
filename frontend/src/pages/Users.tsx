import { useState, useEffect, useMemo } from 'react'
import { usePOSStore } from '../store/posStore'
import { useAuthStore } from '../store/authStore'
import ConfirmModal from '../components/ui/ConfirmModal'
import CustomSelect from '../components/ui/CustomSelect'
import { 
  UserCog, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  X, 
  Lock, 
  Mail, 
  User, 
  Shield, 
  Store, 
  Warehouse, 
  Fingerprint,
  UserCheck,
  UserX
} from 'lucide-react'

export default function Users() {
  const { users, fetchUsers, addUser, updateUser, deleteUser } = usePOSStore()
  const currentUser = useAuthStore((state) => state.user)

  // State
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'pribadi' | 'kasir' | 'staff'>('all')
  const [showUserModal, setShowUserModal] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [userToDeleteId, setUserToDeleteId] = useState<string | null>(null)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  // User Form State
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<'owner' | 'kasir' | 'staff'>('kasir')
  const [formIsActive, setFormIsActive] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers()
  }, [])

  // Filter users based on active tab and search query
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Tab filter
      if (activeTab === 'pribadi' && u.id !== currentUser?.id) return false
      if (activeTab === 'kasir' && u.role !== 'kasir') return false
      if (activeTab === 'staff' && u.role !== 'staff') return false

      // Search filter
      const searchLower = search.toLowerCase()
      const matchesName = u.name.toLowerCase().includes(searchLower)
      const matchesEmail = u.email.toLowerCase().includes(searchLower)
      return matchesName || matchesEmail
    })
  }, [users, activeTab, search, currentUser])

  // Handlers
  const openAddModal = () => {
    setEditingUserId(null)
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole('kasir')
    setFormIsActive(true)
    setErrorMsg('')
    setShowUserModal(true)
  }

  const openEditModal = (u: any) => {
    setEditingUserId(u.id)
    setFormName(u.name)
    setFormEmail(u.email)
    setFormPassword('') // Reset password input field
    setFormRole(u.role)
    setFormIsActive(u.is_active)
    setErrorMsg('')
    setShowUserModal(true)
  }

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!formName || !formEmail) {
      setErrorMsg('Nama dan email wajib diisi.')
      return
    }

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formEmail)) {
      setErrorMsg('Format email tidak valid.')
      return
    }

    // Password validation for new users
    if (!editingUserId && (!formPassword || formPassword.length < 6)) {
      setErrorMsg('Kata sandi wajib diisi dan minimal terdiri dari 6 karakter.')
      return
    }

    // Password validation for edited users if non-empty
    if (editingUserId && formPassword && formPassword.length < 6) {
      setErrorMsg('Kata sandi baru minimal terdiri dari 6 karakter.')
      return
    }

    try {
      if (editingUserId) {
        // Prepare updates
        const updates: any = {
          name: formName,
          email: formEmail,
          role: formRole,
          is_active: formIsActive
        }
        if (formPassword) {
          updates.password = formPassword
        }
        await updateUser(editingUserId, updates)
      } else {
        await addUser({
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
          is_active: formIsActive
        })
      }
      setShowUserModal(false)
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Gagal menyimpan akun pengguna'
      setErrorMsg(msg)
    }
  }

  const handleToggleActiveStatus = async (id: string, currentStatus: boolean) => {
    // Prevent self deactivation
    if (id === currentUser?.id) return

    try {
      await updateUser(id, {
        is_active: !currentStatus
      } as any)
    } catch (err) {
      console.error("Gagal mengubah status aktif:", err)
    }
  }

  const openDeleteConfirm = (id: string) => {
    if (id === currentUser?.id) return
    setUserToDeleteId(id)
    setConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!userToDeleteId) return
    try {
      await deleteUser(userToDeleteId)
    } catch (err) {
      console.error("Gagal menghapus pengguna:", err)
    }
    setConfirmOpen(false)
    setUserToDeleteId(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-[hsl(var(--foreground))] tracking-tight">
            Kelola Akun Karyawan
          </h2>
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] font-sans">
            Atur kredensial dan hak akses akun Pemilik (Owner), Kasir, dan Staf Gudang
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-xs rounded-2xl transition shadow-lg shadow-[hsl(var(--primary))/15] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Tambah Akun Baru
        </button>
      </div>

      {/* Navigation tabs & Search bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-[hsl(var(--border))] shadow-xs">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            Semua Akun
          </button>
          
          <button
            onClick={() => setActiveTab('pribadi')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pribadi'
                ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            Akun Pribadi
          </button>

          <button
            onClick={() => setActiveTab('kasir')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'kasir'
                ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            Kasir
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'staff'
                ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" />
            Staf Gudang
          </button>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Cari nama atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[hsl(var(--border))] rounded-2xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] transition"
          />
        </div>
      </div>

      {/* Grid of Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredUsers.map((u) => {
          const isSelf = u.id === currentUser?.id
          
          return (
            <div 
              key={u.id} 
              className={`bg-white rounded-3xl border p-6 flex flex-col justify-between hover-card-lift transition duration-200 ${
                isSelf 
                  ? 'border-[hsl(var(--primary))]/30 shadow-md shadow-[hsl(var(--primary))]/2' 
                  : 'border-[hsl(var(--border))] shadow-xs'
              }`}
            >
              <div className="space-y-4">
                {/* Badges row */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {u.role === 'owner' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border border-[hsl(var(--primary))]/10">
                        <Shield className="w-3 h-3" />
                        Owner / Pemilik
                      </span>
                    )}
                    {u.role === 'kasir' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <Store className="w-3 h-3" />
                        Kasir POS
                      </span>
                    )}
                    {u.role === 'staff' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        <Warehouse className="w-3 h-3" />
                        Staf Gudang
                      </span>
                    )}
                    
                    {isSelf && (
                      <span className="inline-flex items-center text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200">
                        Anda
                      </span>
                    )}
                  </div>

                  {/* Active/Inactive badge */}
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    u.is_active 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'bg-red-50 text-red-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    {u.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>

                {/* Profile Info */}
                <div className="space-y-1.5">
                  <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] leading-tight flex items-center gap-1.5">
                    <User className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    {u.name}
                  </h3>
                  <p className="font-sans font-semibold text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-stone-400" />
                    {u.email}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-[hsl(var(--border))]/50 flex items-center justify-between gap-3">
                {/* Active Toggle Switch */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActiveStatus(u.id, u.is_active)}
                    disabled={isSelf}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition duration-150 ${
                      isSelf 
                        ? 'opacity-40 cursor-not-allowed bg-stone-50 border-stone-200 text-stone-400' 
                        : u.is_active
                        ? 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100/70 cursor-pointer'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100/70 cursor-pointer'
                    }`}
                  >
                    {u.is_active ? (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        Nonaktifkan
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        Aktifkan
                      </>
                    )}
                  </button>
                </div>

                {/* Edit & Delete */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(u)}
                    className="p-2 border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] text-[hsl(var(--muted-foreground))] rounded-xl transition cursor-pointer"
                    title="Ubah detail akun"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => openDeleteConfirm(u.id)}
                    disabled={isSelf}
                    className={`p-2 border rounded-xl transition ${
                      isSelf 
                        ? 'opacity-40 cursor-not-allowed border-stone-200 text-stone-300 bg-stone-50' 
                        : 'border-red-100 bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer'
                    }`}
                    title={isSelf ? "Anda tidak dapat menghapus akun sendiri" : "Hapus akun permanen"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {filteredUsers.length === 0 && (
          <div className="col-span-full py-16 text-center text-stone-400 font-sans font-bold text-xs space-y-2 bg-white rounded-3xl border border-dashed border-[hsl(var(--border))]">
            <UserCog className="w-12 h-12 mx-auto text-stone-300 stroke-[1.5]" />
            <p>Tidak ada akun karyawan yang sesuai dengan filter pencarian.</p>
          </div>
        )}
      </div>

      {/* ── MODAL: Tambah/Edit User ───────────────────────────────── */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[hsl(var(--border))] shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-[hsl(var(--border))]">
              <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] flex items-center gap-2">
                <UserCog className="w-5 h-5 text-[hsl(var(--primary))]" />
                {editingUserId ? 'Ubah Detail Akun' : 'Tambah Akun Karyawan Baru'}
              </h3>
              <button 
                onClick={() => setShowUserModal(false)}
                className="p-1 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold p-3 rounded-xl uppercase tracking-wide">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleUserSubmit} className="space-y-4 text-xs font-bold text-[hsl(var(--muted-foreground))] font-sans uppercase tracking-wider">
              {/* Nama Lengkap */}
              <div className="space-y-1.5">
                <label>Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Nakul Cashier / Joko Gudang"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-normal"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label>Alamat Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                  <input
                    type="email"
                    required
                    placeholder="Contoh: nakul.kasir@mentaimental.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-normal"
                  />
                </div>
              </div>

              {/* Role & IsActive */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label>Hak Akses / Peran</label>
                  <CustomSelect
                    value={formRole}
                    onChange={(val) => setFormRole(val)}
                    options={[
                      { value: 'owner', label: 'Owner / Pemilik' },
                      { value: 'kasir', label: 'Kasir POS' },
                      { value: 'staff', label: 'Staf Gudang' }
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label>Status Akun</label>
                  <CustomSelect
                    value={formIsActive ? 'aktif' : 'nonaktif'}
                    onChange={(val) => setFormIsActive(val === 'aktif')}
                    options={[
                      { value: 'aktif', label: 'Aktif' },
                      { value: 'nonaktif', label: 'Nonaktif' }
                    ]}
                    // Prevent self deactivation
                    className={editingUserId === currentUser?.id ? 'pointer-events-none opacity-60' : ''}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label>{editingUserId ? 'Kata Sandi Baru' : 'Kata Sandi'}</label>
                  {editingUserId && (
                    <span className="text-[9px] font-extrabold text-[hsl(var(--muted-foreground))] lowercase normal-case">
                      (kosongkan jika tidak ingin diubah)
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                  <input
                    type="password"
                    placeholder={editingUserId ? "Minimal 6 karakter" : "Masukkan kata sandi"}
                    required={!editingUserId}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--background))]/30 text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-sans font-bold text-sm py-3 rounded-xl shadow-lg transition cursor-pointer text-center"
              >
                {editingUserId ? 'Simpan Perubahan' : 'Registrasi Akun'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Delete Confirm ────────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmOpen}
        title="Hapus Akun Karyawan?"
        message="Apakah Anda yakin ingin menghapus akun ini? Akun tersebut tidak akan dapat digunakan untuk masuk ke sistem lagi. Tindakan ini tidak dapat dibatalkan."
        confirmText="Ya, Hapus Akun"
        cancelText="Batal"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setConfirmOpen(false)
          setUserToDeleteId(null)
        }}
      />
    </div>
  )
}
