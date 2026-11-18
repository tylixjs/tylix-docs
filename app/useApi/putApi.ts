export const putApi = (
  table: string,
  id: number | string,
  data: unknown,
  options?: ApiOptions,
) => useApi(`/api/${table}/${id}`, { ...options, method: 'PUT', body: data })
