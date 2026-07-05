# 🌿 NutriRuta

**Tu ruta hacia hábitos saludables, paso a paso.**

NutriRuta es una PWA (Progressive Web App) de nutrición y hábitos alimenticios saludables, centrada en salud hormonal, metabólica, digestiva y cardiovascular — con enfoque especial en mujeres, pero útil para cualquier persona.

Es una herramienta de **autoayuda y educación**: no diagnostica ni reemplaza la atención de profesionales de la salud.

## ✨ Funciones

- **Cuentas seguras** — registro e inicio de sesión con Supabase Auth: tokens **JWT** de corta duración con renovación automática, contraseñas con hash bcrypt (nunca en texto plano) y confirmación de correo.
- **Datos en la nube** — el perfil y el progreso se sincronizan a Supabase (PostgreSQL) protegidos por **Row Level Security**: cada usuario solo puede leer y escribir sus propios datos. La app sigue funcionando offline y sincroniza al reconectar.
- **Quiz inicial de personalización** — objetivos, condiciones conocidas, alergias/exclusiones, hábitos difíciles y nivel de actividad. Asigna perfiles de salud automáticamente.
- **7 perfiles de salud** — hígado graso, resistencia a la insulina, prediabetes, colon irritable, migrañas, candidiasis y colesterol alto/riesgo cardiovascular.
- **Menú diario personalizado** — 5 comidas generadas según tus perfiles y exclusiones, con rotación diaria y botón para cambiar recetas.
- **Semáforo nutricional** — verde (recomendado), amarillo (moderar), rojo (evitar) calculado por perfil.
- **Exclusiones y sustituciones inteligentes** — marca lo que no consumes (pescado, lácteos, gluten…) y las recetas se filtran o proponen sustitutos equivalentes.
- **🎯 Misión 12 semanas** (Premium) — programa progresivo de un cambio por semana: cero azúcar líquido, proteína al desayuno, agua, verduras, integrales, movimiento, sin fritos, microbiota, cena ligera, manejo del antojo, sueño y consolidación.
- **Planes de suscripción** — Gratuito, Premium Mensual (USD 9/mes) y Premium Anual (USD 90/año, 2 meses gratis). *Pasarela de pagos pendiente de integrar.*
- **Botón SOS antojo** — pausa de respiración guiada, hambre física vs. emocional, snacks anti-ansiedad aptos para tu perfil y registro de episodios con detección de patrones horarios.
- **Seguimiento diario** — agua, checklist de hábitos, rachas y logros.
- **Lista de compras** — generada automáticamente desde tu menú del día.
- **Aprende** — micro-lecciones de 3–5 minutos y glosario simple.
- **Sección legal completa** — términos de uso, privacidad (incluye tratamiento de datos de salud) y descargo médico.
- **PWA instalable y offline** — service worker con cache del app shell y del SDK; la API de datos nunca se cachea.

## 🔐 Seguridad

- Autenticación JWT gestionada por Supabase Auth (access token + refresh token rotativo).
- Row Level Security en todas las tablas: sin sesión válida no se puede leer ni escribir ninguna fila.
- Content Security Policy estricta (solo `self`, `esm.sh` y la API de Supabase; sin scripts inline).
- Escapado de todo contenido generado por el usuario (prevención XSS).
- Validación de contraseña (mínimo 8 caracteres con letras y números) y mensajes de error que no revelan información.
- La clave `publishable` del cliente es pública por diseño; los datos los protege RLS, no la clave.

## 🚀 Uso local

App estática sin build:

```bash
npx http-server -p 8080
```

Abre `http://localhost:8080` y usa **"Añadir a pantalla de inicio"** en el móvil para instalarla.

## 🧱 Estructura

```
├── index.html              # Shell de la app + CSP
├── manifest.webmanifest    # Manifiesto PWA
├── sw.js                   # Service worker (offline)
├── css/styles.css          # Sistema de diseño (verde agua, azul suave, coral)
├── icons/                  # Íconos PWA (any + maskable)
└── js/
    ├── app.js              # Router + puerta de autenticación
    ├── config.js           # URL y clave publishable de Supabase
    ├── supabase-client.js  # Auth JWT + acceso a datos (RLS)
    ├── store.js            # Estado local + sincronización a la nube
    ├── menu.js             # Motor de menús: filtros, semáforo, sustituciones
    ├── data/               # Perfiles, recetas, lecciones, misión 12 semanas
    └── views/              # Auth, quiz, dashboard, recetario, SOS, misión, planes…
```

## ⚖️ Aviso

Esta aplicación es una herramienta de autoayuda basada en buenas prácticas de hábitos saludables. No reemplaza el consejo ni el seguimiento de un médico, nutricionista u otro profesional de salud. Si tienes diagnósticos, medicación o síntomas importantes, consulta siempre con tu profesional de confianza.

---

Hecha con 💚 · NutriRuta v2.0
