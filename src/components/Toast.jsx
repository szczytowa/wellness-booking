import { useEffect } from 'react'

export default function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div 
      className={`fixed bottom-8 right-8 px-6 py-4 rounded-xl text-white font-semibold z-50 animate-slide-in shadow-lg ${
        type === 'success' ? 'bg-green-700' : 'bg-red-600'
      }`}
    >
      {message}
    </div>
  )
}
