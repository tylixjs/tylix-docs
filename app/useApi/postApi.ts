export const postApi = (table: string, data: unknown, options?: ApiOptions) =>
  useApi(`/api/${table}`, { ...options, method: 'POST', body: data })
