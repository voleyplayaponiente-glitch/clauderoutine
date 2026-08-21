#!/usr/bin/env python3
"""Empaqueta la web de ALMA PIEBALD en un solo archivo HTML.

El sitio real vive en sitio-alma-piebald/ repartido en index.html, style.css y
app.js. Para publicarlo como artefacto de claude.ai hace falta un archivo unico
y sin etiquetas html/head/body, porque el artefacto pone su propio esqueleto.

Este script hace justo eso, y ademas desactiva la carga del video y de la
portada: en la vista previa esos archivos no existen todavia, asi que la pagina
cae sola en el heroe fijo sin lanzar peticiones que fallen.

    python3 construir-vista-previa.py

Sale preview-alma-piebald.html en la raiz del repositorio, FUERA de la carpeta
que se publica, para que nunca acabe subido al servidor.
"""
import io
import os
import re

RAIZ = os.path.dirname(os.path.abspath(__file__))
SITIO = os.path.join(RAIZ, 'sitio-alma-piebald')
SALIDA = os.path.join(RAIZ, 'preview-alma-piebald.html')

FUENTES = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link href="https://fonts.googleapis.com/css2?'
    'family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&'
    'family=Manrope:wght@400;500;700&'
    'family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">'
)


def leer(*partes):
    with io.open(os.path.join(SITIO, *partes), encoding='utf-8') as f:
        return f.read()


def main():
    html = leer('index.html')
    css = leer('assets', 'style.css')
    js = leer('assets', 'app.js')

    cuerpo = re.search(r'<body[^>]*>(.*)</body>', html, re.S).group(1)
    cuerpo = cuerpo.replace('<script src="assets/app.js"></script>', '')

    # sin video ni portada: que caiga en el heroe fijo y no pida nada a la red
    js = js.replace("var VIDEO_SRC  = 'assets/hero-scrub.mp4';", "var VIDEO_SRC  = '';")
    js = js.replace("var POSTER_SRC = 'assets/hero-poster.jpg';", "var POSTER_SRC = '';")
    js = js.replace("var videoFailed = false;", "var videoFailed = !VIDEO_SRC;")
    js = js.replace("(function preloadPoster() {",
                    "(function preloadPoster() {\n    if (!POSTER_SRC) return;", 1)
    for marca in ("var VIDEO_SRC  = '';", "if (!POSTER_SRC) return;"):
        if marca not in js:
            raise SystemExit('No se pudo desactivar la carga de medios: falta ' + marca)

    # el titulo es el nombre del artefacto en la galeria: solo el nombre
    partes = ['<title>ALMA PIEBALD</title>', FUENTES,
              '<style>\n' + css + '\n</style>', cuerpo.strip(),
              '<script>\n' + js + '\n</script>']
    with io.open(SALIDA, 'w', encoding='utf-8') as f:
        f.write('\n'.join(partes))

    if 'assets/' in '\n'.join(partes):
        raise SystemExit('Quedan referencias a assets/ en la vista previa')
    print('Escrito %s (%d bytes)' % (SALIDA, os.path.getsize(SALIDA)))


if __name__ == '__main__':
    main()
