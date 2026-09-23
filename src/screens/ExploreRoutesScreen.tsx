import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { difficultyColor } from '../theme/colors';
import { useRoutes } from '../hooks/useRoutes';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { SportBadge } from '../components/SportIcon';
import { FadeIn, PressableScale } from '../components/Motion';
import { SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Text } from '../components/Typography';
import { tapLight } from '../lib/haptics';
import { boundsOf, LatLon, TrainlyMap, TrainlyMarker } from '../components/TrainlyMap';
import { formatKm } from '../lib/geo';
import { TrainlyRoute } from '../types/models';
import { RootStackParamList } from '../navigation/types';

const SAO_PAULO: LatLon = { latitude: -23.55, longitude: -46.63 };

export function ExploreRoutesScreen() {
  const { colors } = useTheme();
  const { routes, loading, error, reload } = useRoutes();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

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

  const firstLoad = loading && routes.length === 0 && !error;

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
            <MiniStat label="Terreno" value={item.terrain || '—'} colors={colors} />
          </View>
        </Card>
      </PressableScale>
    </FadeIn>
  );

  return (
    // Só o topo — a tab bar de baixo já respeita a área segura inferior sozinha.
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={routes}
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
                markers={markers}
                offlineHint="A lista de rotas abaixo continua disponível — só o desenho do mapa precisa de internet."
              />
            </View>
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
  item: { marginBottom: 14 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  name: { fontSize: 15, fontWeight: '700' },
  creator: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  difficulty: { fontSize: 12, fontWeight: '800' },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12 },
  miniValue: { fontSize: 13.5, fontWeight: '800' },
  miniLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 3, textTransform: 'uppercase' },
});
