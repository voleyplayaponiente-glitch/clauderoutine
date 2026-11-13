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

// Formulario de contacto: se envía con Web3Forms sin salir de la página.
(function () {
  var formulario = document.getElementById('formulario');
  if (!formulario || !window.fetch) return;
  var estado = document.getElementById('formulario-estado');
  var boton = formulario.querySelector('button[type="submit"]');
  var telefono = formulario.getAttribute('data-telefono');

  function avisar(tipo, texto) {
    estado.setAttribute('data-tipo', tipo);
    estado.textContent = texto;
  }

  formulario.addEventListener('submit', function (e) {
    e.preventDefault();
    var datos = {};
    new FormData(formulario).forEach(function (valor, clave) { datos[clave] = valor; });

    if (datos.access_key === 'ACCESS_KEY') {
      avisar('error', 'El formulario todavía no está activado. Mientras tanto, llama o escribe por WhatsApp al ' + telefono + '.');
      return;
    }
    boton.disabled = true;
    avisar('ok', 'Enviando…');
    fetch(formulario.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(datos),
    })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r.success) throw new Error(r.message);
        formulario.reset();
        avisar('ok', 'Mensaje enviado. Gracias: te responderé lo antes posible.');
      })
      .catch(function () {
        avisar('error', 'No se ha podido enviar el mensaje. Inténtalo de nuevo o llama al ' + telefono + '.');
      })
      .then(function () { boton.disabled = false; });
  });
})();
