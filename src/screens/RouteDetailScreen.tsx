import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { boundsOf, LatLon, TrainlyMap, TrainlyMarker } from '../components/TrainlyMap';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useRouteDetail, useRoutes } from '../hooks/useRoutes';
import { TrainlyButton } from '../components/TrainlyButton';
import { formatKm } from '../lib/geo';
import { RootStackParamList } from '../navigation/types';
import type { TrainlyRoute } from '../types/models';

type RouteDetailRoute = RouteProp<RootStackParamList, 'RouteDetail'>;

export function RouteDetailScreen() {
  const { colors } = useTheme();
  const { params } = useRoute<RouteDetailRoute>();
  const { route, loading } = useRouteDetail(params.routeId);

  if (loading || !route) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <RouteDetail route={route} />;
}

/**
 * Separado da tela acima porque aqui a rota já existe: assim o enquadramento do
 * mapa pode ser memorizado. Se ele fosse recalculado a cada render, a câmera
 * reanimaria sozinha toda vez que qualquer outra coisa mudasse na tela (ao
 * tocar em "Apagar", por exemplo).
 */
function RouteDetail({ route }: { route: TrainlyRoute }) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { deleteRoute } = useRoutes();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [deleting, setDeleting] = useState(false);

  const coords = useMemo<LatLon[]>(
    () => route.path.map(([latitude, longitude]) => ({ latitude, longitude })),
    [route.path],
  );
  const bounds = useMemo(() => boundsOf(coords), [coords]);
  const markers = useMemo<TrainlyMarker[]>(() => {
    const m: TrainlyMarker[] = [];
    if (coords[0]) m.push({ id: 'start', coord: coords[0], variant: 'start' });
    if (coords.length > 1) m.push({ id: 'finish', coord: coords[coords.length - 1], variant: 'finish' });
    return m;
  }, [coords]);

  const isOwner = profile?.id === route.created_by;

  const handleDelete = () => {
    Alert.alert('Trainly', 'Apagar essa rota publicada?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteRoute(route.id);
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Trainly', err.message ?? 'Não foi possível apagar a rota.');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TrainlyMap
        style={styles.map}
        // Com o trajeto inteiro enquadrado, dá pra ver a rota de uma vez em vez
        // de cair em cima da largada e ter que arrastar o mapa atrás do resto.
        bounds={bounds}
        center={coords[0] ?? { latitude: -23.55, longitude: -46.63 }}
        path={coords}
        markers={markers}
        offlineHint="O trajeto desta rota está salvo — os dados abaixo são dela. Só o desenho do mapa precisa de internet."
      />

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{route.name}</Text>
        <Text style={[styles.creator, { color: colors.textMuted }]}>
          por {route.creator_name} · {route.type}
        </Text>

        <View style={styles.statsRow}>
          <Stat label="Distância" value={`${formatKm(Number(route.distance_km))} km`} colors={colors} />
          <Stat label="Elevação" value={route.elevation_m ? `${route.elevation_m} m` : '—'} colors={colors} />
          <Stat label="Dificuldade" value={route.difficulty} colors={colors} />
        </View>
        {route.terrain ? (
          <Text style={[styles.terrain, { color: colors.textMuted }]}>Terreno: {route.terrain}</Text>
        ) : null}

        {isOwner && (
          <View style={{ marginTop: 14 }}>
            <TrainlyButton title="Apagar rota" variant="danger" onPress={handleDelete} loading={deleting} />
          </View>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  map: { flex: 1 },
  panel: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20 },
  name: { fontSize: 19, fontWeight: '900' },
  creator: { fontSize: 12.5, fontWeight: '600', marginTop: 4, marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', minWidth: 84 },
  statValue: { fontSize: 17, fontWeight: '900' },
  statLabel: { fontSize: 10.5, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },
  terrain: { fontSize: 12.5, fontWeight: '600', marginTop: 14, textAlign: 'center' },
});
