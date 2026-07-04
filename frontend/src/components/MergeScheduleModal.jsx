import { createPortal } from 'react-dom'

export default function MergeScheduleModal({ isOpen, onSave, onDiscard }) {
  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-navy-900/80">
      <div className="card w-full max-w-sm p-6 flex flex-col gap-5">
        <div>
          <h2 className="font-serif text-xl text-parchment mb-2">Save Your Schedule?</h2>
          <p className="text-sm text-parchment-muted leading-relaxed">
            We found a schedule you were building. Would you like to save it to your
            account so you can access it anywhere?
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onSave}
            className="w-full px-5 py-3 rounded-lg bg-gold text-navy-900 text-sm font-bold
                       hover:bg-gold-light shadow-[0_0_20px_rgba(201,150,58,0.25)]
                       transition-all duration-150"
          >
            Save It
          </button>
          <button
            onClick={onDiscard}
            className="w-full px-5 py-3 rounded-lg border border-navy-400 text-parchment-muted
                       text-sm hover:border-navy-300 hover:text-parchment transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
