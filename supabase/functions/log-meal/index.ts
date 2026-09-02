// Identifica alimentos en una foto o un texto libre para el registro rápido
// de "qué comí realmente" en cada estación de Tu Ruta de Hoy.
//
// A diferencia de SuSana (ai-assistant): esto NO cuenta contra la cuota de
// 25 mensajes/mes ni requiere Premium — decisión explícita de la usuaria,
// "reducir fricción para registrar" es un principio del producto, no un
// beneficio de pago. Solo requiere sesión válida (verify_jwt=true) para que
// el gasto en la API de Anthropic quede atado a una cuenta real, no a
// tráfico anónimo.
//
// Nunca afirma precisión nutricional/médica: solo identifica alimentos por
// nombre, nunca calorías ni porciones exactas (ver prompts abajo) — el
// usuario siempre puede editar la lista antes de guardarla.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TEXT_LEN = 400;
// ~4MB en base64 (jpeg comprimido en el cliente antes de enviar, igual que
// el avatar) -- suficiente para una foto de comida, sin dejar pasar archivos
// enormes que disparen el costo o el tiempo de respuesta de Anthropic.
const MAX_IMAGE_B64_LEN = 5_500_000;

const ALLOWED_ORIGIN = Deno.env.get('APP_URL') ?? 'https://nutriruta.app';
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const PROMPT_FOTO = `Identifica los alimentos y preparaciones que se ven en esta foto de una comida. Responde ÚNICAMENTE con un array JSON de strings en español, cada uno un alimento o preparación (ejemplo: ["arroz blanco","pollo a la plancha","aguacate"]). No incluyas calorías, porciones exactas ni ningún otro texto fuera del array. Si no logras identificar nada con claridad razonable, responde [].`;

function promptTexto(texto: string): string {
  return `Extrae la lista de alimentos mencionados en este texto (puede venir de una transcripción de voz, con errores menores): "${texto}". Responde ÚNICAMENTE con un array JSON de strings en español, cada uno un alimento o preparación tal como lo describió la persona (ejemplo: ["dos huevos","avena","un banano"]). No incluyas calorías, porciones exactas en gramos ni ningún otro texto fuera del array. Si el texto no describe comida real, responde [].`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user) return json({ error: 'No autorizado' }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const modo = String(payload.modo ?? '');
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'El registro por IA aún no está configurado. Vuelve pronto.' }, 503);

  let content: any;
  if (modo === 'foto') {
    const imagenBase64 = String(payload.imagenBase64 ?? '');
    if (!imagenBase64) return json({ error: 'Falta la imagen.' }, 400);
    if (imagenBase64.length > MAX_IMAGE_B64_LEN) return json({ error: 'La imagen es demasiado grande.' }, 400);
    const mediaType = String(payload.mediaType ?? 'image/jpeg');
    content = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: imagenBase64 } },
      { type: 'text', text: PROMPT_FOTO }
    ];
  } else if (modo === 'texto') {
    const texto = String(payload.texto ?? '').trim();
    if (!texto) return json({ error: 'Escribe o dicta qué comiste.' }, 400);
    if (texto.length > MAX_TEXT_LEN) return json({ error: `Máximo ${MAX_TEXT_LEN} caracteres.` }, 400);
    content = promptTexto(texto);
  } else {
    return json({ error: 'Modo inválido.' }, 400);
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content }]
      })
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error('Anthropic error:', res.status, errBody);
      return json({ error: 'No pudimos analizar eso en este momento. Intenta de nuevo.' }, 502);
    }
    const data = await res.json();
    const texto = (data.content ?? []).map((b: any) => b.text ?? '').join('').trim();
    const alimentos = parseAlimentos(texto);
    return json({ alimentos });
  } catch (e) {
    console.error('Fallo llamando a Anthropic:', e);
    return json({ error: 'No pudimos analizar eso en este momento. Intenta de nuevo.' }, 502);
  }
});

// El modelo casi siempre responde con el array JSON limpio, pero por si
// agrega texto alrededor (ej. una frase antes), se extrae el primer bloque
// entre [ ] en vez de fallar de una.
function parseAlimentos(texto: string): string[] {
  try {
    const directo = JSON.parse(texto);
    if (Array.isArray(directo)) return directo.filter((x) => typeof x === 'string').slice(0, 20);
  } catch { /* sigue abajo */ }
  const match = texto.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const arr = JSON.parse(match[0]);
      if (Array.isArray(arr)) return arr.filter((x) => typeof x === 'string').slice(0, 20);
    } catch { /* no se pudo -- responde vacío */ }
  }
  return [];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
