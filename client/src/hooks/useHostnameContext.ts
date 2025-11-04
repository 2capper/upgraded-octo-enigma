import { useQuery } from '@tanstack/react-query';

interface HostnameContext {
  hostname: string;
  isStorefront: boolean;
  isAdminApp: boolean;
}

export function useHostnameContext() {
  const { data, isLoading, isError } = useQuery<HostnameContext>({
    queryKey: ['/api/context'],
    staleTime: Infinity,
    retry: 3,
  });

  // On error, use client-side hostname detection as fallback
  const fallbackIsStorefront = typeof window !== 'undefined' 
    ? window.location.hostname.startsWith('www.') || window.location.hostname === 'dugoutdesk.ca'
    : false;

  return {
    hostname: data?.hostname || (typeof window !== 'undefined' ? window.location.hostname : ''),
    isStorefront: isError ? fallbackIsStorefront : (data?.isStorefront || false),
    isAdminApp: isError ? !fallbackIsStorefront : (data?.isAdminApp || true),
    isLoading,
    isError,
  };
}
