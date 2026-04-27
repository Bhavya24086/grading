import { createContext, useContext } from "react";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "teacher" | "student";

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);
