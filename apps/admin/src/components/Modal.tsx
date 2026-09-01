'use client'

export function Modal({
  title, open, onClose, children, size = 'md',
}: {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
  size?: 'md' | 'full'
}) {
  if (!open) return null
  const isFull = size === 'full'
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 ${isFull ? 'p-2 sm:p-4' : 'p-4'}`}>
      <div className={`card flex w-full flex-col p-6 ${isFull ? 'h-full max-w-none sm:h-[95vh] sm:max-w-6xl' : 'max-w-lg'}`}>
        <div className="mb-5 flex shrink-0 items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={isFull ? 'flex-1 overflow-y-auto pr-1' : ''}>
          {children}
        </div>
      </div>
    </div>
  )
}
