import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import NativeMapView, { Marker as NativeMarker, Polyline as NativePolyline } from 'react-native-maps';
// Só do caminho público (`from 'react-native-webview'`), nunca de um
// subcaminho interno como `react-native-webview/lib/WebView` — ver o
// comentário mais longo perto de `TrainlyWebViewProps` abaixo pro motivo.
import { WebView as WebViewImpl } from 'react-native-webview';
import { useTheme } from '../theme/ThemeContext';
import { TrainlyButton } from './TrainlyButton';

/**
 * O mapa do Trainly.
 *
 * Usa DUAS implementações, escolhidas por plataforma — porque a resposta
 * certa pra "mapa grátis" não é a mesma nos dois sistemas:
 *
 * - **iOS**: mapa NATIVO do `react-native-maps`, sem `provider` definido, o
 *   que faz o iPhone usar o Apple Maps. O Apple Maps é parte do sistema
 *   operacional — não pede chave, não pede cadastro, e o `react-native-maps`
 *   já vem pré-compilado dentro do Expo Go (é um dos poucos módulos nativos
 *   de terceiros que o Expo Go inclui de fábrica). É o mesmo mapa que o app
 *   já usava antes de qualquer uma dessas mudanças.
 *
 * - **Android**: não existe equivalente ao Apple Maps — o único provedor
 *   nativo do `react-native-maps` no Android é o Google Maps, que exige
 *   chave (e cartão cadastrado pra ativar a chave, mesmo de graça). Pra
 *   fugir disso sem cair numa biblioteca nativa alternativa (que quebraria
 *   o Expo Go, como o MapLibre nativo quebrou), o mapa aqui é uma página
 *   com **MapLibre GL JS** (biblioteca de mapa em JavaScript puro, sem nada
 *   nativo) dentro de um `WebView` — e o `WebView` esse sim já vem de
 *   fábrica no Expo Go. Os tiles são do **OpenFreeMap**: gratuito, sem
 *   chave, sem cadastro e sem limite de uso (https://openfreemap.org).
 *
 * Um aviso sobre esse último ponto: a primeira versão deste componente
 * usava tiles da CARTO (`basemaps.cartocdn.com`), que na época pareciam
 * gratuitos sem chave — mas a CARTO passou a exigir uma chave de API pra
 * qualquer uso, e isso só apareceu como o aviso "API KEY REQUIRED" escrito
 * por cima do mapa, direto no aparelho. O OpenFreeMap foi escolhido desta
 * vez depois de reconferir, ao vivo, a política deles: sem chave, sem
 * cadastro, sem cookie, sem limite — é a fundação certa pra não repetir o
 * mesmo problema.
 *
 * O resto do app nunca vê essa divisão: as duas implementações expõem
 * exatamente a mesma interface (`center`, `path`, `markers`, `bounds`...),
 * então `RunScreen` e `RouteDetailScreen` usam `<TrainlyMap>` sem saber (nem
 * precisar saber) qual das duas está rodando por baixo.
 */

export type LatLon = { latitude: number; longitude: number };

export interface TrainlyBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export type PinVariant = 'start' | 'finish' | 'current';

export interface TrainlyMarker {
  id: string;
  coord: LatLon;
  variant: PinVariant;
}

/** Zoom de "rua" — o enquadramento certo pra acompanhar uma corrida. */
export const RUN_ZOOM = 16;

/**
 * Onde o mapa fica enquanto o GPS ainda não respondeu. Sem isso ele abriria
 * numa vista do mundo inteiro (ou no meio do oceano) no primeiro instante.
 */
const DEFAULT_CENTER: LatLon = { latitude: -23.55, longitude: -46.63 };

/**
 * Caixa mínima, em graus, ao enquadrar um trajeto (~150 m). Sem isso, uma
 * corrida curta (ou um ponto só) vira uma caixa de área zero e o mapa tenta
 * dar um zoom infinito nela.
 */
const MIN_BOUNDS_SPAN = 0.0015;

/**
 * Menor retângulo que contém o trajeto inteiro, pronto pro `bounds` do mapa.
 * Devolve `undefined` quando não há pontos — aí a tela usa um centro fixo.
 */
export function boundsOf(coords: LatLon[]): TrainlyBounds | undefined {
  const first = coords[0];
  if (!first) return undefined;

  let west = first.longitude;
  let east = first.longitude;
  let south = first.latitude;
  let north = first.latitude;

  for (const c of coords) {
    if (c.longitude < west) west = c.longitude;
    if (c.longitude > east) east = c.longitude;
    if (c.latitude < south) south = c.latitude;
    if (c.latitude > north) north = c.latitude;
  }

  const padLon = Math.max(0, (MIN_BOUNDS_SPAN - (east - west)) / 2);
  const padLat = Math.max(0, (MIN_BOUNDS_SPAN - (north - south)) / 2);

  return { south: south - padLat, west: west - padLon, north: north + padLat, east: east + padLon };
}

function fillForVariant(variant: PinVariant, colors: { success: string; danger: string; primary: string }): string {
  return variant === 'start' ? colors.success : variant === 'finish' ? colors.danger : colors.primary;
}

export interface TrainlyMapProps {
  style?: StyleProp<ViewStyle>;
  /** Centro do mapa. Ignorado (depois do primeiro enquadramento) quando `bounds` é informado. */
  center?: LatLon | null;
  /** Enquadra um trajeto inteiro em vez de centralizar num ponto. */
  bounds?: TrainlyBounds;
  zoom?: number;
  /** Trajeto a desenhar no mapa, já na ordem em que foi percorrido. */
  path?: LatLon[];
  pathColor?: string;
  /** Marcadores (início, fim, posição atual). */
  markers?: TrainlyMarker[];
  /**
   * Quando true, o mapa desliza suavemente até o novo centro em vez de
   * saltar. É o que queremos durante a corrida, em que o centro muda a cada
   * ponto do GPS.
   */
  followSmoothly?: boolean;
  /**
   * Texto curto explicando que o resto da tela continua funcionando, usado no
   * aviso que aparece quando o mapa (Android) não carrega.
   */
  offlineHint?: string;
}

export function TrainlyMap(props: TrainlyMapProps) {
  return Platform.OS === 'ios' ? <NativeTrainlyMap {...props} /> : <WebTrainlyMap {...props} />;
}

// ---------------------------------------------------------------------------
// iOS — react-native-maps nativo (Apple Maps, sem chave)
// ---------------------------------------------------------------------------

/** Converte um nível de zoom (padrão "web mercator", o mesmo do Leaflet/MapLibre) num delta de região. */
function deltaForZoom(zoom: number): number {
  return 360 / Math.pow(2, zoom);
}

function NativeTrainlyMap({ style, center, bounds, zoom = RUN_ZOOM, path, pathColor, markers }: TrainlyMapProps) {
  const { colors } = useTheme();
  const mapRef = useRef<NativeMapView>(null);
  const didInitialMove = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (bounds) {
      map.fitToCoordinates(
        [
          { latitude: bounds.south, longitude: bounds.west },
          { latitude: bounds.north, longitude: bounds.east },
        ],
        { edgePadding: { top: 60, right: 50, bottom: 60, left: 50 }, animated: true },
      );
      return;
    }

    if (!center) return;
    const delta = deltaForZoom(zoom);
    const region = {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
    // Primeiro posicionamento salta direto (sem animação) — depois disso,
    // o `followSmoothly` de quem chama decide se os próximos são suaves.
    // (A primeira posição também já vem certa via `initialRegion` abaixo;
    // isto aqui só cobre o caso de `center` chegar/mudar depois do mount.)
    map.animateToRegion(region, didInitialMove.current ? 900 : 0);
    didInitialMove.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds, center?.latitude, center?.longitude, zoom]);

  const initialCenter = center ?? DEFAULT_CENTER;
  const initialDelta = deltaForZoom(zoom);

  return (
    <NativeMapView
      ref={mapRef}
      style={style}
      // Sem `provider`: no iOS o padrão já é o Apple Maps, que não pede
      // chave. (No Android este componente nem é usado — ver `WebTrainlyMap`.)
      initialRegion={{
        latitude: initialCenter.latitude,
        longitude: initialCenter.longitude,
        latitudeDelta: initialDelta,
        longitudeDelta: initialDelta,
      }}
      showsUserLocation
    >
      {path && path.length > 1 && (
        <>
          {/* Contorno mais grosso por baixo: dá contraste em cima de ruas
              claras ou de parques verdes, onde só a linha colorida sumiria. */}
          <NativePolyline coordinates={path} strokeColor={colors.background} strokeWidth={9} lineCap="round" lineJoin="round" />
          <NativePolyline coordinates={path} strokeColor={pathColor ?? colors.primary} strokeWidth={5} lineCap="round" lineJoin="round" />
        </>
      )}
      {(markers ?? []).map((m) => (
        <NativeMarker key={m.id} coordinate={m.coord} tracksViewChanges={false}>
          <View style={[nativeStyles.pinRing, { borderColor: fillForVariant(m.variant, colors) }]}>
            <View style={[nativeStyles.pinDot, { backgroundColor: fillForVariant(m.variant, colors) }]} />
          </View>
        </NativeMarker>
      ))}
    </NativeMapView>
  );
}

const nativeStyles = StyleSheet.create({
  pinRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: { width: 8, height: 8, borderRadius: 4 },
});

// ---------------------------------------------------------------------------
// Android — MapLibre GL JS + OpenFreeMap, dentro de um WebView
// ---------------------------------------------------------------------------

export interface WebViewRef {
  postMessage: (message: string) => void;
  injectJavaScript: (script: string) => void;
}

/** Evento de `onMessage`. Só o campo que este componente usa. */
export interface TrainlyWebViewMessageEvent {
  nativeEvent: { data: string };
}

/**
 * Só as props que este componente realmente passa pro WebView, tipadas à
 * mão em vez de importadas do pacote.
 *
 * Por quê: a tipagem publicada pelo `react-native-webview` tem
 * inconsistências entre o arquivo que o TypeScript resolve por padrão e o
 * componente que ele realmente exporta, e um jeito de contornar isso
 * (importar de um subcaminho interno como `lib/WebView`) troca um problema
 * por outro pior — esse subcaminho resolve diferente no Metro (o
 * empacotador que roda no celular) dependendo do ambiente, e já quebrou um
 * build real por causa disso. A saída mais segura contra as duas coisas:
 * importar o COMPONENTE (valor, em tempo de execução) só do caminho
 * público — o mesmo que qualquer tutorial usa — e tipar as props aqui, sem
 * depender de nenhum arquivo `.d.ts` interno do pacote.
 */
interface TrainlyWebViewProps {
  style?: StyleProp<ViewStyle>;
  source: { html: string };
  onMessage?: (event: TrainlyWebViewMessageEvent) => void;
  onError?: () => void;
  originWhitelist?: string[];
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  bounces?: boolean;
  overScrollMode?: 'auto' | 'always' | 'never';
}

const WebView = WebViewImpl as unknown as React.ForwardRefExoticComponent<
  TrainlyWebViewProps & React.RefAttributes<WebViewRef>
>;

function WebTrainlyMap({
  style,
  center,
  bounds,
  zoom = RUN_ZOOM,
  path,
  pathColor,
  markers,
  followSmoothly = false,
  offlineHint,
}: TrainlyMapProps) {
  const { colors, mode } = useTheme();
  const webviewRef = useRef<WebViewRef>(null);

  // O mapa só falha quando não há internet pra baixar o MapLibre GL JS ou os
  // tiles. O GPS não depende disso, então a corrida continua sendo gravada —
  // o aviso abaixo existe pra deixar isso claro em vez de mostrar uma tela
  // em branco.
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // Trocar a chave força o WebView a recarregar a página do zero.
  const [attempt, setAttempt] = useState(0);

  const html = useMemo(() => buildMapHtml(mode), [mode, attempt]);

  // A página avisa sozinha quando terminou de montar o mapa (ver
  // `buildMapHtml`); só a partir daí é seguro mandar comandos pra ela. Sem
  // esse aviso, um comando mandado cedo demais (antes do MapLibre carregar)
  // seria perdido.
  useEffect(() => {
    setReady(false);
  }, [attempt]);

  useEffect(() => {
    if (!ready) return;
    const lat = center?.latitude ?? DEFAULT_CENTER.latitude;
    const lng = center?.longitude ?? DEFAULT_CENTER.longitude;
    postToMap(webviewRef, { type: 'center', lat, lng, zoom, animate: followSmoothly });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, center?.latitude, center?.longitude, zoom, followSmoothly]);

  useEffect(() => {
    if (!ready) return;
    postToMap(webviewRef, {
      type: 'path',
      coords: (path ?? []).map((p) => [p.longitude, p.latitude]),
      color: pathColor ?? colors.primary,
      casing: colors.background,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, path, pathColor, colors.primary, colors.background]);

  useEffect(() => {
    if (!ready) return;
    postToMap(webviewRef, {
      type: 'markers',
      markers: (markers ?? []).map((m) => ({
        id: m.id,
        lat: m.coord.latitude,
        lng: m.coord.longitude,
        color: fillForVariant(m.variant, colors),
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, markers, colors.success, colors.danger, colors.primary]);

  useEffect(() => {
    if (!ready || !bounds) return;
    postToMap(webviewRef, { type: 'bounds', ...bounds });
  }, [ready, bounds]);

  const handleMessage = (event: TrainlyWebViewMessageEvent) => {
    let msg: { type?: string } = {};
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') setReady(true);
    if (msg.type === 'error') setFailed(true);
  };

  if (failed) {
    return (
      <View style={[fallbackStyles.fallback, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
        <Text style={fallbackStyles.icon}>🗺️</Text>
        <Text style={[fallbackStyles.title, { color: colors.textPrimary }]}>Mapa sem conexão</Text>
        <Text style={[fallbackStyles.body, { color: colors.textMuted }]}>
          {offlineHint ?? 'O desenho do mapa precisa de internet — o resto da tela continua funcionando.'}
        </Text>
        <View style={fallbackStyles.retry}>
          <TrainlyButton
            title="Tentar de novo"
            variant="secondary"
            onPress={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <WebView
      key={attempt}
      ref={webviewRef}
      style={style}
      source={{ html }}
      onMessage={handleMessage}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      // O próprio mapa não tem como rolar a tela — quem rola é o gesto de
      // arrastar dentro do MapLibre. Isso evita um "elástico" estranho quando
      // o dedo desliza até a borda do mapa.
      bounces={false}
      overScrollMode="never"
      // Se a página nem chegar a carregar (sem internet nenhuma), cai aqui
      // também — o script do MapLibre trata a maioria dos outros casos.
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Manda um comando pra dentro da página. Usa `postMessage`, que o script
 * escuta no `document` (Android) e no `window` (iOS, embora este componente
 * só rode no Android — ver o topo do arquivo) — por isso o script gerado em
 * `buildMapHtml` registra os dois, seguindo a recomendação do próprio
 * `react-native-webview`.
 */
function postToMap(ref: React.RefObject<WebViewRef | null>, payload: Record<string, unknown>) {
  ref.current?.postMessage(JSON.stringify(payload));
}

/**
 * Estilos do OpenFreeMap — gratuitos, sem chave, sem cadastro, sem limite de
 * uso (conferido em openfreemap.org). Cada estilo já embute os tiles, as
 * fontes e a atribuição corretos; o MapLibre GL JS desenha tudo isso sozinho
 * a partir da URL abaixo.
 */
const STYLE_URL = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
} as const;

// A partir da v6, o MapLibre GL JS passou a publicar só módulo ES
// (`dist/maplibre-gl.mjs`) — o `dist/maplibre-gl.js` (UMD, o que esta página
// carrega com uma <script src> comum) não existe mais a partir daí, e pedir
// esse caminho em v6 dá 404 (confirmado ao vivo em unpkg.com depois que o
// mapa do Android falhou num aparelho real com "Mapa sem conexão" mesmo com
// internet normal). A v5.24.0 é a mais recente que ainda publica o UMD.
const MAPLIBRE_VERSION = '5.24.0';

/**
 * Gera a página que roda dentro do WebView. É HTML/CSS/JS puro — nenhuma
 * dependência de módulo nativo, por isso funciona no Expo Go.
 *
 * A comunicação com o React Native é só nos dois sentidos já conhecidos de
 * WebView: `postMessage`/`onMessage`. A página nunca precisa saber nada do
 * app — só entende os comandos `center`, `path`, `markers` e `bounds`.
 *
 * Atenção às coordenadas: o MapLibre GL JS (como todo software de mapa
 * baseado em GeoJSON) usa a ordem `[longitude, latitude]` — o oposto do
 * `{ latitude, longitude }` do resto do app. A conversão acontece só na
 * borda, nos `useEffect` do `WebTrainlyMap` acima; daqui pra dentro tudo já
 * chega na ordem que o MapLibre espera.
 */
function buildMapHtml(mode: 'dark' | 'light'): string {
  const styleUrl = mode === 'dark' ? STYLE_URL.dark : STYLE_URL.light;
  const bg = mode === 'dark' ? '#0a0b0f' : '#f4f5f7';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" onerror="trainlyFail()" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: ${bg}; }
  .trainly-pin { width: 20px; height: 20px; border-radius: 10px; border: 3px solid #fff; box-sizing: border-box; }
  .trainly-pin-dot { width: 8px; height: 8px; border-radius: 4px; margin: 3px; }
  .maplibregl-ctrl-attrib { font-size: 10px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js" onerror="trainlyFail()"></script>
<script>
  function post(payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  function trainlyFail() {
    post({ type: 'error' });
  }

  // Se o script não carregar (sem internet) o navegador chama 'onerror'
  // acima na maioria dos casos, mas por garantia também checamos depois de
  // um tempo: se 'maplibregl' nunca apareceu, é porque o script não rodou.
  var trainlyBootTimeout = setTimeout(function () {
    if (typeof maplibregl === 'undefined') trainlyFail();
  }, 9000);

  window.addEventListener('load', function () {
    try {
      if (typeof maplibregl === 'undefined') { trainlyFail(); return; }
      clearTimeout(trainlyBootTimeout);

      var map = new maplibregl.Map({
        container: 'map',
        style: '${styleUrl}',
        center: [${DEFAULT_CENTER.longitude}, ${DEFAULT_CENTER.latitude}],
        zoom: ${RUN_ZOOM},
        attributionControl: true,
      });

      var loaded = false;
      var routeSourceId = 'trainly-route';
      var markerLayers = {};

      function emptyLineString() {
        return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } };
      }

      function pinElement(color) {
        var wrap = document.createElement('div');
        wrap.className = 'trainly-pin';
        wrap.style.background = '#fff';
        wrap.style.borderColor = color;
        var dot = document.createElement('div');
        dot.className = 'trainly-pin-dot';
        dot.style.background = color;
        wrap.appendChild(dot);
        return wrap;
      }

      function handleCommand(msg) {
        if (msg.type === 'center') {
          if (msg.animate) {
            map.flyTo({ center: [msg.lng, msg.lat], zoom: msg.zoom, duration: 900 });
          } else {
            map.jumpTo({ center: [msg.lng, msg.lat], zoom: msg.zoom });
          }
        } else if (msg.type === 'path') {
          var coords = msg.coords || [];
          var source = map.getSource(routeSourceId);
          var feature = coords.length > 1
            ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
            : emptyLineString();
          if (source) {
            source.setData(feature);
          } else {
            map.addSource(routeSourceId, { type: 'geojson', data: feature });
            // Contorno mais grosso por baixo: dá contraste em cima de ruas
            // claras ou de parques verdes, onde só a linha colorida sumiria.
            map.addLayer({
              id: routeSourceId + '-casing', type: 'line', source: routeSourceId,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': msg.casing, 'line-width': 9, 'line-opacity': 0.55 },
            });
            map.addLayer({
              id: routeSourceId + '-line', type: 'line', source: routeSourceId,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': msg.color, 'line-width': 5 },
            });
          }
          if (map.getLayer(routeSourceId + '-line')) {
            map.setPaintProperty(routeSourceId + '-line', 'line-color', msg.color);
            map.setPaintProperty(routeSourceId + '-casing', 'line-color', msg.casing);
          }
        } else if (msg.type === 'markers') {
          var seen = {};
          (msg.markers || []).forEach(function (m) {
            seen[m.id] = true;
            if (markerLayers[m.id]) markerLayers[m.id].remove();
            markerLayers[m.id] = new maplibregl.Marker({ element: pinElement(m.color) })
              .setLngLat([m.lng, m.lat])
              .addTo(map);
          });
          Object.keys(markerLayers).forEach(function (id) {
            if (!seen[id]) { markerLayers[id].remove(); delete markerLayers[id]; }
          });
        } else if (msg.type === 'bounds') {
          map.fitBounds([msg.west, msg.south, msg.east, msg.north], { padding: 50, duration: 900 });
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

      map.on('load', function () {
        loaded = true;
        post({ type: 'ready' });
      });

      // Depois que o mapa já carregou uma vez, um erro isolado (ex: um único
      // tile que falhou ao buscar durante um arrasto) não deve derrubar o
      // mapa inteiro pra tela de "sem conexão" — só um erro ANTES do
      // primeiro carregamento (o estilo inteiro não veio) é motivo real.
      map.on('error', function () {
        if (!loaded) trainlyFail();
      });
    } catch (e) {
      trainlyFail();
    }
  });
</script>
</body>
</html>`;
}

const fallbackStyles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    borderWidth: 1,
  },
  icon: { fontSize: 40, marginBottom: 14 },
  title: { fontSize: 15.5, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  retry: { marginTop: 18, minWidth: 180 },
});
