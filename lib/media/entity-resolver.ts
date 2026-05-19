import { supabaseAdmin } from "@/lib/supabase/admin-client";

export type MediaEntityType = "collection" | "collection_model";

export async function resolveEntityCompanyId(entityType: MediaEntityType, entityId: string) {
  if (entityType === "collection") {
    const { data, error } = await supabaseAdmin
      .from("collections")
      .select("id,company_id")
      .eq("id", entityId)
      .single();

    if (error || !data) return null;
    return data.company_id as string;
  }

  const { data, error } = await supabaseAdmin
    .from("collection_models")
    .select("id,collection:collections(company_id)")
    .eq("id", entityId)
    .single();

  if (error || !data) return null;
  const relation = data.collection as { company_id?: string } | null;
  return relation?.company_id ?? null;
}

export async function syncEntityImageUrl(entityType: MediaEntityType, entityId: string, imageUrl: string | null) {
  if (entityType === "collection") {
    const { error } = await supabaseAdmin.from("collections").update({ image_url: imageUrl }).eq("id", entityId);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from("collection_models").update({ image_url: imageUrl }).eq("id", entityId);
  if (error) throw error;
}
