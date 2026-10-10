import { ApiError, api, getAccessToken, onUnauthorized, setAccessToken } from '@/lib/api-client';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
    blob: async () => new Blob(),
  } as Response;
}

describe('api client', () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(async () => {
    // Let the shared in-flight refresh promise of the previous test settle and reset.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    setAccessToken('expired-token');
  });

  it('sends the bearer token and unwraps the data envelope', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: '1' } }));
    await expect(api.get<{ id: string }>('/api/clients/1')).resolves.toEqual({ id: '1' });
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer expired-token');
    expect(init?.credentials).toBe('include');
  });

  it('serialises array filters as comma separated values', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, data: [], meta: {} }));
    await api.list('/api/cases', { status: ['OPEN', 'PENDING'], search: '', page: 2 });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('status')).toBe('OPEN,PENDING');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.has('search')).toBe(false);
  });

  it('refreshes the session once on 401 and retries the request', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, { success: false, message: 'Expired', errorCode: 'TOKEN_EXPIRED' }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { accessToken: 'fresh-token', user: { id: 'u1' } },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { ok: true } }));

    await expect(api.get('/api/dashboard/stats')).resolves.toEqual({ ok: true });
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/auth/refresh');
    expect(getAccessToken()).toBe('fresh-token');
    expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get('Authorization')).toBe(
      'Bearer fresh-token',
    );
  });

  it('notifies listeners and throws when the refresh fails', async () => {
    const listener = jest.fn();
    const unsubscribe = onUnauthorized(listener);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, { success: false, message: 'Expired', errorCode: 'TOKEN_EXPIRED' }),
      )
      .mockResolvedValueOnce(
        jsonResponse(401, {
          success: false,
          message: 'Invalid',
          errorCode: 'INVALID_REFRESH_TOKEN',
        }),
      );

    await expect(api.get('/api/clients')).rejects.toMatchObject({
      status: 401,
      errorCode: 'TOKEN_EXPIRED',
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    unsubscribe();
  });

  it('exposes the API error code', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { success: false, message: 'Too much', errorCode: 'OVERPAYMENT' }),
    );
    const error = await api
      .post('/api/invoices/1/pay', { amount: 10 })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, errorCode: 'OVERPAYMENT' });
  });
});
