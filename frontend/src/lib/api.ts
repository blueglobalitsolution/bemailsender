const API_BASE = import.meta.env.VITE_API_URL || '';

export function getApiUrl(path: string): string {
  return `${API_BASE}${path}`;
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