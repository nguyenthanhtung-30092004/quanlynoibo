export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

export interface Paginated<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryValue = string | number | boolean | undefined | null;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `/api/${path.replace(/^\//, '')}${qs ? `?${qs}` : ''}`;
}

async function readError(res: Response): Promise<ApiError> {
  const json = await res.json().catch(() => null);
  const raw = json?.message;
  const message = Array.isArray(raw)
    ? raw.join('. ')
    : typeof raw === 'string'
      ? raw
      : `Yêu cầu thất bại (${res.status}).`;
  return new ApiError(res.status, message);
}

/**
 * Phiên hết hạn: proxy đã thử làm mới bằng refresh token mà không được (hết hạn
 * hoặc bị thu hồi) và đã xóa cookie, nên đăng xuất và đưa về trang đăng nhập.
 */
function handleUnauthorized(path: string) {
  if (
    typeof window !== 'undefined' &&
    path !== 'auth/login' &&
    window.location.pathname !== '/login'
  ) {
    window.location.assign('/login');
  }
}

export async function api<T>(
  path: string,
  { method = 'GET', body, query, signal }: RequestOptions = {},
): Promise<T> {
  const res = await fetch(buildUrl(path, query), {
    method,
    signal,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized(path);
    throw await readError(res);
  }
  return (await res.json()) as T;
}

/** Tải file nhị phân (ví dụ Excel) kèm tên file lấy từ header */
export async function apiDownload(
  path: string,
  query?: Record<string, QueryValue>,
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(buildUrl(path, query));
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized(path);
    throw await readError(res);
  }
  const disposition = res.headers.get('content-disposition') ?? '';
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'download';
  return { blob: await res.blob(), filename };
}
