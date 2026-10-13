"use client";

import { API_ROUTES } from "@/lib/api/config";
import type { ChangePasswordInput } from "@/lib/api/types";
import { useApiMutation } from "../useApi";

export function useChangePassword() {
  return useApiMutation<unknown, ChangePasswordInput>(API_ROUTES.changePassword);
}
