import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

type AuthState = {
  authenticated: boolean;
  userId?: number;
  isAdmin?: boolean;
};

export function useAuth() {
  const { data: authState, isLoading } = useQuery<AuthState>({
    queryKey: ["/api/auth/check"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/check"] });
    window.location.href = "/";
  };

  return {
    isAuthenticated: authState?.authenticated || false,
    isAdmin: authState?.isAdmin || false,
    userId: authState?.userId,
    isLoading,
    logout,
  };
}