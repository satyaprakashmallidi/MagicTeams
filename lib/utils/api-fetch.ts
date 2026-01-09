/**
 * API Fetch Utility
 * Centralized fetch wrapper that automatically includes necessary headers for ngrok and CORS
 */

export interface ApiFetchOptions extends RequestInit {
    skipNgrokHeader?: boolean;
}

/**
 * Enhanced fetch wrapper that automatically includes the ngrok-skip-browser-warning header
 * This is required when using ngrok to avoid the browser warning page
 */
export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
    const { skipNgrokHeader = false, ...fetchOptions } = options;

    // Merge headers
    const headers = new Headers(fetchOptions.headers);

    // Add ngrok header if not explicitly skipped
    if (!skipNgrokHeader) {
        headers.set('ngrok-skip-browser-warning', 'true');
    }

    // Add default content type if not present
    if (!headers.has('Content-Type') && fetchOptions.method !== 'GET') {
        headers.set('Content-Type', 'application/json');
    }

    return fetch(url, {
        ...fetchOptions,
        headers,
    });
}

export default apiFetch;
