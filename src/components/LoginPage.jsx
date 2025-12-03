import { useState } from 'react'
import { VALID_CODES } from '../lib/supabase'

export default function LoginPage({ onLogin }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const normalizedCode = code.trim().toUpperCase()
    
    if (VALID_CODES.includes(normalizedCode)) {
      onLogin(normalizedCode)
    } else {
      setError('Nieprawidłowy kod. Spróbuj ponownie.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-green-100 via-white to-green-200">
      <div className="bg-white p-12 md:p-16 rounded-3xl shadow-2xl text-center max-w-md w-full border-4 border-green-200">
        {/* Logo Icon */}
        <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-700 rounded-full mx-auto mb-8 flex items-center justify-center text-5xl shadow-lg">
          🌿
        </div>
        
        {/* Title */}
        <h1 className="font-display text-3xl md:text-4xl text-green-800 mb-3">
          Strefa Wellness
        </h1>
        <p className="text-green-600 text-lg mb-10 font-light">
          System rezerwacji
        </p>
        
        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-center font-semibold text-green-800 mb-3 text-sm uppercase tracking-wider">
              Podaj kod
            </label>
            <input
              type="text"
              className="w-full px-6 py-5 text-xl border-4 border-green-200 rounded-2xl text-center font-semibold text-green-800 bg-green-50 focus:outline-none focus:border-green-400 focus:shadow-lg transition-all placeholder:text-green-400 placeholder:font-normal"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                setError('')
              }}
              placeholder="KOD APARTAMENTU"
              autoFocus
            />
          </div>
          
          <button
            type="submit"
            className="w-full py-5 bg-gradient-to-r from-green-500 to-green-700 text-white rounded-2xl text-xl font-bold uppercase tracking-widest hover:-translate-y-1 hover:shadow-xl transition-all active:translate-y-0"
          >
            REZERWUJ
          </button>
        </form>
        
        {/* Error */}
        {error && (
          <div className="mt-6 bg-red-50 text-red-700 px-5 py-4 rounded-xl font-medium border-2 border-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
