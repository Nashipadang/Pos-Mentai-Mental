import { X, AlertTriangle, Info, HelpCircle } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel?: () => void
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Ya, Konfirmasi',
  cancelText = 'Batal',
  type = 'danger',
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null

  // Define icon and button styles based on confirmation type
  const getModalConfig = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-red-600" />,
          iconBg: 'bg-red-50 border border-red-100',
          btnClass: 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/10'
        }
      case 'warning':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-amber-500" />,
          iconBg: 'bg-amber-50 border border-amber-100',
          btnClass: 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/10'
        }
      case 'info':
      default:
        return {
          icon: <Info className="w-8 h-8 text-blue-600" />,
          iconBg: 'bg-blue-50 border border-blue-100',
          btnClass: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/10'
        }
    }
  }

  const config = getModalConfig()

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-200 animate-fade-in">
      {/* Modal Card */}
      <div className="bg-white rounded-3xl max-w-sm w-full border border-[hsl(var(--border))] shadow-2xl p-6 space-y-5 relative origin-center">
        {/* Close Button */}
        <button 
          onClick={onCancel || onConfirm}
          className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon and Body */}
        <div className="flex flex-col items-center text-center space-y-3.5 pt-2">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${config.iconBg}`}>
            {config.icon}
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-bold text-lg text-[hsl(var(--foreground))] leading-tight">
              {title}
            </h3>
            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] font-sans max-w-[280px] mx-auto leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] text-xs font-bold text-[hsl(var(--muted-foreground))] rounded-xl transition cursor-pointer text-center"
            >
              {cancelText}
            </button>
          )}
          
          <button
            type="button"
            onClick={onConfirm}
            className={`py-2.5 text-xs font-bold rounded-xl transition cursor-pointer text-center ${config.btnClass} ${
              onCancel ? 'flex-1' : 'w-full'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
