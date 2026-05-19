type SupabaseJwtPayload = {
  ref?: string;
};

function parseProjectRefFromUrl(url: string): string {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const [ref] = host.split(".");
  if (!ref) {
    throw new Error("SUPABASE_URL does not contain a valid project ref");
  }
  return ref;
}

function decodeJwtPayload(token: string): SupabaseJwtPayload {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid Supabase JWT token format");
  }

  const payload = parts[1];
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const decoded = Buffer.from(withPadding, "base64").toString("utf-8");
  return JSON.parse(decoded) as SupabaseJwtPayload;
}

function assertSameProjectRef(projectRef: string, token: string, envName: string) {
  const payload = decodeJwtPayload(token);
  if (!payload.ref) {
    throw new Error(`${envName} is missing "ref" in JWT payload`);
  }
  if (payload.ref !== projectRef) {
    throw new Error(
      `${envName} project ref mismatch: expected "${projectRef}", got "${payload.ref}". Use one Supabase project for all keys.`
    );
  }
}

export function getValidatedSupabaseEnv() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const projectRef = parseProjectRefFromUrl(supabaseUrl);
  assertSameProjectRef(projectRef, serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY");

  if (anonKey) {
    assertSameProjectRef(projectRef, anonKey, "SUPABASE_ANON_KEY");
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    projectRef,
  };
}

