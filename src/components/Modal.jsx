export default function Modal({ 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Potwierdź', 
  cancelText = 'Anuluj',
  loading = false 
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-2xl animate-fade-in">
        <h3 className="font-display text-2xl text-green-800 mb-4">{title}</h3>
        <p className="text-green-600 mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-4 justify-center">
          <button
            className="px-8 py-3 rounded-xl font-semibold border-2 border-green-200 text-green-800 hover:bg-green-50 transition-all disabled:opacity-50"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-green-700 text-white hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center gap-2"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <div className="loader w-4 h-4 border-2"></div>}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
