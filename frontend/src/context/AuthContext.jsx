import React, { createContext, useContext, useState, useEffect } from "react";
import { API_BASE } from "../config/api.config";

const AuthContext = createContext(null);

const DEMO_PRESETS = {
  operator: {
    username: "operator",
    password: "operator123",
    full_name: "Hamza Alami",
    role: "Plant Operator",
  },
  engineer: {
    username: "engineer",
    password: "engineer123",
    full_name: "Dr. Sarah Benali",
    role: "Process Engineer",
  },
  admin: {
    username: "admin",
    password: "admin123",
    full_name: "Prof. Zakaria K.",
    role: "Plant Director",
  },
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("twin_auth_token") || null);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("twin_auth_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Validate existing token on mount
  useEffect(() => {
    if (token && !user) {
      fetchUserProfile(token);
    }
  }, [token]);

  const fetchUserProfile = async (authToken) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem("twin_auth_user", JSON.stringify(userData));
      }
    } catch (err) {
      console.warn("Backend auth validation check skipped:", err.message);
    }
  };

  const login = async (username, password) => {
    setLoading(true);
    setAuthError(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Try Backend FastAPI Authentication
    try {
      let response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUser, password: cleanPass }),
      });

      if (!response.ok && response.status === 404) {
        response = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: cleanUser, password: cleanPass }),
        });
      }

      if (response.ok) {
        const data = await response.json();
        const authToken = data.access_token;
        const userInfo = {
          username: data.username,
          full_name: data.full_name,
          role: data.role,
          organization: "JESA / OCP Group",
          institution: "ENSEM Casablanca",
        };

        setToken(authToken);
        setUser(userInfo);
        localStorage.setItem("twin_auth_token", authToken);
        localStorage.setItem("twin_auth_user", JSON.stringify(userInfo));

        setLoading(false);
        return { success: true };
      }

      // If backend responded with 401
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Incorrect username or password.");
      }
    } catch (err) {
      // If it's a 401 error, propagate it
      if (err.message === "Incorrect username or password.") {
        setLoading(false);
        setAuthError(err.message);
        return { success: false, error: err.message };
      }

      // 2. Offline / Server Unreachable Fallback for Demo Accounts
      console.warn("Backend unreachable; falling back to demo authentication mode.");
      const demoAccount = DEMO_PRESETS[cleanUser];

      if (demoAccount && demoAccount.password === cleanPass) {
        const fakeToken = `demo_token_${cleanUser}_${Date.now()}`;
        const userInfo = {
          username: demoAccount.username,
          full_name: demoAccount.full_name,
          role: demoAccount.role,
          organization: "JESA / OCP Group",
          institution: "ENSEM Casablanca",
        };

        setToken(fakeToken);
        setUser(userInfo);
        localStorage.setItem("twin_auth_token", fakeToken);
        localStorage.setItem("twin_auth_user", JSON.stringify(userInfo));

        setLoading(false);
        return { success: true };
      }
    }

    // 3. Fallthrough invalid credentials
    const errorMsg = "Invalid username or password. Try quick select demo buttons.";
    setLoading(false);
    setAuthError(errorMsg);
    return { success: false, error: errorMsg };
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("twin_auth_token");
    localStorage.removeItem("twin_auth_user");
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        loading,
        authError,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
