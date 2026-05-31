import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  limitOptions?: number[]
}

export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onLimitChange,
  limitOptions = [5, 10, 20, 50]
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1)
  }

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1)
  }

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages = []
    const range = 2 // Number of pages to show before and after current page

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - range && i <= currentPage + range)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }
    return pages
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-white border-t border-[hsl(var(--border))]/60">
      {/* Items per page selector & Info text */}
      <div className="flex flex-wrap items-center gap-3.5 text-xs text-[hsl(var(--muted-foreground))] font-semibold">
        <div className="flex items-center gap-2">
          <span>Tampilkan</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              onLimitChange(Number(e.target.value))
              onPageChange(1) // Reset to page 1 on limit change
            }}
            className="px-2.5 py-1.5 bg-white border border-[hsl(var(--border))] rounded-xl font-bold text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] transition cursor-pointer"
          >
            {limitOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <span>data</span>
        </div>
        <span className="hidden sm:inline-block text-stone-300">|</span>
        <span>
          Menampilkan <span className="text-[hsl(var(--foreground))] font-extrabold">{totalItems > 0 ? startItem : 0}</span>
          {' - '}
          <span className="text-[hsl(var(--foreground))] font-extrabold">{endItem}</span>
          {' dari '}
          <span className="text-[hsl(var(--foreground))] font-extrabold">{totalItems}</span> data
        </span>
      </div>

      {/* Page navigation controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={handlePrev}
          disabled={currentPage === 1}
          className="flex items-center justify-center w-8 h-8 rounded-xl border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-stone-50 transition disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} className="px-2 text-stone-400 font-bold text-xs select-none">
                ...
              </span>
            )
          }

          const isCurrent = currentPage === p
          return (
            <button
              key={`page-${p}`}
              onClick={() => onPageChange(p as number)}
              className={`w-8 h-8 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                isCurrent
                  ? 'bg-[hsl(var(--primary))] text-white shadow-md shadow-[hsl(var(--primary))]/15'
                  : 'border border-[hsl(var(--border))] text-stone-600 hover:bg-stone-50 hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {p}
            </button>
          )
        })}

        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="flex items-center justify-center w-8 h-8 rounded-xl border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-stone-50 transition disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
