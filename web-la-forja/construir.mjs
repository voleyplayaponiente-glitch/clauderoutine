// Construye la web de La Forja Abogados.
//
//   node construir.mjs         → genera la web en la carpeta "sitio"
//   node construir.mjs --ver   → la genera y la abre en http://localhost:4173
//   node construir.mjs --publicar → la genera para internet; se niega si faltan
//                                   datos obligatorios (nº de colegiado o NIF)
//
// Qué hace: junta cada página de "paginas" con la cabecera y el pie comunes
// de "plantillas", rellena los datos del despacho que hay en "datos.json"
// y copia estilos, imágenes y fuentes desde "estaticos".
// No necesita instalar nada más que Node.js.

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, cpSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const RAIZ = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(RAIZ, 'sitio');

const leer = (...ruta) => readFileSync(join(RAIZ, ...ruta), 'utf8');
const escapar = (texto) =>
  String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Datos del despacho + valores calculados a partir de ellos ──────────────
function cargarDatos() {
  const d = JSON.parse(leer('datos.json'));
  const dir = d.direccion;
  d.direccionCompleta = `${dir.calle}, ${dir.cp} ${dir.localidad} (${dir.provincia})`;
  d.telefonoEnlace = `tel:${d.telefono.internacional}`;
  d.whatsappEnlace = `https://wa.me/${d.whatsapp.numero}?text=${encodeURIComponent(d.whatsapp.mensaje)}`;
  d.mapaEnlace = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${d.marca}, ${dir.calle}, ${dir.cp} ${dir.localidad}`
  )}`;
  d.titulacionTexto = d.titulacion.join(' · ');
  d.zonaTexto = d.zona.slice(0, -1).join(', ') + ' y toda la ' + d.zona.at(-1);
  d.anio = new Date().getFullYear();
  return d;
}

// ── Datos estructurados para Google (schema.org) ───────────────────────────
// En todas las páginas: el despacho (LegalService) y el sitio web.
// Además, según la página: la ruta de migas y las preguntas frecuentes que contenga.
const sinEtiquetas = (html) =>
  html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

function datosEstructurados(d, meta, contenido) {
  const url = d.dominio + meta.ruta;
  const grafo = [
    {
      '@type': 'LegalService',
      '@id': `${d.dominio}/#despacho`,
      name: d.marca,
      slogan: d.lema,
      description: `Despacho de abogados en ${d.direccion.localidad} (${d.direccion.provincia}): extranjería, penal, civil y segunda oportunidad.`,
      url: `${d.dominio}/`,
      image: `${d.dominio}/img/compartir.jpg`,
      logo: `${d.dominio}/img/icono-512.png`,
      telephone: d.telefono.internacional,
      email: d.email,
      founder: { '@id': `${d.dominio}/#abogado` },
      address: {
        '@type': 'PostalAddress',
        streetAddress: d.direccion.calle,
        postalCode: d.direccion.cp,
        addressLocality: d.direccion.localidad,
        addressRegion: d.direccion.provincia,
        addressCountry: 'ES',
      },
      hasMap: d.mapaEnlace,
      openingHoursSpecification: [
        { '@type': 'OpeningHoursSpecification', dayOfWeek: d.horario.dias, opens: d.horario.abre, closes: d.horario.cierra },
      ],
      areaServed: d.zona.map((nombre) => ({ '@type': 'Place', name: nombre })),
      knowsAbout: ['Extranjería', 'Derecho penal', 'Derecho civil', 'Ley de Segunda Oportunidad'],
      contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', telephone: d.telefono.internacional, availableLanguage: 'es' },
      sameAs: Object.values(d.redes),
    },
    {
      '@type': 'Person',
      '@id': `${d.dominio}/#abogado`,
      name: d.titular,
      jobTitle: 'Abogado',
      url: `${d.dominio}/sobre-mi/`,
      image: `${d.dominio}/img/adonis-retrato-840.webp`,
      worksFor: { '@id': `${d.dominio}/#despacho` },
      memberOf: { '@type': 'Organization', name: d.colegio },
    },
    { '@type': 'WebSite', '@id': `${d.dominio}/#sitio`, url: `${d.dominio}/`, name: d.marca, inLanguage: 'es', publisher: { '@id': `${d.dominio}/#despacho` } },
    {
      '@type': 'WebPage',
      '@id': `${url}#pagina`,
      url,
      name: meta.titulo,
      description: meta.descripcion,
      inLanguage: 'es',
      isPartOf: { '@id': `${d.dominio}/#sitio` },
      about: { '@id': `${d.dominio}/#despacho` },
    },
  ];
  if (meta.miga) {
    grafo.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${d.dominio}/` },
        { '@type': 'ListItem', position: 2, name: meta.miga, item: url },
      ],
    });
  }
  const preguntas = [...contenido.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  if (preguntas.length) {
    grafo.push({
      '@type': 'FAQPage',
      mainEntity: preguntas.map(([, pregunta, respuesta]) => ({
        '@type': 'Question',
        name: sinEtiquetas(pregunta),
        acceptedAnswer: { '@type': 'Answer', text: sinEtiquetas(respuesta) },
      })),
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': grafo }, null, 2).replace(/</g, '\\u003c');
}

// ── Mini motor de plantillas ───────────────────────────────────────────────
//   {{dato}} o {{telefono.visible}}  → valor (protegido para HTML)
//   {{{dato}}}                       → valor tal cual (para trozos de HTML)
//   {{> nombre}}                     → incluye plantillas/nombre.html
function valor(contexto, clave) {
  const v = clave.split('.').reduce((o, k) => (o == null ? undefined : o[k]), contexto);
  if (v === undefined) throw new Error(`Falta el dato «${clave}» (revisa datos.json o la cabecera de la página)`);
  return v;
}
function pintar(plantilla, contexto) {
  return plantilla
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, nombre) => pintar(leer('plantillas', `${nombre}.html`), contexto))
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, clave) => String(valor(contexto, clave)))
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, clave) => escapar(valor(contexto, clave)));
}

// Cada página empieza con una cabecera entre líneas "---" (titulo, descripcion, ruta, menu)
function leerPagina(archivo) {
  const texto = readFileSync(archivo, 'utf8');
  const m = texto.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`A ${archivo} le falta la cabecera entre líneas ---`);
  const meta = {};
  for (const linea of m[1].split('\n')) {
    const i = linea.indexOf(':');
    if (i > 0) meta[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
  }
  for (const campo of ['titulo', 'descripcion', 'ruta']) {
    if (!meta[campo]) throw new Error(`A ${archivo} le falta «${campo}» en la cabecera`);
  }
  return { meta, cuerpo: m[2] };
}

function listar(carpeta) {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listar(join(carpeta, e.name)) : [join(carpeta, e.name)]
  );
}

function construir() {
  const datos = cargarDatos();
  const base = leer('plantillas', 'base.html');
  rmSync(SALIDA, { recursive: true, force: true });
  mkdirSync(SALIDA, { recursive: true });
  cpSync(join(RAIZ, 'estaticos'), SALIDA, { recursive: true });

  const rutas = [];
  for (const archivo of listar(join(RAIZ, 'paginas')).filter((a) => a.endsWith('.html'))) {
    const { meta, cuerpo } = leerPagina(archivo);
    const contexto = {
      ...datos,
      pagina: {
        menu: '',
        ...meta,
        url: datos.dominio + meta.ruta,
        // "buscadores: no" en la cabecera de una página pide a Google que no la muestre
        robots: meta.buscadores === 'no' ? '<meta name="robots" content="noindex">' : '',
      },
    };
    contexto.contenido = pintar(cuerpo, contexto);
    contexto.jsonld = datosEstructurados(datos, meta, contexto.contenido);
    let html = pintar(base, contexto);
    // Marca en el menú la página en la que estamos
    if (meta.menu) html = html.replaceAll(`data-menu="${meta.menu}"`, `data-menu="${meta.menu}" aria-current="page"`);

    const destino = join(SALIDA, meta.ruta, meta.ruta.endsWith('/') ? 'index.html' : '');
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, html);
    if (meta.buscadores !== 'no') rutas.push(meta.ruta);
    console.log(`  ✓ ${meta.ruta}   (${relative(RAIZ, archivo).split(sep).join('/')})`);
  }

  const hoy = new Date().toISOString().slice(0, 10);
  writeFileSync(
    join(SALIDA, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      rutas.sort().map((r) => `  <url><loc>${datos.dominio}${r}</loc><lastmod>${hoy}</lastmod></url>`).join('\n') +
      `\n</urlset>\n`
  );
  writeFileSync(join(SALIDA, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${datos.dominio}/sitemap.xml\n`);
  console.log(`Web generada en la carpeta «sitio» (${rutas.length} páginas).`);
  return datos;
}

// ── Datos que faltan antes de poder publicar ───────────────────────────────
function revisarPendientes(datos) {
  const obligatorios = [];
  if (datos.numColegiado.includes('[')) obligatorios.push('el nº de colegiado («numColegiado» en datos.json)');
  if (datos.nif.includes('[')) obligatorios.push('el NIF («nif» en datos.json)');
  const avisos = [];
  if (datos.formulario.claveWeb3Forms === 'ACCESS_KEY')
    avisos.push('la clave del formulario («claveWeb3Forms» en datos.json): hasta entonces el formulario no envía mensajes');

  for (const a of avisos) console.log(`AVISO: falta ${a}.`);
  for (const o of obligatorios) console.log(`PENDIENTE: falta ${o}.`);
  if (obligatorios.length && process.argv.includes('--publicar')) {
    console.error('\nNO SE PUBLICA: el aviso legal estaría incompleto. Rellena los datos pendientes y vuelve a intentarlo.');
    process.exit(1);
  }
  if (obligatorios.length) console.log('La web se puede ver en este ordenador, pero NO debe publicarse todavía.');
}

// ── Servidor para ver la web en el ordenador antes de publicar ─────────────
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};
function servir(puerto = 4173) {
  createServer((peticion, respuesta) => {
    let ruta = decodeURIComponent(new URL(peticion.url, 'http://x').pathname);
    let archivo = join(SALIDA, ruta);
    if (!archivo.startsWith(SALIDA)) { respuesta.writeHead(403).end(); return; }
    if (existsSync(archivo) && statSync(archivo).isDirectory()) archivo = join(archivo, 'index.html');
    if (!existsSync(archivo)) { respuesta.writeHead(404, { 'content-type': TIPOS['.html'] }).end(readFileSync(join(SALIDA, '404.html'))); return; }
    respuesta.writeHead(200, { 'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream' });
    respuesta.end(readFileSync(archivo));
  }).listen(puerto, () => console.log(`Abre en el navegador: http://localhost:${puerto}`));
}

revisarPendientes(construir());
if (process.argv.includes('--ver')) servir();
