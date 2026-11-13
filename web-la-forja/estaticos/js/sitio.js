// Comportamiento de la web: menú del móvil, sombra de la cabecera y aparición suave de bloques.
(function () {
  var boton = document.getElementById('menu-boton');
  var menu = document.getElementById('menu');

  function cerrarMenu() {
    document.body.classList.remove('menu-abierto');
    boton.setAttribute('aria-expanded', 'false');
  }
  if (boton && menu) {
    boton.addEventListener('click', function () {
      var abierto = document.body.classList.toggle('menu-abierto');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) cerrarMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('menu-abierto')) {
        cerrarMenu();
        boton.focus();
      }
    });
  }

  var cabecera = document.getElementById('cabecera');
  function alDesplazar() {
    cabecera.classList.toggle('cabecera--sombra', window.scrollY > 8);
  }
  if (cabecera) {
    alDesplazar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
  }

  var bloques = document.querySelectorAll('.aparece');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    bloques.forEach(function (b) { b.classList.add('visible'); });
    return;
  }
  var observador = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (entrada) {
      if (entrada.isIntersecting) {
        entrada.target.classList.add('visible');
        observador.unobserve(entrada.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  bloques.forEach(function (b) { observador.observe(b); });
})();
