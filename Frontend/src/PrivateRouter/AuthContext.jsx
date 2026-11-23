import React, { createContext, useContext, useEffect, useState } from "react";

export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      if (typeof parsedUser.user_id === "string" && Number.isSafeInteger(Number(parsedUser.id))) {
        setUser(parsedUser);
      } else {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }

    setLoading(false);
  }, []);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  // Map user data for Header/Sidebar compatibility
  const profileName = user?.username || user?.name || "Admin";
  const role = user?.role || "admin";
  const email = user?.email || "";
  const phone = user?.phone || "";

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        login,
        logout,
        loading,
        loginOpen,
        setLoginOpen,
        profileName,
        role,
        email,
        phone
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};