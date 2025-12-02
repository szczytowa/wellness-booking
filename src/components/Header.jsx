import { ADMINS } from '../lib/supabase'

export default function Header({ user, onLogout }) {
  const isAdmin = ADMINS.includes(user)

  return (
    <header className="bg-gradient-to-r from-white to-green-100 px-6 md:px-10 py-5 shadow-lg border-b-4 border-green-400 flex flex-col md:flex-row justify-between items-center gap-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-700 rounded-full flex items-center justify-center text-2xl shadow-md">
          🌿
        </div>
        <span className="font-display text-2xl font-bold text-green-800">
          Strefa Wellness
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <span className="bg-white px-5 py-2 rounded-full font-semibold text-green-800 border-2 border-green-400">
          {isAdmin ? '👑 ' : '🏠 '}{user}
        </span>
        <button
          className="bg-white text-green-800 border-2 border-green-400 px-6 py-2 rounded-full font-semibold hover:bg-green-400 hover:text-white transition-all"
          onClick={onLogout}
        >
          Wyloguj
        </button>
      </div>
    </header>
  )
}
