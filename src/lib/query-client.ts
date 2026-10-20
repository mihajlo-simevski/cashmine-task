import { QueryClient } from "@tanstack/react-query";

import { retryDelay, shouldRetryQuery } from "@/lib/api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: shouldRetryQuery,
      retryDelay,
    },
  },
});
