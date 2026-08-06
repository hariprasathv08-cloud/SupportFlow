import { getApiUrl } from "../hooks/useBackendStatus";
const API_URL = getApiUrl();

interface RequestOptions extends RequestInit {
  timeout?: number;
}

class ApiClient {
  private getHeaders(contentType: string | null = "application/json"): Headers {
    const headers = new Headers();
    if (contentType) {
      headers.append("Content-Type", contentType);
    }
    const token = localStorage.getItem("token");
    if (token) {
      headers.append("Authorization", `Bearer ${token}`);
    }
    return headers;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const isGet = !options.method || options.method.toUpperCase() === "GET";
    const cacheKey = `api_cache:${path}`;
    const url = `${API_URL}${path}`;
    const contentType = options.body instanceof FormData ? null : "application/json";
    
    const headers = this.getHeaders(contentType);
    if (options.headers) {
      (options.headers as any).forEach((value: string, key: string) => {
        headers.append(key, value);
      });
    }

    const { timeout, ...fetchOptions } = options;

    // Failsafe timeout logic to fail fast instead of hanging indefinitely
    const controller = new AbortController();
    const timeoutMs = timeout ?? 5000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          const refreshToken = localStorage.getItem("refresh_token");
          if (refreshToken) {
            try {
              const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken })
              });
              if (refreshRes.ok) {
                const refreshData = await refreshRes.json();
                localStorage.setItem("token", refreshData.access_token);
                localStorage.setItem("refresh_token", refreshData.refresh_token);
                
                const retryHeaders = this.getHeaders(contentType);
                if (options.headers) {
                  (options.headers as any).forEach((value: string, key: string) => {
                    retryHeaders.append(key, value);
                  });
                }
                
                const retryResponse = await fetch(url, {
                  ...fetchOptions,
                  headers: retryHeaders,
                  signal: options.signal
                });
                
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  return retryData as T;
                }
              }
            } catch (err) {
              console.error("Auto token refresh failed:", err);
            }
          }
          
          localStorage.removeItem("token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("role");
          localStorage.removeItem("user_name");
          window.location.href = "/login";
        }
        
        // Serve from cache if available for GET requests, even on HTTP errors
        if (isGet) {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            console.warn(`[API CACHE] Serving cached data offline for failed GET: ${path}`);
            window.dispatchEvent(new CustomEvent("backend-offline"));
            return JSON.parse(cached) as T;
          }
        }

        const errText = await response.text();
        let message = "An error occurred";
        try {
          const errJson = JSON.parse(errText);
          message = errJson.detail || message;
        } catch {
          message = errText || message;
        }
        throw new Error(message);
      }

      // Successful request indicates the backend is online
      window.dispatchEvent(new CustomEvent("backend-online"));

      if (response.status === 204) {
        return null as unknown as T;
      }

      const data = await response.json();
      
      // Cache successful GET response
      if (isGet && data) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e) {
          console.error("[API CACHE] Failed to write cache to localStorage:", e);
        }
      }

      return data as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      // Attempt to serve from cache for GET requests on network failures
      if (isGet) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          console.warn(`[API CACHE] Serving cached data offline for: ${path}`);
          window.dispatchEvent(new CustomEvent("backend-offline"));
          return JSON.parse(cached) as T;
        }
      }

      if (err.name === "AbortError") {
        window.dispatchEvent(new CustomEvent("backend-offline"));
        throw new Error("Connection timed out. SupportFlow server is currently offline or unreachable.");
      }
      if (err instanceof TypeError || (err.message && err.message.toLowerCase().includes("fetch"))) {
        window.dispatchEvent(new CustomEvent("backend-offline"));
      }
      throw err;
    }
  }

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  put<T>(path: string, body: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  getDevices(): Promise<any[]> {
    return this.get<any[]>("/agents/devices");
  }

  getDevice(id: number): Promise<any> {
    return this.get<any>(`/agents/devices/${id}`);
  }

  getDeviceTelemetryHistory(id: number): Promise<any[]> {
    return this.get<any[]>(`/agents/devices/${id}/telemetry-history`);
  }

  getDeviceLatestTelemetry(id: number): Promise<any> {
    return this.get<any>(`/agents/devices/${id}/latest-telemetry`);
  }

  getRoles(): Promise<any[]> {
    return this.get<any[]>("/users/roles/list");
  }

  createRole(name: string, description: string, permissionIds: number[]): Promise<any> {
    const params = permissionIds.map(id => `permission_ids=${id}`).join("&");
    return this.post<any>(`/users/roles/create?name=${encodeURIComponent(name)}&description=${encodeURIComponent(description)}&${params}`);
  }

  getPermissions(): Promise<any[]> {
    return this.get<any[]>("/users/permissions/list");
  }

  getAuditLogs(): Promise<any[]> {
    return this.get<any[]>("/users/audit-logs/list");
  }

  bulkDeleteUsers(userIds: number[]): Promise<any> {
    return this.post<any>("/users/bulk-delete", userIds);
  }

  bulkStatusUsers(userIds: number[], status: string): Promise<any> {
    return this.post<any>(`/users/bulk-status?status=${status}`, userIds);
  }

  syncActiveDirectory(): Promise<any> {
    return this.post<any>("/users/ad-sync");
  }

  importCsvUsers(): Promise<any> {
    return this.post<any>("/users/csv-import");
  }

  listUsers(): Promise<any[]> {
    return this.get<any[]>("/users");
  }

  createUser(payload: any): Promise<any> {
    return this.post<any>("/users", payload);
  }

  updateUser(id: number, payload: any): Promise<any> {
    return this.put<any>(`/users/${id}`, payload);
  }

  deleteUser(id: number): Promise<any> {
    return this.delete<any>(`/users/${id}`);
  }
}

export const api = new ApiClient();
export default api;
