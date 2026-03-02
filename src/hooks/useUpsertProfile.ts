import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertProfile } from "../services/profiles";
import { useAuth } from "../auth/AuthProvider";

export function useUpsertProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!user?.id) throw new Error("Not authenticated");
      return upsertProfile(user.id, payload);
    },
    onSuccess: () => {
      if (user?.id) {
        qc.invalidateQueries({ queryKey: ["profile", user.id] });
      }
    },
  });
}
