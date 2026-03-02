import { supabase } from "../integrations/supabase/client";

export type Profile = Record<string, any>;

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function upsertProfile(userId: string, payload: Partial<Profile>) {
  const toUpsert = { id: userId, ...payload };
  const { data, error } = await supabase
    .from("profiles")
    .upsert(toUpsert, { onConflict: "id" })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}
