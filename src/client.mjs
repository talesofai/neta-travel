/**
 * Neta API axios client + error handling
 */
import axios, { AxiosError } from 'axios';

export class ApiResponseError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.code = code;
    this.message = message;
    this.name = 'ApiResponseError';
  }
}

function parseErrorMessage(data) {
  if (typeof data !== 'string' && typeof data !== 'object') return String(data);
  const parsed = typeof data === 'string' ? safeParseJson(data) ?? {} : data;
  const detail = parsed?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(({ msg } = {}) => msg).join(', ');
  if (typeof detail === 'object' && detail) return detail.message ?? detail.msg ?? JSON.stringify(detail);
  return parsed?.message ?? parsed?.msg ?? JSON.stringify(parsed);
}

function safeParseJson(json) {
  try { return JSON.parse(json); } catch { return null; }
}

function handleError(error) {
  if (error instanceof AxiosError) {
    if (error.response?.status) {
      const message = error.response.status >= 400 && error.response.status < 500
        ? parseErrorMessage(error.response.data)
        : error.message;
      throw new ApiResponseError(error.response.status, message, { cause: error });
    }
  }
  if (error instanceof Error) throw new ApiResponseError(-1, error.message, { cause: error });
  throw new ApiResponseError(-1, String(error), { cause: error });
}

export function createClient(baseUrl, token) {
  const client = axios.create({
    adapter: 'fetch',
    baseURL: baseUrl,
    headers: {
      'x-token': token,
      'x-platform': 'nieta-app/web',
    },
  });
  client.interceptors.response.use(r => r, handleError);
  return client;
}
