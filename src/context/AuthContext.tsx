import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cegah double-call checkAdmin saat mount
  const initialized = useRef(false);

  const checkAdmin = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase.rpc("is_admin", { _user_id: userId });
      return !!data;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    // Inisialisasi awal dari getSession — satu kali saja
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          const adminStatus = await checkAdmin(session.user.id);
          setIsAdmin(adminStatus);
        } else {
          setUser(null);
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Auth init error:", err);
        setUser(null);
        setIsAdmin(false);
      } finally {
        // Selalu set loading false setelah init selesai
        setLoading(false);
        initialized.current = true;
      }
    };

    init();

    // Listener hanya untuk perubahan SETELAH inisialisasi
    // (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Skip event pertama (INITIAL_SESSION) karena sudah ditangani init()
        if (!initialized.current) return;

        if (session?.user) {
          setUser(session.user);
          const adminStatus = await checkAdmin(session.user.id);
          setIsAdmin(adminStatus);
        } else {
          setUser(null);
          setIsAdmin(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);