// Aplica el tema guardado ANTES de que se cargue el CSS, para que no haya
// un parpadeo del tema equivocado al abrir la app. Script plano (no
// módulo) cargado sin defer/async en index.html, antes del <link> de
// estilos, para que se ejecute y termine primero. Nunca importa store.js
// (es un módulo async, y esto tiene que correr sincrónico y sin esperar a
// que exista sesión) — usa su propia llave de localStorage, independiente
// de la cuenta, porque el tema es una preferencia del dispositivo/navegador,
// no un dato de salud que deba viajar a la nube.
(function () {
  try {
    var tema = localStorage.getItem('nutriruta-tema');
    if (tema === 'claro') document.documentElement.setAttribute('data-theme', 'light');
    else if (tema === 'oscuro') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) { /* localStorage bloqueado (ej. modo privado estricto): sigue con el tema del sistema */ }
})();
