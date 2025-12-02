import { useState, useCallback, useEffect } from 'react'
import LoginPage from './components/LoginPage'
import Header from './components/Header'
import UserPanel from './components/UserPanel'
import AdminPanel from './components/AdminPanel'
import Toast from './components/Toast'
import { ADMINS } from './lib/supabase'
import { setupErrorLogging } from './lib/api'

export default function App() {
  const [user, setUser] = useState(null)
  const [toast, setToast] = useState(null)

  const isAdmin = user && ADMINS.includes(user)

  // Setup error logging when user logs in
  useEffect(() => {
    setupErrorLogging(user)
  }, [user])

  const showToast = useCallback((message, type) => {
    setToast({ message, type })
  }, [])

  const handleLogout = () => {
    setUser(null)
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} onLogout={handleLogout} />
      
      {isAdmin ? (
        <AdminPanel user={user} showToast={showToast} />
      ) : (
        <UserPanel user={user} showToast={showToast} />
      )}

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  )
}
