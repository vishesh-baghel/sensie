import type { SWRConfiguration } from 'swr';

/**
 * SWR fetcher function that handles authentication and errors
 */
export const fetcher = async (url: string) => {
  const res = await fetch(url);

  // Handle auth redirect
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error: any = new Error('An error occurred while fetching the data.');
    try {
      error.info = await res.json();
    } catch {
      error.info = { message: 'Failed to fetch' };
    }
    error.status = res.status;
    throw error;
  }

  return res.json();
};

/**
 * Default SWR configuration for the application
 */
export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000, // Dedupe requests within 2 seconds
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  shouldRetryOnError: (error) => {
    // Don't retry on 4xx errors (client errors)
    if (error?.status && error.status >= 400 && error.status < 500) {
      return false;
    }
    return true;
  },
};
