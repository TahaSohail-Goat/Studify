// ── AuthContext ──────────────────────────────────────────────────────────────
// "Context" lets any component read the logged-in user / token without passing
// props through every level. Think of it as app-wide shared state.

import { createContext, useContext, useEffect, useState } from "react";
import { loginApi, getMeApi } from "../api/auth.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // We keep the token in React state AND in localStorage so a page refresh
  // doesn't log the user out. We initialise from localStorage on first load.
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until we've checked the token

  // When we have a token (e.g. after a refresh), fetch the user it belongs to.
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getMeApi(token)
      .then((u) => setUser(u))
      .catch(() => {
        // Token is invalid/expired — clear it.
        localStorage.removeItem("token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Log in, then save the token everywhere.
  async function login(email, password) {
    const data = await loginApi(email, password); // { token, user }
    localStorage.setItem("token", data.token);
    setToken(data.token);
    setUser(data.user);
  }

  // Called by the OTP verify step once the backend confirms identity.
  function setSession(newToken, newUser) {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
  }

  function updateUser(updatedUser) {
    setUser(updatedUser);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  const value = { token, user, loading, login, setSession, updateUser, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// A handy shortcut so components can just call useAuth().
export function useAuth() {
  return useContext(AuthContext);
}
