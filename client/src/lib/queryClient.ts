import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";

export const API_BASE_URL: string =
  // Prefer Vite client env if provided
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  // Fallback to empty string to use same-origin relative paths
  "";

// Helper to get auth headers
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();

  console.log('Frontend session check:', {
    hasSession: !!session,
    hasAccessToken: !!session?.access_token,
    tokenLength: session?.access_token?.length || 0
  });

  const headers: Record<string, string> = {};

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
    console.log('Adding auth header with token:', session.access_token.substring(0, 20) + '...');
  } else {
    console.log('No session or access token found');
  }

  return headers;
}

interface ApiError extends Error {
  status: number;
  statusText: string;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage: string;
    try {
      const errorData = await res.json();
      errorMessage = errorData.message || errorData.error || res.statusText;
    } catch {
      errorMessage = (await res.text()) || res.statusText;
    }

    const error = new Error(`${res.status}: ${errorMessage}`) as ApiError;
    error.status = res.status;
    error.statusText = res.statusText;
    throw error;
  }
}

function createFetchWithTimeout(timeoutMs: number = 10000) {
  return async (url: string, options?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      throw error;
    }
  };
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  timeoutMs: number = 10000,
): Promise<Response> {
  const fullUrl = API_BASE_URL ? `${API_BASE_URL}${url}` : url;
  const fetchWithTimeout = createFetchWithTimeout(timeoutMs);

  // Get auth headers (includes Supabase token)
  const authHeaders = await getAuthHeaders();

  console.log('API Request:', {
    method,
    url: fullUrl,
    hasAuthHeaders: Object.keys(authHeaders).length > 0,
    authHeaders: Object.keys(authHeaders)
  });

  const headers = {
    ...authHeaders,
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  try {
    const res = await fetchWithTimeout(fullUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error: any) {
    // Add more context to network errors
    if (error.message.includes('timeout')) {
      throw new Error(`Request timeout: Unable to connect to server after ${timeoutMs}ms`);
    }
    if (error.message.includes('Failed to fetch') || error.name === 'NetworkError') {
      throw new Error('Network error: Please check your internet connection and try again');
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
  timeout?: number;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior, timeout = 10000 }) =>
  async ({ queryKey }) => {
    const relativePath = queryKey.join("/") as string;
    const fullUrl = API_BASE_URL ? `${API_BASE_URL}${relativePath}` : relativePath;
    const fetchWithTimeout = createFetchWithTimeout(timeout);
    
    try {
      const res = await fetchWithTimeout(fullUrl, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error: any) {
      // Add more context to network errors
      if (error.message.includes('timeout')) {
        throw new Error(`Request timeout: Unable to connect to server after ${timeout}ms`);
      }
      if (error.message.includes('Failed to fetch') || error.name === 'NetworkError') {
        throw new Error('Network error: Please check your internet connection and try again');
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw", timeout: 10000 }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors or client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          return false;
        }
        // Retry network errors and server errors up to 2 times
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry auth operations
        if (error.status === 401 || error.status === 403) {
          return false;
        }
        // Don't retry client errors
        if (error.status >= 400 && error.status < 500) {
          return false;
        }
        // Retry network errors once
        return failureCount < 1;
      },
      retryDelay: 1000,
    },
  },
});
