import React, { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Restore from localStorage on page load
    try {
      const saved = localStorage.getItem('user')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setLoading(false)
      return
    }
    // Validate token is still good
    getMe()
      .then((res) => {
        setUser(res.data)
        localStorage.setItem('user', JSON.stringify(res.data))
      })
      .catch(() => {
        setUser(null)
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
      })
      .finally(() => setLoading(false))
  }, [])

  const setAuth = (token, userInfo) => {
    localStorage.setItem('access_token', token)
    localStorage.setItem('user', JSON.stringify(userInfo))
    setUser(userInfo)
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
