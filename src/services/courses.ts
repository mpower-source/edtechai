import { supabase } from "../integrations/supabase/client";

export type NewCourse = {
  title: string;
  description?: string | null;
};

export async function insertCourse(input: NewCourse) {
  const { data, error } = await supabase
    .from("courses")
    .insert([{ title: input.title, description: input.description ?? null }])
    .select()
    .single();

  if (error) throw error;
  return data;
}
