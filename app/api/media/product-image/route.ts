import { NextRequest, NextResponse } from "next/server";
import { can } from "@/lib/auth/rbac";
import { getCompanyIdFromRequest, getRoleFromRequest, getUserIdFromRequest } from "@/lib/auth/request-context";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { MediaEntityType, resolveEntityCompanyId, syncEntityImageUrl } from "@/lib/media/entity-resolver";

const BUCKET = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
let bucketReady = false;

async function ensureBucketExists() {
  if (bucketReady) return;
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) {
    throw new Error(`Не удалось проверить Storage bucket: ${listError.message}`);
  }

  const exists = (buckets ?? []).some((bucket) => bucket.name === BUCKET);
  if (!exists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
      allowedMimeTypes: Array.from(ALLOWED_MIME),
    });
    if (createError) {
      throw new Error(`Не удалось создать Storage bucket "${BUCKET}": ${createError.message}`);
    }
  }
  bucketReady = true;
}

function isEntityType(value: string | null): value is MediaEntityType {
  return value === "collection" || value === "collection_model";
}

function safeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

export async function POST(request: NextRequest) {
  const role = getRoleFromRequest(request);
  if (!can(role, "catalog:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const formData = await request.formData();
  const entityTypeRaw = String(formData.get("entity_type") ?? "");
  const entityId = String(formData.get("entity_id") ?? "");
  const file = formData.get("file");

  if (!isEntityType(entityTypeRaw)) {
    return NextResponse.json({ error: "Неверный entity_type" }, { status: 400 });
  }

  if (!entityId) {
    return NextResponse.json({ error: "entity_id обязателен" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Разрешены только jpg, png, webp" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Максимальный размер файла 5 MB" }, { status: 400 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const userId = getUserIdFromRequest(request);
  const entityCompanyId = await resolveEntityCompanyId(entityTypeRaw, entityId);
  if (!entityCompanyId || entityCompanyId !== companyId) {
    return NextResponse.json({ error: "Сущность не найдена или нет доступа" }, { status: 404 });
  }

  const { data: existingMedia } = await supabaseAdmin
    .from("media_files")
    .select("id,file_path")
    .eq("company_id", companyId)
    .eq("entity_type", entityTypeRaw)
    .eq("entity_id", entityId)
    .eq("is_primary", true)
    .maybeSingle();

  const fileName = safeFileName(file.name || "image");
  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
  const objectPath = `${companyId}/${entityTypeRaw}/${entityId}/${Date.now()}${ext}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  try {
    await ensureBucketExists();
  } catch (bucketError) {
    return NextResponse.json(
      { error: bucketError instanceof Error ? bucketError.message : "Ошибка подготовки Storage bucket" },
      { status: 500 }
    );
  }

  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(objectPath, fileBuffer, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json({ error: `Ошибка загрузки файла: ${uploadError.message}` }, { status: 500 });
  }

  const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectPath);
  const fileUrl = publicData.publicUrl;

  let mediaId = existingMedia?.id ?? null;
  if (existingMedia?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("media_files")
      .update({
        file_path: objectPath,
        file_url: fileUrl,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      })
      .eq("id", existingMedia.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("media_files")
      .insert({
        company_id: companyId,
        entity_type: entityTypeRaw,
        entity_id: entityId,
        file_path: objectPath,
        file_url: fileUrl,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        sort_order: 0,
        is_primary: true,
        uploaded_by: userId,
      })
      .select("id")
      .single();
    if (insertError) {
      await supabaseAdmin.storage.from(BUCKET).remove([objectPath]);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    mediaId = inserted?.id ?? null;
  }

  try {
    await syncEntityImageUrl(entityTypeRaw, entityId, fileUrl);
  } catch (syncError) {
    if (mediaId) {
      await supabaseAdmin.from("media_files").delete().eq("id", mediaId);
    }
    await supabaseAdmin.storage.from(BUCKET).remove([objectPath]);
    return NextResponse.json(
      { error: syncError instanceof Error ? syncError.message : "Не удалось привязать фото к сущности" },
      { status: 500 }
    );
  }

  if (existingMedia?.file_path) {
    await supabaseAdmin.storage.from(BUCKET).remove([existingMedia.file_path]);
  }

  return NextResponse.json({
    id: mediaId,
    entity_type: entityTypeRaw,
    entity_id: entityId,
    file_path: objectPath,
    file_url: fileUrl,
  });
}

export async function DELETE(request: NextRequest) {
  const role = getRoleFromRequest(request);
  if (!can(role, "catalog:write")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const entityTypeRaw = request.nextUrl.searchParams.get("entity_type");
  const entityId = request.nextUrl.searchParams.get("entity_id");

  if (!isEntityType(entityTypeRaw) || !entityId) {
    return NextResponse.json({ error: "Неверные параметры удаления" }, { status: 400 });
  }

  const companyId = getCompanyIdFromRequest(request);
  const entityCompanyId = await resolveEntityCompanyId(entityTypeRaw, entityId);
  if (!entityCompanyId || entityCompanyId !== companyId) {
    return NextResponse.json({ error: "Сущность не найдена или нет доступа" }, { status: 404 });
  }

  const { data: media, error: mediaError } = await supabaseAdmin
    .from("media_files")
    .select("id,file_path")
    .eq("company_id", companyId)
    .eq("entity_type", entityTypeRaw)
    .eq("entity_id", entityId)
    .eq("is_primary", true)
    .maybeSingle();

  if (mediaError) {
    return NextResponse.json({ error: mediaError.message }, { status: 500 });
  }

  if (media?.file_path) {
    await supabaseAdmin.storage.from(BUCKET).remove([media.file_path]);
  }

  if (media?.id) {
    const { error: deleteError } = await supabaseAdmin.from("media_files").delete().eq("id", media.id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  await syncEntityImageUrl(entityTypeRaw, entityId, null);
  return NextResponse.json({ success: true });
}
