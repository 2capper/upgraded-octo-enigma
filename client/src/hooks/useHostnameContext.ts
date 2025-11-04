import { useQuery } from '@tanstack/react-query';

interface HostnameContext {
  hostname: string;
  isStorefront: boolean;
  isAdminApp: boolean;
}

export function useHostnameContext() {
  const { data, isLoading } = useQuery<HostnameContext>({
    queryKey: ['/api/context'],
    staleTime: Infinity,
  });

  return {
    hostname: data?.hostname || '',
    isStorefront: data?.isStorefront || false,
    isAdminApp: data?.isAdminApp || true,
    isLoading,
  };
}
