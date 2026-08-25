/**
 * Короткий подписанный «билет» сессии.
 *
 * Зачем: middleware раньше на каждый запрос к /api/* ходил в Supabase проверять
 * токен — это лишний сетевой перелёт перед каждым ответом. Теперь результат
 * проверки кладётся в подписанную куку на несколько минут, и всё это время
 * middleware проверяет подпись локально, без сети.
 *
 * Подпись — HMAC-SHA256 секретом, который живёт только на сервере, поэтому
 * подделать билет из браузера нельзя. Срок жизни короткий, чтобы отзыв доступа
 * в Supabase применялся быстро.
 */

export const AUTH_TICKET_COOKIE = "st_ticket";
export const AUTH_TICKET_TTL_SECONDS = 5 * 60;

export type AuthTicket = {
  user_id: string;
  role: string | null;
  company_id: string | null;
  /** Unix-время в секундах, после которого билет недействителен. */
  exp: number;
};

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function ticketSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return secret;
}

async function signPayload(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

/** Собрать билет: «полезная нагрузка.подпись». */
export async function createAuthTicket(ticket: Omit<AuthTicket, "exp">, ttlSeconds = AUTH_TICKET_TTL_SECONDS) {
  const secret = ticketSecret();
  if (!secret) return null;

  const payload: AuthTicket = { ...ticket, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signPayload(encoded, secret);
  return `${encoded}.${signature}`;
}

/** Проверить подпись и срок. Возвращает null для любого испорченного билета. */
export async function readAuthTicket(rawValue?: string | null): Promise<AuthTicket | null> {
  const secret = ticketSecret();
  if (!secret || !rawValue) return null;

  const [encoded, signature] = rawValue.split(".");
  if (!encoded || !signature) return null;

  let expectedSignature: string;
  try {
    expectedSignature = await signPayload(encoded, secret);
  } catch {
    return null;
  }

  // Сравнение постоянного времени: длина плюс побитовое накопление различий.
  if (signature.length !== expectedSignature.length) return null;
  let diff = 0;
  for (let index = 0; index < signature.length; index += 1) {
    diff |= signature.charCodeAt(index) ^ expectedSignature.charCodeAt(index);
  }
  if (diff !== 0) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as AuthTicket;
    if (!parsed?.user_id || typeof parsed.exp !== "number") return null;
    if (parsed.exp * 1000 <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
