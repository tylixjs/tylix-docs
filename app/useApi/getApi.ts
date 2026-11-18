export const getApi = (table: string, options?: ApiOptions) =>
  useApi(`/api/${table}`, options)
