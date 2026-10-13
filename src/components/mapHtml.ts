/**
 * A página do mapa do Android (MapLibre GL JS + OpenFreeMap dentro de um
 * WebView). Fica num arquivo próprio, sem nada de React Native, porque é só
 * texto: HTML/CSS/JS puro que roda dentro do WebView.
 *
 * O que ela faz além de mostrar o mapa: **pinta o mapa com as cores do
 * Trainly**. O OpenFreeMap entrega o estilo "dark"/"positron" em tons de
 * cinza neutro; antes de criar o mapa, a página baixa esse estilo (um JSON) e
 * troca as cores de cada camada pelas da paleta abaixo — fundo violeta-noite,
 * água mais funda, parques num verde escuro, ruas em lilás, nomes em lavanda.
 * Como a troca acontece ANTES do primeiro desenho, não existe aquele
 * "piscar" do mapa cinza virando roxo.
 *
 * Também esconde os pontos comerciais (lojas, restaurantes...) — num app de
 * corrida eles só poluem — e desenha o trajeto com um brilho por baixo.
 */

export interface MapPalette {
  bg: string;
  land: string;
  park: string;
  water: string;
  building: string;
  buildingLine: string;
  road: string;
  roadMajor: string;
  roadCasing: string;
  motorway: string;
  motorwayCasing: string;
  path: string;
  rail: string;
  boundary: string;
  label: string;
  waterLabel: string;
  halo: string;
}

export const MAP_PALETTE: Record<'dark' | 'light', MapPalette> = {
  dark: {
    bg: '#140f2a',
    land: '#18122f',
    park: '#132620',
    water: '#0a0a1d',
    building: '#1e1839',
    buildingLine: '#28204b',
    road: '#2a2350',
    roadMajor: '#382e6c',
    roadCasing: '#1a1435',
    motorway: '#4a3d8f',
    motorwayCasing: '#231c45',
    path: '#2f2758',
    rail: '#272049',
    boundary: '#3d3474',
    label: '#8f87ba',
    waterLabel: '#5d6db0',
    halo: '#140f2a',
  },
  light: {
    bg: '#f3f1fb',
    land: '#eeebf9',
    park: '#dcefe3',
    water: '#ccd7f6',
    building: '#e6e2f5',
    buildingLine: '#d9d3ef',
    road: '#ffffff',
    roadMajor: '#ffffff',
    roadCasing: '#d6d0ec',
    motorway: '#fff4d6',
    motorwayCasing: '#e6d7a8',
    path: '#e1dcf2',
    rail: '#d4cdea',
    boundary: '#c5bce4',
    label: '#655d8c',
    waterLabel: '#5568ab',
    halo: '#f3f1fb',
  },
};

/**
 * Estilos do OpenFreeMap — gratuitos, sem chave, sem cadastro, sem limite de
 * uso (conferido em openfreemap.org).
 */
export const STYLE_URL = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
} as const;

// A partir da v6, o MapLibre GL JS passou a publicar só módulo ES
// (`dist/maplibre-gl.mjs`) — o `dist/maplibre-gl.js` (UMD, o que esta página
// carrega com uma <script src> comum) não existe mais a partir daí, e pedir
// esse caminho em v6 dá 404 (confirmado ao vivo em unpkg.com depois que o
// mapa do Android falhou num aparelho real com "Mapa sem conexão" mesmo com
// internet normal). A v5.24.0 é a mais recente que ainda publica o UMD.
export const MAPLIBRE_VERSION = '5.24.0';

/** Onde o mapa abre antes do GPS responder (centro de São Paulo). */
export const DEFAULT_MAP_CENTER = { latitude: -23.55, longitude: -46.63 };
/** Zoom de "rua" — o enquadramento certo pra acompanhar uma corrida. */
export const RUN_ZOOM = 16;

/**
 * Gera a página. A comunicação com o React Native é só `postMessage`/
 * `onMessage`: a página entende os comandos `center`, `path`, `paths`,
 * `markers`, `bounds` e `padding`, e avisa `ready` (pronta) ou `error`.
 *
 * Atenção às coordenadas: o MapLibre (como todo software baseado em GeoJSON)
 * usa `[longitude, latitude]` — o contrário do `{ latitude, longitude }` do
 * resto do app. A conversão acontece só na borda, em `TrainlyMap.tsx`.
 */
export function buildMapHtml(mode: 'dark' | 'light', options?: { styleUrl?: string; libBase?: string }): string {
  const palette = MAP_PALETTE[mode];
  const styleUrl = options?.styleUrl ?? STYLE_URL[mode];
  const lib = options?.libBase ?? `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist`;
  const dark = mode === 'dark';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="${lib}/maplibre-gl.css" onerror="trainlyFail()" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: ${palette.bg}; }
  .tl-pin { position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; }
  .tl-halo { position: absolute; inset: 0; border-radius: 50%; }
  .tl-core { position: relative; width: 24px; height: 24px; border-radius: 50%; border: 2.5px solid #fff; box-sizing: border-box;
             display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.35); }
  .tl-core svg { width: 12px; height: 12px; fill: #fff; }
  .tl-me { position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; }
  .tl-me-pulse { position: absolute; width: 40px; height: 40px; border-radius: 50%; animation: tlpulse 1.8s ease-out infinite; }
  .tl-me-dot { position: relative; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #fff; box-sizing: border-box;
               box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
  @keyframes tlpulse { 0% { transform: scale(0.35); opacity: 0.55; } 100% { transform: scale(1); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .tl-me-pulse { animation: none; opacity: 0.25; } }
  .maplibregl-ctrl-attrib { font-size: 10px; }
  .maplibregl-ctrl-attrib.maplibregl-compact { background: ${dark ? 'rgba(20,15,42,0.75)' : 'rgba(255,255,255,0.8)'}; }
  .maplibregl-ctrl-attrib a { color: ${palette.label}; }
</style>
</head>
<body>
<div id="map"></div>
<script src="${lib}/maplibre-gl.js" onerror="trainlyFail()"></script>
<script>
  var P = ${JSON.stringify(palette)};

  function post(payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  var failed = false;
  function trainlyFail() {
    if (failed) return;
    failed = true;
    post({ type: 'error' });
  }

  // Se o script não carregar (sem internet) o navegador chama 'onerror'
  // acima na maioria dos casos, mas por garantia também checamos depois de
  // um tempo: se 'maplibregl' nunca apareceu, é porque o script não rodou.
  var trainlyBootTimeout = setTimeout(function () {
    if (typeof maplibregl === 'undefined') trainlyFail();
  }, 9000);

  // ---- Pintura do estilo com as cores do Trainly -------------------------
  function paint(layer, prop, value) {
    layer.paint = layer.paint || {};
    layer.paint[prop] = value;
  }
  function hide(layer) {
    layer.layout = layer.layout || {};
    layer.layout.visibility = 'none';
  }
  function themeStyle(style) {
    (style.layers || []).forEach(function (l) {
      var id = String(l.id || '');
      try {
        if (l.type === 'background') {
          paint(l, 'background-color', P.bg);
        } else if (l.type === 'raster' || l.type === 'hillshade') {
          hide(l);
        } else if (l.type === 'fill') {
          if (/water/.test(id)) paint(l, 'fill-color', P.water);
          else if (/ice|glacier/.test(id)) paint(l, 'fill-color', P.land);
          else if (/park|wood|grass|forest|green|cemetery|pitch|golf|landcover/.test(id)) paint(l, 'fill-color', P.park);
          else if (/building/.test(id)) { paint(l, 'fill-color', P.building); paint(l, 'fill-outline-color', P.buildingLine); }
          else if (/aeroway|road|pier|bridge/.test(id)) paint(l, 'fill-color', P.roadCasing);
          else paint(l, 'fill-color', P.land);
        } else if (l.type === 'fill-extrusion') {
          paint(l, 'fill-extrusion-color', P.building);
        } else if (l.type === 'line') {
          if (/water/.test(id)) paint(l, 'line-color', P.water);
          else if (/boundary|admin/.test(id)) paint(l, 'line-color', P.boundary);
          else if (/rail|transit/.test(id)) paint(l, 'line-color', /dash|hatch/.test(id) ? P.bg : P.rail);
          else if (/pier/.test(id)) paint(l, 'line-color', P.bg);
          else if (/casing|outline/.test(id)) paint(l, 'line-color', /motorway|trunk/.test(id) ? P.motorwayCasing : P.roadCasing);
          else if (/motorway|trunk/.test(id)) paint(l, 'line-color', P.motorway);
          else if (/major|primary|secondary|tertiary/.test(id)) paint(l, 'line-color', P.roadMajor);
          else if (/path|track|pedestrian|footway|cycle|steps/.test(id)) paint(l, 'line-color', P.path);
          else paint(l, 'line-color', P.road);
        } else if (l.type === 'symbol') {
          // Lojas, restaurantes, ícones de comércio: num app de treino só poluem.
          if (/poi|shop|food/.test(id)) { hide(l); return; }
          if (l.layout && l.layout['text-field']) {
            paint(l, 'text-color', /water/.test(id) ? P.waterLabel : P.label);
            paint(l, 'text-halo-color', P.halo);
          }
        }
      } catch (e) {}
    });
    return style;
  }

  // ---- Elementos dos marcadores ------------------------------------------
  var ICONS = {
    start: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
    finish: '<svg viewBox="0 0 24 24"><path d="M6 3h1.8v1.2H19l-2.4 4.2L19 12.6H7.8V21H6z"/></svg>'
  };
  function pinElement(m) {
    if (m.variant === 'current') {
      var me = document.createElement('div');
      me.className = 'tl-me';
      me.innerHTML = '<div class="tl-me-pulse"></div><div class="tl-me-dot"></div>';
      me.firstChild.style.background = m.color;
      me.lastChild.style.background = m.color;
      return me;
    }
    var wrap = document.createElement('div');
    wrap.className = 'tl-pin';
    wrap.innerHTML = '<div class="tl-halo"></div><div class="tl-core">' + (ICONS[m.variant] || ICONS.start) + '</div>';
    wrap.firstChild.style.background = m.color;
    wrap.firstChild.style.opacity = '0.25';
    wrap.lastChild.style.background = m.color;
    return wrap;
  }

  function lineFeature(coords) {
    return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords || [] } };
  }

  function boot(style) {
    var map = new maplibregl.Map({
      container: 'map',
      style: style,
      center: [${DEFAULT_MAP_CENTER.longitude}, ${DEFAULT_MAP_CENTER.latitude}],
      zoom: ${RUN_ZOOM},
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();

    var loaded = false;
    var queue = [];
    var routeId = 'trainly-route';
    var markerObjs = {};
    var overlays = {};

    function setRoute(msg) {
      var data = lineFeature(msg.coords && msg.coords.length > 1 ? msg.coords : []);
      var src = map.getSource(routeId);
      if (src) {
        src.setData(data);
      } else {
        map.addSource(routeId, { type: 'geojson', data: data });
        // Três camadas: brilho largo e borrado, contorno escuro e a linha na
        // cor da patente — a rota "acende" em cima do mapa escuro.
        map.addLayer({ id: routeId + '-glow', type: 'line', source: routeId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': msg.color, 'line-width': 16, 'line-opacity': 0.28, 'line-blur': 7 } });
        map.addLayer({ id: routeId + '-casing', type: 'line', source: routeId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': msg.casing, 'line-width': 8.5 } });
        map.addLayer({ id: routeId + '-line', type: 'line', source: routeId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': msg.color, 'line-width': 4.5 } });
      }
      map.setPaintProperty(routeId + '-glow', 'line-color', msg.color);
      map.setPaintProperty(routeId + '-line', 'line-color', msg.color);
      map.setPaintProperty(routeId + '-casing', 'line-color', msg.casing);
    }

    function setOverlays(msg) {
      var seen = {};
      (msg.paths || []).forEach(function (p) {
        seen[p.id] = true;
        var id = 'trainly-ov-' + p.id;
        var data = lineFeature(p.coords);
        var src = map.getSource(id);
        if (src) {
          src.setData(data);
        } else {
          map.addSource(id, { type: 'geojson', data: data });
          map.addLayer({ id: id + '-glow', type: 'line', source: id,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': p.color, 'line-width': 10, 'line-opacity': 0.22, 'line-blur': 4 } });
          map.addLayer({ id: id + '-line', type: 'line', source: id,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': p.color, 'line-width': 3.5, 'line-opacity': 0.95 } });
        }
        map.setPaintProperty(id + '-glow', 'line-color', p.color);
        map.setPaintProperty(id + '-line', 'line-color', p.color);
      });
      Object.keys(overlays).forEach(function (key) {
        if (seen[key]) return;
        var old = 'trainly-ov-' + key;
        if (map.getLayer(old + '-line')) map.removeLayer(old + '-line');
        if (map.getLayer(old + '-glow')) map.removeLayer(old + '-glow');
        if (map.getSource(old)) map.removeSource(old);
      });
      overlays = seen;
    }

    function setMarkers(msg) {
      var seen = {};
      (msg.markers || []).forEach(function (m) {
        seen[m.id] = true;
        var key = m.variant + '|' + m.color;
        var existing = markerObjs[m.id];
        if (existing && existing.key === key) {
          existing.marker.setLngLat([m.lng, m.lat]);
          return;
        }
        if (existing) existing.marker.remove();
        var marker = new maplibregl.Marker({ element: pinElement(m), anchor: 'center' })
          .setLngLat([m.lng, m.lat])
          .addTo(map);
        markerObjs[m.id] = { marker: marker, key: key };
      });
      Object.keys(markerObjs).forEach(function (id) {
        if (!seen[id]) { markerObjs[id].marker.remove(); delete markerObjs[id]; }
      });
    }

    function handleCommand(msg) {
      if (!loaded && msg.type !== 'center' && msg.type !== 'padding') { queue.push(msg); return; }
      if (msg.type === 'center') {
        if (msg.animate) map.easeTo({ center: [msg.lng, msg.lat], zoom: msg.zoom, duration: 900 });
        else map.jumpTo({ center: [msg.lng, msg.lat], zoom: msg.zoom });
      } else if (msg.type === 'padding') {
        // Área do mapa coberta por painéis do app: o centro e o enquadramento
        // passam a considerar só a parte visível, e a atribuição sobe junto.
        map.setPadding({ top: msg.top || 0, bottom: msg.bottom || 0, left: 0, right: 0 });
        var css = document.getElementById('tl-pad') || document.createElement('style');
        css.id = 'tl-pad';
        css.textContent = '.maplibregl-ctrl-bottom-left,.maplibregl-ctrl-bottom-right{bottom:' + (msg.bottom || 0) + 'px}'
          + '.maplibregl-ctrl-top-left,.maplibregl-ctrl-top-right{top:' + (msg.top || 0) + 'px}';
        document.head.appendChild(css);
      } else if (msg.type === 'path') {
        setRoute(msg);
      } else if (msg.type === 'paths') {
        setOverlays(msg);
      } else if (msg.type === 'markers') {
        setMarkers(msg);
      } else if (msg.type === 'bounds') {
        map.fitBounds([msg.west, msg.south, msg.east, msg.north], { padding: 56, duration: 900, maxZoom: 17 });
      }
    }

    function onMessage(event) {
      try { handleCommand(JSON.parse(event.data)); } catch (e) {}
    }
    // Android entrega no 'document', iOS entrega no 'window' — este
    // componente só roda no Android, mas registrar os dois é a forma
    // recomendada pelo próprio react-native-webview e não custa nada.
    document.addEventListener('message', onMessage);
    window.addEventListener('message', onMessage);
    window.trainlyCommand = handleCommand;

    map.on('load', function () {
      loaded = true;
      queue.splice(0).forEach(handleCommand);
      post({ type: 'ready' });
    });

    // Depois que o mapa já carregou uma vez, um erro isolado (ex: um único
    // tile que falhou ao buscar durante um arrasto) não deve derrubar o
    // mapa inteiro pra tela de "sem conexão" — só um erro ANTES do
    // primeiro carregamento (o estilo inteiro não veio) é motivo real.
    map.on('error', function () {
      if (!loaded) trainlyFail();
    });
  }

  window.addEventListener('load', function () {
    try {
      if (typeof maplibregl === 'undefined') { trainlyFail(); return; }
      clearTimeout(trainlyBootTimeout);
      fetch('${styleUrl}')
        .then(function (r) { if (!r.ok) throw new Error('style ' + r.status); return r.json(); })
        .then(function (style) { boot(themeStyle(style)); })
        .catch(function () {
          // Se só a "pintura" falhar por algum motivo, ainda vale mostrar o
          // mapa com as cores originais do OpenFreeMap em vez de nada.
          try { boot('${styleUrl}'); } catch (e) { trainlyFail(); }
        });
    } catch (e) {
      trainlyFail();
    }
  });
</script>
</body>
</html>`;
}
