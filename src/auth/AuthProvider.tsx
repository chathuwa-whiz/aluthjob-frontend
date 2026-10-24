import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { setUnauthenticatedHandler } from "../api/client";
import { auth } from "../api/endpoints";
import { keys, useMe } from "../api/queries";
import type { User } from "../api/types";

interface AuthState {
  /** null when nobody is signed in; undefined never, once loading has finished */
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  /** Re-reads the account, e.g. after the person says they confirmed their email */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useMe();

  // Everything cached belongs to whoever was signed in, so it is dropped whenever the session ends
  const forget = useCallback(() => {
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
    queryClient.setQueryData(keys.me, null);
  }, [queryClient]);

  // Any request answered 401 (expired or revoked session) signs the person out of the screen too
  useEffect(() => {
    setUnauthenticatedHandler(forget);
    return () => setUnauthenticatedHandler(undefined);
  }, [forget]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { user } = await auth.login(email, password);
      forget();
      queryClient.setQueryData(keys.me, user);
      return user;
    },
    [forget, queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await auth.logout();
    } finally {
      forget();
    }
  }, [forget]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: keys.me });
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({ user: me.data ?? null, loading: me.isPending, signIn, signOut, refresh }),
    [me.data, me.isPending, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
