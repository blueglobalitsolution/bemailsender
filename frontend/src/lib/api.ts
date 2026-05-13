const API_BASE = import.meta.env.VITE_API_URL || '';
const WHATSAPP_BASE = import.meta.env.VITE_WHATSAPP_SERVICE_URL || '/whatsapp/';

export function getApiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function getWhatsAppUrl(path: string): string {
  return `${WHATSAPP_BASE}${path}`;
}

export const apiFetch = async (path: string, options?: RequestInit) => {
  const url = getApiUrl(path);
  let token = localStorage.getItem("access_token");

  const isFormData = options?.body instanceof FormData;
  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...options?.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  let response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  // If unauthorized, try to refresh the token automatically using the refresh_token cookie
  if (response.status === 401 && !path.includes("/refresh-token/")) {
    try {
      const refreshResponse = await fetch(getApiUrl("/api/auth/refresh-token/"), {
        method: "POST",
        credentials: "include",
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        token = data.access;
        localStorage.setItem("access_token", token);

        // Retry the original request with the new token
        const retryHeaders = {
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          ...options?.headers,
          "Authorization": `Bearer ${token}`,
        };
        response = await fetch(url, {
          ...options,
          headers: retryHeaders,
          credentials: "include",
        });
      }
    } catch (e) {
      console.error("Token refresh failed:", e);
    }
  }

  return response;
};

export const whatsappFetch = async (path: string, options?: RequestInit) => {
  const url = new URL(getWhatsAppUrl(path));
  const token = localStorage.getItem('access_token');

  const headers: HeadersInit = {
    ...options?.headers,
    'Content-Type': 'application/json',
    'x-api-key': import.meta.env.VITE_WHATSAPP_API_KEY || 'whatsapp-secret-key-change-in-production'
  };

  if (token) {
    try {
      // Decode JWT to get userId with padding safety
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4;
      const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
      const payload = JSON.parse(atob(padded));
      const userId = payload.user_id || payload.id;

      if (userId) {
        if (options?.method === 'POST') {
          const body = JSON.parse((options?.body as string) || '{}');
          body.userId = userId;
          options.body = JSON.stringify(body);
        } else {
          url.searchParams.append('userId', userId.toString());
        }
      }
    } catch (e) {
      console.error("Error decoding token for WhatsApp service", e);
    }
  }

  return fetch(url.toString(), { ...options, headers });
};