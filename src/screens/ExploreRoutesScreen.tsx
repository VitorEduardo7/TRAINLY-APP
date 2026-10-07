import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useTheme } from '../theme/ThemeContext';
import { difficultyColor } from '../theme/colors';
import { useRoutes } from '../hooks/useRoutes';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { SportBadge } from '../components/SportIcon';
import { ChipSelector } from '../components/ChipSelector';
import { FadeIn, PressableScale } from '../components/Motion';
import { SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Text } from '../components/Typography';
import { tapLight } from '../lib/haptics';
import { boundsOf, LatLon, TrainlyMap, TrainlyMarker, TrainlyPathOverlay } from '../components/TrainlyMap';
import { formatKm, haversineKm } from '../lib/geo';
import { effectiveTier, estimateRouteXp } from '../lib/rank';
import { TrainlyRoute } from '../types/models';
import { RootStackParamList } from '../navigation/types';

const SAO_PAULO: LatLon = { latitude: -23.55, longitude: -46.63 };

const FILTERS = ['Padrão', 'Perto de mim', 'Rápidas', 'Mais XP'] as const;
type FilterOption = (typeof FILTERS)[number];

function distanceFromMe(route: TrainlyRoute, me: LatLon): number {
  if (!route.path?.length) return Infinity;
  const [lat, lon] = route.path[0];
  return haversineKm(me.latitude, me.longitude, lat, lon);
}

export function ExploreRoutesScreen() {
  const { colors, colorBlindMode } = useTheme();
  const { routes, loading, error, reload } = useRoutes();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [filter, setFilter] = useState<FilterOption>('Padrão');
  const [myLocation, setMyLocation] = useState<LatLon | null>(null);
  const [locating, setLocating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Localização só é pedida quando a pessoa realmente escolhe "Perto de
  // mim" — nunca de cara ao abrir a tela, pra não pedir permissão à toa.
  const handleFilterChange = async (next: FilterOption) => {
    setFilter(next);
    if (next !== 'Perto de mim' || myLocation) return;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Trainly', 'Sem acesso à localização não dá pra ordenar por "perto de mim". Habilite nas configurações do celular.');
        setFilter('Padrão');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMyLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      Alert.alert('Trainly', 'Não foi possível pegar sua localização agora.');
      setFilter('Padrão');
    } finally {
      setLocating(false);
    }
  };

  // Os filtros só REORDENAM a lista (não escondem rota nenhuma) — assim dá
  // pra combinar "olhar as mais próximas primeiro" sem correr o risco de uma
  // rota boa sumir por um corte arbitrário de distância/km.
  const displayedRoutes = useMemo(() => {
    if (filter === 'Rápidas') {
      return [...routes].sort((a, b) => Number(a.distance_km) - Number(b.distance_km));
    }
    if (filter === 'Mais XP') {
      return [...routes].sort(
        (a, b) =>
          estimateRouteXp(Number(b.distance_km), b.difficulty) - estimateRouteXp(Number(a.distance_km), a.difficulty),
      );
    }
    if (filter === 'Perto de mim' && myLocation) {
      return [...routes].sort((a, b) => distanceFromMe(a, myLocation) - distanceFromMe(b, myLocation));
    }
    return routes;
  }, [routes, filter, myLocation]);

  // Um marcador por rota, no ponto de largada — visão geral de "onde treinar
  // por perto", igual ao mapa da aba Explorar do site (explorar.php).
  const startPoints = useMemo<LatLon[]>(
    () => routes.filter((r) => r.path?.length).map((r) => ({ latitude: r.path[0][0], longitude: r.path[0][1] })),
    [routes],
  );
  const bounds = useMemo(() => boundsOf(startPoints), [startPoints]);
  const markers = useMemo<TrainlyMarker[]>(
    () =>
      routes
        .filter((r) => r.path?.length)
        .map((r) => ({
          id: r.id,
          coord: { latitude: r.path[0][0], longitude: r.path[0][1] },
          variant: 'start' as const,
        })),
    [routes],
  );
  // Cada rota no traçado da patente de quem a criou — o mesmo mapa fica com
  // um mosaico de cores em vez de tudo azul, e ajuda a "sentir" quem no app
  // já correu bastante só de olhar o Explorar.
  const routePaths = useMemo<TrainlyPathOverlay[]>(
    () =>
      routes
        .filter((r) => r.path?.length > 1)
        .map((r) => ({
          id: r.id,
          coords: r.path.map(([latitude, longitude]) => ({ latitude, longitude })),
          color: effectiveTier(r.creator_xp ?? 0, r.creator_map_tier, colorBlindMode).color,
        })),
    [routes, colorBlindMode],
  );

  const firstLoad = loading && routes.length === 0 && !error;

  // O terceiro número do card muda com o filtro ativo — mostra exatamente o
  // critério que está ordenando a lista, em vez de só reordenar "por baixo"
  // sem explicar o porquê daquela ordem.
  const thirdStat = (item: TrainlyRoute): { label: string; value: string } => {
    if (filter === 'Perto de mim' && myLocation) {
      const km = distanceFromMe(item, myLocation);
      return { label: 'De você', value: Number.isFinite(km) ? `${formatKm(km)} km` : '—' };
    }
    if (filter === 'Mais XP') {
      return { label: 'XP estimado', value: `~${estimateRouteXp(Number(item.distance_km), item.difficulty)}` };
    }
    return { label: 'Terreno', value: item.terrain || '—' };
  };

  const renderItem = ({ item, index }: { item: TrainlyRoute; index: number }) => (
    <FadeIn delay={Math.min(index, 5) * 60}>
      <PressableScale
        scaleTo={0.98}
        onPress={() => {
          tapLight();
          navigation.navigate('RouteDetail', { routeId: item.id });
        }}
      >
        <Card style={styles.item}>
          <View style={styles.itemTop}>
            <SportBadge type={item.type} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.creator, { color: colors.textMuted }]}>por {item.creator_name}</Text>
            </View>
            <Text style={[styles.difficulty, { color: difficultyColor(item.difficulty, colors) }]}>{item.difficulty}</Text>
          </View>

          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <MiniStat label="Distância" value={`${formatKm(Number(item.distance_km))} km`} colors={colors} />
            <MiniStat label="Elevação" value={item.elevation_m ? `${item.elevation_m} m` : '—'} colors={colors} />
            <MiniStat {...thirdStat(item)} colors={colors} />
          </View>
        </Card>
      </PressableScale>
    </FadeIn>
  );

  return (
    // Só o topo — a tab bar de baixo já respeita a área segura inferior sozinha.
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={displayedRoutes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onRefresh={reload}
        refreshing={loading}
        ListHeaderComponent={
          <View>
            <ScreenHeader wash="explore" title="Explorar" />
            <View style={[styles.mapWrap, { borderColor: colors.border }]}>
              <TrainlyMap
                style={styles.map}
                bounds={bounds}
                center={startPoints[0] ?? SAO_PAULO}
                paths={routePaths}
                markers={markers}
                offlineHint="A lista de rotas abaixo continua disponível — só o desenho do mapa precisa de internet."
              />
            </View>
            <ChipSelector options={FILTERS} value={filter} onChange={handleFilterChange} style={styles.filterRow} />
            {locating && (
              <Text style={[styles.locatingHint, { color: colors.textMuted }]}>Pegando sua localização…</Text>
            )}
            {firstLoad && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          !firstLoad ? (
            <EmptyState
              icon={error ? 'cloud-offline-outline' : 'map-outline'}
              title={error ? 'Não foi possível carregar' : 'Nenhuma rota publicada ainda'}
              message={
                error
                  ? 'Puxe a tela pra baixo pra tentar de novo.'
                  : 'Termine uma atividade por GPS e publique ela como rota lá no Histórico.'
              }
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function MiniStat({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.miniValue, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.miniLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 130 },
  mapWrap: { height: 200, borderRadius: 24, overflow: 'hidden', borderWidth: 1, marginBottom: 20 },
  map: { flex: 1 },
  filterRow: { marginBottom: 16 },
  locatingHint: { fontSize: 12, fontWeight: '600', marginTop: -8, marginBottom: 12 },
  item: { marginBottom: 14 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  name: { fontSize: 15, fontWeight: '700' },
  creator: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  difficulty: { fontSize: 12, fontWeight: '800' },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12 },
  miniValue: { fontSize: 13.5, fontWeight: '800' },
  miniLabel: { fontSize: 12, fontWeight: '600', marginTop: 3 },
});
