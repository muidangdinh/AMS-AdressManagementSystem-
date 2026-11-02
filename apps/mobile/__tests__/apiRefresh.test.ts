import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, apiFetch, getRefreshToken, getToken, setTokens, setUnauthorizedHandler } from '../src/lib/api';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => void store.set(key, value)),
      multiSet: jest.fn(async (pairs: [string, string][]) => pairs.forEach(([k, v]) => store.set(k, v))),
      multiRemove: jest.fn(async (keys: string[]) => keys.forEach((k) => store.delete(k))),
      clear: jest.fn(async () => store.clear()),
    },
  };
});

function json(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const isRefreshCall = ([url]: [string, RequestInit?]) => url.endsWith('/api/auth/refresh');
const bearer = (init?: RequestInit) => new Headers(init?.headers).get('Authorization');

describe('apiFetch làm mới phiên', () => {
  const fetchMock = jest.fn();
  const onUnauthorized = jest.fn();

  beforeEach(async () => {
    fetchMock.mockReset();
    onUnauthorized.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    setUnauthorizedHandler(onUnauthorized);
    await (AsyncStorage as unknown as { clear: () => Promise<void> }).clear();
    await setTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' });
  });

  /** Server giả: chỉ chấp nhận access token mới; refresh trả về `refreshResponse`. */
  function mockServer(refreshResponse: () => Response | Promise<Response>) {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/auth/refresh')) return refreshResponse();
      return bearer(init) === 'Bearer new-access' ? json(200, { ok: true }) : json(401, { message: 'hết hạn' });
    });
  }

  it('token hết hạn: làm mới, lưu cặp token mới và gửi lại request', async () => {
    mockServer(() => json(200, { accessToken: 'new-access', refreshToken: 'new-refresh' }));

    await expect(apiFetch('/api/houses')).resolves.toEqual({ ok: true });

    expect(await getToken()).toBe('new-access');
    expect(await getRefreshToken()).toBe('new-refresh');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('nhiều request cùng gặp 401 chỉ gọi refresh 1 lần', async () => {
    mockServer(() => json(200, { accessToken: 'new-access', refreshToken: 'new-refresh' }));

    await Promise.all([apiFetch('/api/a'), apiFetch('/api/b'), apiFetch('/api/c')]);

    expect(fetchMock.mock.calls.filter(isRefreshCall)).toHaveLength(1);
  });

  it('server từ chối refresh: xóa phiên và báo hết hạn', async () => {
    mockServer(() => json(401, { message: 'từ chối' }));

    await expect(apiFetch('/api/houses')).rejects.toBeInstanceOf(ApiError);

    expect(await getToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('mất mạng lúc refresh: giữ nguyên phiên, không đăng xuất', async () => {
    mockServer(() => Promise.reject(new TypeError('Network request failed')));

    await expect(apiFetch('/api/houses')).rejects.toThrow('Network request failed');

    expect(await getRefreshToken()).toBe('old-refresh');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('máy chủ lỗi 5xx lúc refresh: giữ nguyên phiên', async () => {
    mockServer(() => json(503, { message: 'bảo trì' }));

    await expect(apiFetch('/api/houses')).rejects.toMatchObject({ status: 503 });

    expect(await getRefreshToken()).toBe('old-refresh');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('sai mật khẩu ở login không kích hoạt refresh', async () => {
    fetchMock.mockResolvedValue(json(401, { message: 'sai mật khẩu' }));

    await expect(apiFetch('/api/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      status: 401,
      message: 'sai mật khẩu',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
