export const deleteApi = (table: string, id: number | string, options?: ApiOptions) =>
  useApi(`/api/${table}/${id}`, { ...options, method: 'DELETE' })
