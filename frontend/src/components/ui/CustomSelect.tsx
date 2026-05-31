import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface Option {
  value: string | number
  label: string
}

interface CustomSelectProps {
  options: Option[]
  value: string | number
  onChange: (value: any) => void
  placeholder?: string
  className?: string
  icon?: React.ReactNode
}

export default function CustomSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Pilih...', 
  className = '',
  icon
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => String(o.value) === String(value))

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between pl-4 pr-3.5 py-2.5 bg-white border border-[hsl(var(--border))] rounded-2xl text-xs font-semibold text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))]/30 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] transition shadow-sm cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 truncate">
          {icon}
          <span className={selectedOption ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-[hsl(var(--border))] rounded-2xl shadow-xl max-h-60 overflow-y-auto font-sans py-1.5 animate-fade-in origin-top">
          {options.length === 0 ? (
            <div className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))] font-semibold">
              Tidak ada pilihan tersedia
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] ${
                  String(option.value) === String(value) 
                    ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]' 
                    : 'text-[hsl(var(--foreground))]'
                }`}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
