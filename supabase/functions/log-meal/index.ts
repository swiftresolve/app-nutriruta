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

// Haiku -- decisión explícita de la usuaria: este registro es gratis e
// ilimitado para toda cuenta (no solo Premium), así que el costo por
// alimentar necesita quedar predecible y bajo. Se evaluó subir a Sonnet
// para mejorar precisión, pero se descartó por ahora: el costo real por
// registro con Sonnet no es un número fijo (varía según cuántas cuentas
// registren y cuántas veces al día), y sin ese número controlado no vale
// la pena el riesgo. Revisar de nuevo si se decide medir el costo real
// primero (ver conversación: "necesito tener un control lo más exacto
// posible de los costos de mi app").
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

// Pide TANTO el nombre del platillo (si aplica) COMO la lista de
// alimentos -- antes solo devolvía la lista, así que un registro por foto
// nunca tenía un título real ("Bandeja paisa"), la tarjeta de "lo que
// registraste" terminaba mostrando los ingredientes pegados como título
// (ej. "Arroz blanco, Huevo frito, Carne molida..."). "nombre" es null a
// propósito cuando NO hay un plato típico reconocible (ej. una repisa de
// alimentos sueltos) -- inventar un nombre ahí sería peor que no tener uno.
const FORMATO_RESPUESTA = `Responde ÚNICAMENTE con un objeto JSON con dos llaves:
- "nombre": el nombre común del platillo en español (ej. "Bandeja paisa", "Ajiaco", "Sancocho") SOLO si reconoces un plato típico compuesto real -- si son solo alimentos sueltos sin un nombre de plato conocido (ej. "dos huevos, avena y un banano"), usa null. Nunca inventes un nombre que no sea real.
- "alimentos": un array de strings en español, cada uno un alimento o preparación individual (ejemplo: ["arroz blanco","pollo a la plancha","aguacate"]).
No incluyas calorías, porciones exactas ni ningún otro texto fuera del objeto JSON. Si no logras identificar ningún alimento real con claridad razonable, responde {"nombre":null,"alimentos":[]}.`;

const PROMPT_FOTO = `Identifica ÚNICAMENTE los alimentos y preparaciones reales que se ven en esta foto de una comida -- comida latinoamericana/colombiana, ten en cuenta preparaciones típicas de la región (arepas, patacones, ajiaco, etc.) al reconocer texturas y formas antes de nombrar algo.

Reglas estrictas:
- NUNCA incluyas cubiertos, platos, vasos, servilletas, empaques, manteles, manos, ni ningún objeto que no sea comida -- aunque aparezcan claramente en la foto, no son alimentos.
- Mira con cuidado la forma, textura y color antes de nombrar cada alimento -- no adivines rápido por una primera impresión (ej. no confundas un filete de pollo dorado con huevo revuelto solo por el color amarillo/dorado; no confundas pan o una arepa con un churro solo por la forma alargada).
- Si dudas seriamente entre dos alimentos, elige el más probable según la forma Y la textura juntas, no solo el color.
- Si un elemento no se ve con claridad razonable, no lo incluyas -- es mejor una lista corta y correcta que una larga con errores.

${FORMATO_RESPUESTA}`;

function promptTexto(texto: string): string {
  return `Extrae la lista de alimentos mencionados en este texto (puede venir de una transcripción de voz, con errores menores): "${texto}".

${FORMATO_RESPUESTA}`;
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
    const { nombre, alimentos } = parseRespuesta(texto);
    return json({ nombre, alimentos });
  } catch (e) {
    console.error('Fallo llamando a Anthropic:', e);
    return json({ error: 'No pudimos analizar eso en este momento. Intenta de nuevo.' }, 502);
  }
});

// El modelo casi siempre responde con el objeto JSON limpio, pero por si
// agrega texto alrededor (ej. una frase antes), se extrae el primer bloque
// entre { } en vez de fallar de una.
function parseRespuesta(texto: string): { nombre: string | null; alimentos: string[] } {
  const normalizar = (obj: any) => ({
    nombre: typeof obj?.nombre === 'string' && obj.nombre.trim() ? obj.nombre.trim() : null,
    alimentos: Array.isArray(obj?.alimentos) ? obj.alimentos.filter((x: unknown) => typeof x === 'string').slice(0, 20) : []
  });
  try {
    const directo = JSON.parse(texto);
    if (directo && typeof directo === 'object') return normalizar(directo);
  } catch { /* sigue abajo */ }
  const match = texto.match(/\{[\s\S]*\}/);
  if (match) {
    try { return normalizar(JSON.parse(match[0])); } catch { /* no se pudo -- responde vacío */ }
  }
  return { nombre: null, alimentos: [] };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
