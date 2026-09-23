import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TrainlyMap, TrainlyMarker } from '../components/TrainlyMap';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useActivities } from '../hooks/useActivities';
import { TrainlyButton } from '../components/TrainlyButton';
import { ChipSelector } from '../components/ChipSelector';
import { StatTile } from '../components/StatTile';
import { PressableScale, usePulse } from '../components/Motion';
import { Text } from '../components/Typography';
import { tapLight, success, warning } from '../lib/haptics';
import {
  AUTO_PAUSE_AFTER_SEC,
  GpsQuality,
  KmSplit,
  PaceSample,
  PACE_HISTORY_MAX_AGE_SEC,
  TRACKABLE_ACTIVITY_KINDS,
  TrackPoint,
  TrainlyActivityKind,
  currentPaceMinPerKm,
  decidePoint,
  describeAccuracy,
  formatClock,
  formatElevation,
  formatKm,
  formatSplitPace,
  paceFromSpeedMps,
  paceMinPerKm,
  startButtonLabel,
} from '../lib/geo';
import { RootStackParamList } from '../navigation/types';

type LatLon = { latitude: number; longitude: number };
type Phase = 'idle' | 'running' | 'paused';

export function RunScreen() {
  const { colors } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const { createActivity } = useActivities(profile?.id);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  // Centro do mapa. Fica nulo até o GPS responder — é assim que o mapa sabe
  // que ainda não tem posição real e deve saltar (não animar) até a primeira.
  const [center, setCenter] = useState<LatLon | null>(null);
  const [current, setCurrent] = useState<LatLon | null>(null);
  const [startPoint, setStartPoint] = useState<LatLon | null>(null);
  const [path, setPath] = useState<LatLon[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elevationM, setElevationM] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [currentPace, setCurrentPace] = useState("--'--\"");
  const [splits, setSplits] = useState<KmSplit[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [autoPaused, setAutoPaused] = useState(false);
  const [activityKind, setActivityKind] = useState<TrainlyActivityKind>('Corrida');
  const [gpsInfo, setGpsInfo] = useState<{ label: string; quality: GpsQuality }>({
    label: 'Buscando GPS…',
    quality: 'ok',
  });
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [saving, setSaving] = useState(false);

  const watchSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pathRef = useRef<LatLon[]>([]);
  const startPointRef = useRef<LatLon | null>(null);
  const distanceRef = useRef(0);
  const elevationRef = useRef(0);
  const secondsRef = useRef(0);
  const lastRawRef = useRef<TrackPoint | null>(null);
  const anchorRef = useRef<TrackPoint | null>(null);
  const paceHistoryRef = useRef<PaceSample[]>([]);
  const lastMovementAtRef = useRef(0);
  const lastSplitSecondsRef = useRef(0);
  const splitsRef = useRef<KmSplit[]>([]);
  const phaseRef = useRef<Phase>('idle');
  const autoPausedRef = useRef(false);
  const activityKindRef = useRef<TrainlyActivityKind>('Corrida');

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsInfo({ label: 'Sem permissão de localização — ative nas configurações', quality: 'bad' });
        setPermissionDenied(true);
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setGpsInfo(describeAccuracy(pos.coords.accuracy));
        setCurrent({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setCenter({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        setGpsInfo({ label: 'Sem sinal de GPS — ative a localização', quality: 'bad' });
      }
    })();

    return () => {
      watchSubscription.current?.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const setAutoPausedBoth = (v: boolean) => {
    autoPausedRef.current = v;
    setAutoPaused(v);
  };

  const isEffectivelyActive = () => phaseRef.current === 'running' && !autoPausedRef.current;

  const resetTrackingState = () => {
    pathRef.current = [];
    startPointRef.current = null;
    distanceRef.current = 0;
    elevationRef.current = 0;
    secondsRef.current = 0;
    lastRawRef.current = null;
    anchorRef.current = null;
    paceHistoryRef.current = [];
    splitsRef.current = [];
    lastSplitSecondsRef.current = 0;
    lastMovementAtRef.current = Date.now();

    setPath([]);
    setStartPoint(null);
    setDistanceKm(0);
    setElevationM(0);
    setSeconds(0);
    setCurrentPace("--'--\"");
    setSplits([]);
    setAutoPausedBoth(false);
  };

  const handleLocationUpdate = (pos: Location.LocationObject) => {
    const point: TrackPoint = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude: pos.coords.altitude,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed,
      timestamp: pos.timestamp,
    };

    setGpsInfo(describeAccuracy(point.accuracy));

    const decision = decidePoint(point, lastRawRef.current, anchorRef.current, activityKindRef.current);

    // Estes dois sempre ficam em dia, mesmo pausado (manual ou automático) —
    // é o que evita um "salto" de distância contado de uma vez quando a
    // corrida é retomada depois de um tempo parado.
    if (decision.accept) {
      lastRawRef.current = point;
    }
    if (decision.advanceAnchor) {
      anchorRef.current = point;
    }

    // Pausado: não desenha o trajeto nem move o marcador no mapa. Sem isso,
    // pausar manualmente e andar até outro lugar (ex: um semáforo, uma
    // parada) desenhava esse trecho como se fizesse parte da corrida.
    if (decision.accept && isEffectivelyActive()) {
      const latLon = { latitude: point.latitude, longitude: point.longitude };
      setCurrent(latLon);
      setCenter(latLon);
      pathRef.current = [...pathRef.current, latLon];
      setPath(pathRef.current);
      if (!startPointRef.current) {
        startPointRef.current = latLon;
        setStartPoint(latLon);
      }
    }

    // só contabiliza distância/elevação/ritmo se a atividade estiver
    // realmente "rodando" (pausa manual não conta nada; pausa automática
    // continua rodando essa parte pra poder detectar quando o movimento volta)
    if (phaseRef.current !== 'running') return;

    if (decision.addDistanceKm > 0) {
      if (autoPausedRef.current) setAutoPausedBoth(false);

      distanceRef.current += decision.addDistanceKm;
      setDistanceKm(distanceRef.current);
      lastMovementAtRef.current = Date.now();

      if (decision.addElevationM > 0) {
        elevationRef.current += decision.addElevationM;
        setElevationM(elevationRef.current);
      }

      paceHistoryRef.current.push({ timestamp: point.timestamp, cumulativeKm: distanceRef.current });
      const cutoff = point.timestamp - PACE_HISTORY_MAX_AGE_SEC * 1000;
      while (paceHistoryRef.current.length > 2 && paceHistoryRef.current[0].timestamp < cutoff) {
        paceHistoryRef.current.shift();
      }

      const kmCompleted = Math.floor(distanceRef.current);
      if (kmCompleted > splitsRef.current.length) {
        const splitSeconds = secondsRef.current - lastSplitSecondsRef.current;
        lastSplitSecondsRef.current = secondsRef.current;
        splitsRef.current = [...splitsRef.current, { km: kmCompleted, seconds: splitSeconds }];
        setSplits(splitsRef.current);
      }
    }

    // Ritmo atual: prioriza a velocidade que o próprio GPS informa (mais
    // estável do que derivar de distância/tempo — ver paceFromSpeedMps) e
    // atualiza a cada ponto aceito, não só quando a âncora de distância
    // avança. Sem isso o número ficava "congelado" por vários segundos toda
    // vez que o sinal empacava e então pulava de uma vez, parecendo simulado.
    if (decision.accept && !autoPausedRef.current) {
      const speedPace = paceFromSpeedMps(point.speed, activityKindRef.current);
      setCurrentPace(speedPace ?? currentPaceMinPerKm(paceHistoryRef.current));
    }
  };

  const tick = () => {
    if (!isEffectivelyActive()) return;
    secondsRef.current += 1;
    setSeconds(secondsRef.current);

    if (!autoPausedRef.current && Date.now() - lastMovementAtRef.current > AUTO_PAUSE_AFTER_SEC * 1000) {
      setAutoPausedBoth(true);
    }
  };

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setPermissionDenied(true);
      Alert.alert(
        'Trainly',
        'Não foi possível acessar sua localização. Ative a permissão nas configurações do celular pra registrar a corrida.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    setPermissionDenied(false);

    resetTrackingState();
    activityKindRef.current = activityKind;
    setPhaseBoth('running');

    watchSubscription.current?.remove();
    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 1 },
      handleLocationUpdate,
    );

    // Se "Finalizar" foi tocado enquanto o GPS ainda estava sendo registrado
    // (esse `await` é um round-trip até o nativo — raro, mas pode acontecer
    // numa corrida encerrada quase na hora de começar), a tela já navegou
    // embora nesse meio-tempo. Sem esse cheque, a assinatura e o timer
    // criados aqui ficariam escutando o GPS pra sempre em segundo plano,
    // sem ninguém mais pra chamar `.remove()` neles.
    if (phaseRef.current !== 'running') {
      sub.remove();
      return;
    }
    watchSubscription.current = sub;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(tick, 1000);
  };

  const pauseTracking = () => {
    setPhaseBoth('paused');
    setAutoPausedBoth(false);
  };

  const resumeTracking = () => {
    lastMovementAtRef.current = Date.now(); // evita disparar auto-pausa na hora
    setPhaseBoth('running');
  };

  const finishTracking = async () => {
    setPhaseBoth('idle');
    watchSubscription.current?.remove();
    watchSubscription.current = null;
    if (timerRef.current) clearInterval(timerRef.current);

    if (distanceRef.current <= 0) {
      Alert.alert('Trainly', 'Nenhuma distância registrada — atividade descartada.');
      navigation.goBack();
      return;
    }

    setSaving(true);
    try {
      const xp = await createActivity({
        type: activityKindRef.current,
        distanceKm: distanceRef.current,
        durationSec: secondsRef.current,
        elevationM: elevationRef.current > 0 ? Math.round(elevationRef.current) : null,
        path: pathRef.current.map((p) => [p.latitude, p.longitude] as [number, number]),
      });
      await refreshProfile();
      success();
      Alert.alert('Trainly', `Atividade salva! Você ganhou ${xp} XP.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível salvar a atividade.');
    } finally {
      setSaving(false);
    }
  };

  // A tela não tinha jeito nenhum de sair antes de terminar a corrida — sem
  // botão de voltar, só dava pra sair pelos Alerts de "Finalizar". Parado
  // (idle, nada gravado ainda) sai direto; em andamento, confirma antes de
  // descartar (mesma limpeza de assinatura/timer que finishTracking faz).
  const handleClose = () => {
    if (phaseRef.current === 'idle') {
      navigation.goBack();
      return;
    }
    warning();
    Alert.alert('Trainly', 'Sair agora descarta a corrida em andamento. Tem certeza?', [
      { text: 'Continuar corrida', style: 'cancel' },
      {
        text: 'Sair sem salvar',
        style: 'destructive',
        onPress: () => {
          watchSubscription.current?.remove();
          watchSubscription.current = null;
          if (timerRef.current) clearInterval(timerRef.current);
          navigation.goBack();
        },
      },
    ]);
  };

  const gpsDotColor =
    gpsInfo.quality === 'good' ? colors.success : gpsInfo.quality === 'bad' ? colors.danger : colors.primary;

  const mapMarkers: TrainlyMarker[] = [];
  if (startPoint) mapMarkers.push({ id: 'start', coord: startPoint, variant: 'start' });
  if (current) mapMarkers.push({ id: 'current', coord: current, variant: 'current' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TrainlyMap
        style={styles.map}
        center={center}
        path={path}
        markers={mapMarkers}
        followSmoothly
        offlineHint="Sua corrida está sendo gravada normalmente — distância, tempo, ritmo e o trajeto para publicar como rota. Só o desenho do mapa precisa de internet."
      />

      <PressableScale
        onPress={() => {
          tapLight();
          handleClose();
        }}
        scaleTo={0.9}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        style={[styles.backBtn, { top: insets.top + 10, backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
      </PressableScale>

      {/* paddingBottom soma o inset pra "Pausar"/"Finalizar" não ficarem sob a barra de gestos do celular. */}
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: 20 + insets.bottom }]}>
        <View style={styles.statusRow}>
          <GpsDot color={gpsDotColor} live={phase === 'running'} />
          <Text style={[styles.gpsStatus, { color: colors.textMuted }]} numberOfLines={1}>
            {gpsInfo.label}
          </Text>
        </View>

        {permissionDenied && (
          <View style={{ marginBottom: 14 }}>
            <TrainlyButton
              title="Abrir configurações do celular"
              variant="secondary"
              onPress={() => Linking.openSettings()}
            />
          </View>
        )}

        {phase === 'running' && autoPaused && (
          <Text style={[styles.autoPauseNote, { color: colors.danger }]}>
            Pausado automaticamente — sem movimento detectado
          </Text>
        )}

        {phase === 'idle' && (
          <ChipSelector
            options={TRACKABLE_ACTIVITY_KINDS}
            value={activityKind}
            onChange={setActivityKind}
            style={styles.typeRow}
          />
        )}

        <View style={styles.statsGrid}>
          <StatTile icon="navigate" label="Distância" value={`${formatKm(distanceKm)} km`} />
          <StatTile icon="time" label="Tempo" value={formatClock(seconds)} />
          <StatTile icon="speedometer-outline" label="Ritmo atual" value={`${currentPace}/km`} />
          <StatTile icon="speedometer-outline" label="Ritmo médio" value={`${paceMinPerKm(distanceKm, seconds)}/km`} />
          <StatTile icon="trending-up" label="Elevação" value={formatElevation(elevationM)} />
          <StatTile icon="flag-outline" label="Km completos" value={String(splits.length)} />
        </View>

        {splits.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.splitsRow}>
            {splits.map((s) => (
              <View key={s.km} style={[styles.splitChip, { borderColor: colors.border }]}>
                <Text style={[styles.splitKm, { color: colors.textPrimary }]}>{s.km} km</Text>
                <Text style={[styles.splitPace, { color: colors.textMuted }]}>{formatSplitPace(s)}/km</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {phase === 'idle' ? (
          <TrainlyButton
            title={startButtonLabel(activityKind)}
            variant="primary"
            onPress={startTracking}
            loading={saving}
          />
        ) : (
          <View style={styles.actionsRow}>
            <View style={{ flex: 1 }}>
              <TrainlyButton
                title={phase === 'paused' ? 'Retomar' : 'Pausar'}
                variant="secondary"
                onPress={phase === 'paused' ? resumeTracking : pauseTracking}
                disabled={saving}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TrainlyButton title="Finalizar" variant="danger" onPress={finishTracking} loading={saving} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

/** Bolinha de status do GPS: cor = qualidade do sinal, "respirando" = gravando de verdade agora. */
function GpsDot({ color, live }: { color: string; live: boolean }) {
  const pulse = usePulse(900);
  return (
    <Animated.View
      style={[
        styles.statusDot,
        { backgroundColor: color, opacity: live ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) : 1 },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  panel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  gpsStatus: { fontSize: 12, fontWeight: '600' },
  autoPauseNote: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  typeRow: { marginBottom: 16, justifyContent: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  splitsRow: { marginBottom: 14 },
  splitChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 64,
  },
  splitKm: { fontSize: 13, fontWeight: '800' },
  splitPace: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 12 },
});
