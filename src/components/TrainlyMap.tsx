import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NativeMapView, {
  Marker as NativeMarker,
  Polygon as NativePolygon,
  Polyline as NativePolyline,
} from 'react-native-maps';
import type { MKPointOfInterestCategoryType } from 'react-native-maps';
// Só do caminho público (`from 'react-native-webview'`), nunca de um
// subcaminho interno como `react-native-webview/lib/WebView` — ver o
// comentário mais longo perto de `TrainlyWebViewProps` abaixo pro motivo.
import { WebView as WebViewImpl } from 'react-native-webview';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { TrainlyButton } from './TrainlyButton';
import { useReducedMotion } from './Motion';
import { buildMapHtml, DEFAULT_MAP_CENTER, RUN_ZOOM as MAP_RUN_ZOOM } from './mapHtml';

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

/**
 * Um traçado extra, colorido por conta própria — usado só na visão geral do
 * Explorar Rotas, pra desenhar VÁRIAS rotas de uma vez, cada uma na cor da
 * patente de quem a criou (ver `paths` em `TrainlyMapProps`). Diferente do
 * `path`/`pathColor` de cima, que é o traçado ÚNICO da corrida atual ou da
 * rota aberta.
 */
export interface TrainlyPathOverlay {
  id: string;
  coords: LatLon[];
  color: string;
}

export interface TrainlyMarker {
  id: string;
  coord: LatLon;
  variant: PinVariant;
}

/** Zoom de "rua" — o enquadramento certo pra acompanhar uma corrida. */
export const RUN_ZOOM = MAP_RUN_ZOOM;

/**
 * Onde o mapa fica enquanto o GPS ainda não respondeu. Sem isso ele abriria
 * numa vista do mundo inteiro (ou no meio do oceano) no primeiro instante.
 */
const DEFAULT_CENTER: LatLon = DEFAULT_MAP_CENTER;

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

/**
 * Contorno por baixo do traçado: no escuro, a cor de fundo do app (a linha
 * "recorta" o mapa); no claro, um violeta-noite translúcido — sem isso uma
 * patente de cor clara (Prata, por exemplo) sumia em cima do mapa claro.
 */
function routeCasing(mode: 'dark' | 'light', background: string): string {
  return mode === 'dark' ? background : 'rgba(20,15,42,0.5)';
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
  /** Vários traçados de uma vez, cada um com sua própria cor (ver `TrainlyPathOverlay`) — usado no mapa geral do Explorar Rotas em vez de `path`/`pathColor`. */
  paths?: TrainlyPathOverlay[];
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
  /**
   * Quanto do mapa fica coberto por painéis do app (em px), em cima e embaixo.
   * O enquadramento passa a considerar só a parte visível e o selo "Legal"/
   * atribuição do mapa sobe pra não ficar escondido atrás do painel.
   */
  insets?: { top?: number; bottom?: number };
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

/**
 * Só os pontos que interessam a quem treina: parques, praias, pistas,
 * academias, quadras, trilhas, banheiros. Loja, restaurante, banco etc. somem
 * — o traçado fica em destaque em vez de brigar com dezenas de ícones.
 */
const TRAINING_POIS: MKPointOfInterestCategoryType[] = [
  'park',
  'nationalPark',
  'beach',
  'stadium',
  'fitnessCenter',
  'hiking',
  'swimming',
  'soccer',
  'tennis',
  'basketball',
  'volleyball',
  'skatePark',
  'restroom',
];

/**
 * Um retângulo do tamanho do mundo, pintado por cima do mapa (e por baixo
 * do traçado) com a cor de fundo do app em transparência: o Apple Maps não
 * deixa trocar as cores do mapa, então isso "tinge" o mapa escuro de
 * violeta-noite (e o claro de lavanda) — ele passa a parecer parte do
 * Trainly em vez de um mapa genérico colado na tela.
 */
const WORLD: LatLon[] = [
  { latitude: -85, longitude: -179.99 },
  { latitude: 85, longitude: -179.99 },
  { latitude: 85, longitude: 179.99 },
  { latitude: -85, longitude: 179.99 },
];

function NativeTrainlyMap({
  style,
  center,
  bounds,
  zoom = RUN_ZOOM,
  path,
  pathColor,
  paths,
  markers,
  insets,
}: TrainlyMapProps) {
  const { colors, mode } = useTheme();
  const mapRef = useRef<NativeMapView>(null);
  const didInitialMove = useRef(false);
  const padTop = insets?.top ?? 0;
  const padBottom = insets?.bottom ?? 0;
  const dark = mode === 'dark';

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (bounds) {
      map.fitToCoordinates(
        [
          { latitude: bounds.south, longitude: bounds.west },
          { latitude: bounds.north, longitude: bounds.east },
        ],
        { edgePadding: { top: 60 + padTop, right: 50, bottom: 60 + padBottom, left: 50 }, animated: true },
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
  // Com um marcador de "você está aqui" próprio, o ponto azul do sistema
  // ficaria duplicado em cima dele.
  const hasCurrentMarker = (markers ?? []).some((m) => m.variant === 'current');
  const routeColor = pathColor ?? colors.primary;

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
      // Segue o tema do APP (não o do celular) e usa a versão "suave" do
      // mapa da Apple, com cores apagadas — quem aparece é o traçado.
      userInterfaceStyle={mode}
      mapType="mutedStandard"
      pointsOfInterestFilter={TRAINING_POIS}
      showsUserLocation={!hasCurrentMarker}
      showsCompass={false}
      showsScale={false}
      showsTraffic={false}
      showsIndoors={false}
      showsBuildings
      toolbarEnabled={false}
      mapPadding={{ top: padTop, right: 0, bottom: padBottom, left: 0 }}
      legalLabelInsets={{ top: 0, right: 0, bottom: padBottom + 6, left: 10 }}
    >
      <NativePolygon
        coordinates={WORLD}
        fillColor={dark ? 'rgba(20,15,42,0.30)' : 'rgba(243,241,251,0.28)'}
        strokeWidth={0}
        strokeColor="transparent"
        tappable={false}
      />
      {(paths ?? []).map((p) =>
        p.coords.length > 1 ? (
          <React.Fragment key={p.id}>
            <NativePolyline
              coordinates={p.coords}
              strokeColor={withAlpha(p.color, 0.22)}
              strokeWidth={9}
              lineCap="round"
              lineJoin="round"
            />
            <NativePolyline coordinates={p.coords} strokeColor={p.color} strokeWidth={3.5} lineCap="round" lineJoin="round" />
          </React.Fragment>
        ) : null,
      )}
      {path && path.length > 1 && (
        <>
          {/* Brilho largo por baixo: o traçado "acende" em cima do mapa escuro. */}
          <NativePolyline
            coordinates={path}
            strokeColor={withAlpha(routeColor, 0.25)}
            strokeWidth={15}
            lineCap="round"
            lineJoin="round"
          />
          {/* Contorno: dá contraste em cima de ruas claras e parques, onde só a linha colorida sumiria. */}
          <NativePolyline coordinates={path} strokeColor={routeCasing(mode, colors.background)} strokeWidth={8.5} lineCap="round" lineJoin="round" />
          <NativePolyline coordinates={path} strokeColor={routeColor} strokeWidth={4.5} lineCap="round" lineJoin="round" />
        </>
      )}
      {(markers ?? []).map((m) => (
        <NativeMarker
          key={m.id}
          coordinate={m.coord}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={m.variant === 'current' ? 10 : 1}
        >
          <MapPin variant={m.variant} />
        </NativeMarker>
      ))}
    </NativeMapView>
  );
}

/**
 * Os marcadores do mapa (iOS): largada com "play", chegada com bandeira —
 * círculo na cor da variante, borda branca e um halo suave em volta. A
 * posição atual é um ponto na cor da marca, "pulsando" enquanto se move.
 */
function MapPin({ variant }: { variant: PinVariant }) {
  const { colors } = useTheme();
  const fill = fillForVariant(variant, colors);
  if (variant === 'current') return <CurrentDot color={fill} />;
  return (
    <View style={pinStyles.wrap}>
      <View style={[pinStyles.halo, { backgroundColor: withAlpha(fill, 0.25) }]} />
      <View style={[pinStyles.core, { backgroundColor: fill }]}>
        <Ionicons
          name={variant === 'start' ? 'play' : 'flag'}
          size={11}
          color="#ffffff"
          style={variant === 'start' ? { marginLeft: 2 } : undefined}
        />
      </View>
    </View>
  );
}

function CurrentDot({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      pulse.setValue(0.6);
      return;
    }
    const anim = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, reduced]);

  return (
    <View style={pinStyles.meWrap}>
      <Animated.View
        style={[
          pinStyles.mePulse,
          {
            backgroundColor: color,
            opacity: reduced ? 0.22 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: reduced ? 0.8 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }],
          },
        ]}
      />
      <View style={[pinStyles.meDot, { backgroundColor: color }]} />
    </View>
  );
}

const pinStyles = StyleSheet.create({
  wrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 34, height: 34, borderRadius: 17 },
  core: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  mePulse: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },
  meDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#ffffff' },
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
  paths,
  markers,
  followSmoothly = false,
  offlineHint,
  insets,
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

  const padTop = insets?.top ?? 0;
  const padBottom = insets?.bottom ?? 0;
  useEffect(() => {
    if (!ready) return;
    postToMap(webviewRef, { type: 'padding', top: padTop, bottom: padBottom });
  }, [ready, padTop, padBottom]);

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
      casing: routeCasing(mode, colors.background),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, path, pathColor, colors.primary, colors.background, mode]);

  useEffect(() => {
    if (!ready) return;
    postToMap(webviewRef, {
      type: 'markers',
      markers: (markers ?? []).map((m) => ({
        id: m.id,
        lat: m.coord.latitude,
        lng: m.coord.longitude,
        variant: m.variant,
        color: fillForVariant(m.variant, colors),
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, markers, colors.success, colors.danger, colors.primary]);

  useEffect(() => {
    if (!ready || !bounds) return;
    postToMap(webviewRef, { type: 'bounds', ...bounds });
  }, [ready, bounds]);

  useEffect(() => {
    if (!ready) return;
    postToMap(webviewRef, {
      type: 'paths',
      paths: (paths ?? []).map((p) => ({ id: p.id, coords: p.coords.map((c) => [c.longitude, c.latitude]), color: p.color })),
      casing: colors.background,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, paths, colors.background]);

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
        <View style={[fallbackStyles.iconCircle, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="cloud-offline-outline" size={26} color={colors.primary} />
        </View>
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

const fallbackStyles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    borderWidth: 1,
  },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 15.5, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  retry: { marginTop: 18, minWidth: 180 },
});
