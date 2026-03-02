import { useQuery } from "@tanstack/react-query";
import { getProfile } from "../services/profiles";
import { useAuth } from "../auth/AuthProvider";

export function useProfile() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return getProfile(user.id);
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  return query;
}
