'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  name: string;
  email: string;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  signinRedirect: () => void;
  signoutRedirect: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  function signinRedirect() {
    // Placeholder: sem Keycloak ainda, só simula um login local.
    // Quando integrar o Keycloak (react-oidc-context), troque a implementação
    // deste arquivo mantendo o mesmo formato de retorno do useAuth().
    setUser({ name: 'Usuário de teste', email: 'teste@exemplo.com' });
    setIsAuthenticated(true);
    router.push('/Home');
  }

  function signoutRedirect() {
    setUser(null);
    setIsAuthenticated(false);
    router.push('/Login');
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading: false, user, signinRedirect, signoutRedirect }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider');
  }
  return context;
}