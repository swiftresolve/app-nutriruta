# 🌿 NutrAlma

**Nutre tu cuerpo, cuida tu alma.**

NutrAlma es una PWA (Progressive Web App) de nutrición y hábitos alimenticios saludables, centrada en salud hormonal, metabólica, digestiva y cardiovascular — con enfoque especial en mujeres, pero útil para cualquier persona.

Es una herramienta de **autoayuda y educación**: no diagnostica ni reemplaza la atención de profesionales de la salud.

## ✨ Funciones

- **Quiz inicial de personalización** — objetivos, condiciones conocidas, alergias/exclusiones, hábitos difíciles y nivel de actividad. Asigna perfiles de salud automáticamente.
- **7 perfiles de salud** — hígado graso, resistencia a la insulina, prediabetes, colon irritable, migrañas, candidiasis y colesterol alto/riesgo cardiovascular.
- **Menú diario personalizado** — 5 comidas generadas según tus perfiles y exclusiones, con rotación diaria y botón para cambiar recetas.
- **Semáforo nutricional** — verde (recomendado), amarillo (moderar), rojo (evitar) calculado por perfil.
- **Exclusiones y sustituciones inteligentes** — marca lo que no consumes (pescado, lácteos, gluten…) y las recetas se filtran o proponen sustitutos equivalentes.
- **Botón SOS antojo** — pausa de respiración guiada, distinción hambre física vs. emocional, snacks anti-ansiedad aptos para tu perfil y registro de episodios.
- **Detección de patrones** — si tus antojos se repiten en una franja horaria, la app te sugiere anticiparte con un snack saludable.
- **Seguimiento diario** — agua, checklist de hábitos, rachas y logros.
- **Lista de compras** — generada automáticamente desde tu menú del día.
- **Aprende** — micro-lecciones de 3–5 minutos (azúcar oculta, grasas buenas, microbiota, plato modelo, sueño y estrés, hambre emocional) y glosario simple.
- **Sección legal completa** — términos de uso, privacidad y descargo médico.
- **100 % offline** — funciona sin conexión (service worker) y todos los datos se guardan solo en tu dispositivo (localStorage). Instalable en móvil y escritorio.

## 🚀 Uso

Es una app estática sin dependencias ni build:

```bash
# Cualquier servidor estático sirve. Por ejemplo:
npx http-server -p 8080
# o
python -m http.server 8080
```

Abre `http://localhost:8080` y, desde el navegador del móvil, usa **"Añadir a pantalla de inicio"** para instalarla.

## 🧱 Estructura

```
├── index.html              # Shell de la app
├── manifest.webmanifest    # Manifiesto PWA
├── sw.js                   # Service worker (cache-first, offline)
├── css/styles.css          # Sistema de diseño (verde agua, azul suave, coral)
├── icons/                  # Íconos PWA (any + maskable)
└── js/
    ├── app.js              # Router + utilidades UI
    ├── store.js            # Estado persistente (localStorage), rachas y logros
    ├── menu.js             # Motor de menús: filtros, semáforo, sustituciones
    ├── data/
    │   ├── profiles.js     # Perfiles de salud, exclusiones, objetivos
    │   ├── recipes.js      # Recetario etiquetado por perfil y comida
    │   └── lessons.js      # Micro-lecciones y glosario
    └── views/              # Quiz, dashboard, recetario, SOS, progreso, aprende, ajustes
```

## ⚖️ Aviso

Esta aplicación es una herramienta de autoayuda basada en buenas prácticas de hábitos saludables. No reemplaza el consejo ni el seguimiento de un médico, nutricionista u otro profesional de salud. Si tienes diagnósticos, medicación o síntomas importantes, consulta siempre con tu profesional de confianza.

---

Hecha con 💚 · NutrAlma v1.0
