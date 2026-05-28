import type { QueryClient } from "@tanstack/react-query";

export function invalidateBusinessData(queryClient: QueryClient, businessId?: string) {
  if (businessId) {
    void queryClient.invalidateQueries({ queryKey: ["business", businessId] });
  }
  void queryClient.invalidateQueries({ queryKey: ["businesses"] });
}
