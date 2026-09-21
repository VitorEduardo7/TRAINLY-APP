import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
// Só do caminho público (`from 'react-native-webview'`), nunca de um
// subcaminho interno como `react-native-webview/lib/WebView`.
//
// Motivo: a tipagem do pacote tem inconsistências entre o arquivo que o
// TypeScript resolve por padrão e o componente que ele realmente exporta —
// e importar de um subcaminho interno pra contornar isso troca um problema
// por outro pior: o Metro (o empacotador que roda no celular) pode resolver
// esse mesmo subcaminho de um jeito diferente do `tsc` dependendo do
// ambiente, e falhar com "Unable to resolve module .../lib/WebView" mesmo
// quando o `tsc` não acusa erro nenhum — foi exatamente o que aconteceu.
//
// Por isso: o COMPONENTE (valor, em tempo de execução) vem só do caminho
// público — o mesmo que qualquer tutorial usa, o mais estável que existe —
// e as props são tipadas à mão logo abaixo (`TrainlyWebViewProps`), sem
// depender de nenhum arquivo `.d.ts` interno do pacote. Assim, nenhuma
// futura mudança de como o pacote organiza seus arquivos internos consegue
// quebrar este componente de novo.
import { WebView as WebViewImpl } from 'react-native-webview';
import { useTheme } from '../theme/ThemeContext';
import { TrainlyButton } from './TrainlyButton';

export interface WebViewRef {
  postMessage: (message: string) => void;
  injectJavaScript: (script: string) => void;
}

/** Evento de `onMessage`. Só o campo que este componente usa. */
export interface TrainlyWebViewMessageEvent {
  nativeEvent: { data: string };
}

/** Só as props que este componente realmente passa pro WebView. */
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

/**
 * O mapa do Trainly.
 *
 * Desenhado com Leaflet.js (biblioteca de mapa em JavaScript puro) dentro de
 * um WebView, usando tiles gratuitos da CARTO (dados do OpenStreetMap).
 *
 * Por que WebView em vez de uma biblioteca de mapa nativa: uma biblioteca
 * nativa (como o `react-native-maps` ou o `@maplibre/maplibre-react-native`)
 * só funciona depois que o app é compilado com o código nativo dela dentro —
 * o que exige gerar um build próprio (EAS Build, ou `expo run:android`) e
 * deixa de funcionar no Expo Go, que já vem pré-compilado com um conjunto
 * fixo de módulos. O `WebView`, ao contrário, é um desses módulos que já vem
 * de fábrica no Expo Go — então o mapa aqui dentro roda sem gerar build
 * nenhum, é só apontar a câmera do celular pro QR code de sempre.
 *
 * O preço dessa escolha: o mapa é uma página web rodando dentro do app, não
 * um componente nativo. Na prática o toque, o arrastar e o zoom com dois
 * dedos funcionam igual — é a mesma engine que desenha páginas no navegador
 * do celular —, mas tecnicamente é isso.
 *
 * Este arquivo esconde os detalhes de como React Native e a página dentro do
 * WebView conversam. O resto do app só vê `<TrainlyMap center={...}
 * path={...} markers={...} />` — nunca uma string de HTML ou uma mensagem
 * postMessage.
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

interface TrainlyMapProps {
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
   * aviso que aparece quando o mapa não carrega.
   */
  offlineHint?: string;
}

export function TrainlyMap({
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

  // O mapa só falha quando não há internet pra baixar o Leaflet ou os tiles.
  // O GPS não depende disso, então a corrida continua sendo gravada — o aviso
  // abaixo existe pra deixar isso claro em vez de mostrar uma tela em branco.
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // Trocar a chave força o WebView a recarregar a página do zero.
  const [attempt, setAttempt] = useState(0);

  const html = useMemo(() => buildMapHtml(mode), [mode, attempt]);

  // A página avisa sozinha quando terminou de montar o mapa (ver
  // `buildMapHtml`); só a partir daí é seguro mandar comandos pra ela. Sem
  // esse aviso, um comando mandado cedo demais (antes do Leaflet carregar)
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
      coords: (path ?? []).map((p) => [p.latitude, p.longitude]),
      color: pathColor ?? colors.primary,
      casing: colors.background,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, path, pathColor, colors.primary, colors.background]);

  useEffect(() => {
    if (!ready) return;
    const fillFor = (variant: PinVariant) =>
      variant === 'start' ? colors.success : variant === 'finish' ? colors.danger : colors.primary;
    postToMap(webviewRef, {
      type: 'markers',
      markers: (markers ?? []).map((m) => ({
        id: m.id,
        lat: m.coord.latitude,
        lng: m.coord.longitude,
        color: fillFor(m.variant),
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
      <View style={[styles.fallback, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Mapa sem conexão</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          {offlineHint ?? 'O desenho do mapa precisa de internet — o resto da tela continua funcionando.'}
        </Text>
        <View style={styles.retry}>
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
      // arrastar dentro do Leaflet. Isso evita um "elástico" estranho quando
      // o dedo desliza até a borda do mapa.
      bounces={false}
      overScrollMode="never"
      // Se a página nem chegar a carregar (sem internet nenhuma), cai aqui
      // também — o script do Leaflet trata a maioria dos outros casos.
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Manda um comando pra dentro da página. Usa `postMessage`, que o Leaflet
 * escuta no `document` (Android) e no `window` (iOS) — por isso o script
 * gerado em `buildMapHtml` registra os dois.
 */
function postToMap(ref: React.RefObject<WebViewRef | null>, payload: Record<string, unknown>) {
  ref.current?.postMessage(JSON.stringify(payload));
}

/**
 * Tiles gratuitos da CARTO — sem chave, sem cadastro, sem limite de uso.
 * Dados do OpenStreetMap; a atribuição no canto do mapa é exigida pela
 * licença dos dados e é desenhada automaticamente pelo Leaflet.
 */
const TILE_URL = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
} as const;

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Gera a página que roda dentro do WebView. É HTML/CSS/JS puro — nenhuma
 * dependência de módulo nativo, por isso funciona no Expo Go.
 *
 * A comunicação com o React Native é só nos dois sentidos já conhecidos de
 * WebView: `postMessage`/`onMessage`. A página nunca precisa saber nada do
 * app — só entende os comandos `center`, `path`, `markers` e `bounds`.
 */
function buildMapHtml(mode: 'dark' | 'light'): string {
  const tileUrl = mode === 'dark' ? TILE_URL.dark : TILE_URL.light;
  const bg = mode === 'dark' ? '#0a0b0f' : '#f4f5f7';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" onerror="trainlyFail()" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: ${bg}; }
  .trainly-pin { width: 20px; height: 20px; border-radius: 10px; border: 3px solid #fff; box-sizing: border-box; }
  .trainly-pin-dot { width: 8px; height: 8px; border-radius: 4px; margin: 3px; }
  .leaflet-control-attribution { font-size: 10px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="trainlyFail()"></script>
<script>
  function post(payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  function trainlyFail() {
    post({ type: 'error' });
  }

  // Se o script do Leaflet não carregar (sem internet) o navegador chama
  // 'onerror' acima na maioria dos casos, mas por garantia também checamos
  // depois de um tempo: se 'L' nunca apareceu, é porque o script não rodou.
  var trainlyBootTimeout = setTimeout(function () {
    if (typeof L === 'undefined') trainlyFail();
  }, 9000);

  window.addEventListener('load', function () {
    try {
      if (typeof L === 'undefined') { trainlyFail(); return; }
      clearTimeout(trainlyBootTimeout);

      var map = L.map('map', {
        center: [${DEFAULT_CENTER.latitude}, ${DEFAULT_CENTER.longitude}],
        zoom: ${RUN_ZOOM},
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('${tileUrl}', {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: '${ATTRIBUTION}',
      }).addTo(map);

      var pathCasing = null;
      var pathLine = null;
      var markerLayers = {};

      function pinIcon(color) {
        return L.divIcon({
          className: '',
          html: '<div class="trainly-pin" style="background:#fff;border-color:' + color + '"><div class="trainly-pin-dot" style="background:' + color + '"></div></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
      }

      function handleCommand(msg) {
        if (msg.type === 'center') {
          if (msg.animate) {
            map.flyTo([msg.lat, msg.lng], msg.zoom, { duration: 0.9 });
          } else {
            map.setView([msg.lat, msg.lng], msg.zoom, { animate: false });
          }
        } else if (msg.type === 'path') {
          if (pathCasing) { map.removeLayer(pathCasing); pathCasing = null; }
          if (pathLine) { map.removeLayer(pathLine); pathLine = null; }
          if (msg.coords && msg.coords.length > 1) {
            // Contorno mais grosso por baixo: dá contraste em cima de ruas
            // claras ou de parques verdes, onde só a linha colorida sumiria.
            pathCasing = L.polyline(msg.coords, {
              color: msg.casing, weight: 9, opacity: 0.55, lineCap: 'round', lineJoin: 'round',
            }).addTo(map);
            pathLine = L.polyline(msg.coords, {
              color: msg.color, weight: 5, lineCap: 'round', lineJoin: 'round',
            }).addTo(map);
          }
        } else if (msg.type === 'markers') {
          var seen = {};
          (msg.markers || []).forEach(function (m) {
            seen[m.id] = true;
            if (markerLayers[m.id]) {
              markerLayers[m.id].setLatLng([m.lat, m.lng]);
              markerLayers[m.id].setIcon(pinIcon(m.color));
            } else {
              markerLayers[m.id] = L.marker([m.lat, m.lng], { icon: pinIcon(m.color) }).addTo(map);
            }
          });
          Object.keys(markerLayers).forEach(function (id) {
            if (!seen[id]) { map.removeLayer(markerLayers[id]); delete markerLayers[id]; }
          });
        } else if (msg.type === 'bounds') {
          map.fitBounds([[msg.south, msg.west], [msg.north, msg.east]], { padding: [50, 50] });
        }
      }

      function onMessage(event) {
        try { handleCommand(JSON.parse(event.data)); } catch (e) {}
      }
      // Android entrega no 'document', iOS entrega no 'window' — registrar
      // os dois é a forma recomendada pelo próprio react-native-webview.
      document.addEventListener('message', onMessage);
      window.addEventListener('message', onMessage);

      post({ type: 'ready' });
    } catch (e) {
      trainlyFail();
    }
  });
</script>
</body>
</html>`;
}

const styles = StyleSheet.create({
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
