import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { withAlpha } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { useActivities } from '../hooks/useActivities';
import { useRoutes } from '../hooks/useRoutes';
import { Card } from '../components/Card';
import { TrainlyButton } from '../components/TrainlyButton';
import { PublishRouteModal } from '../components/PublishRouteModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { SportBadge } from '../components/SportIcon';
import { FadeIn, PressableScale } from '../components/Motion';
import { SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Text } from '../components/Typography';
import { tapLight, success } from '../lib/haptics';
import { formatClock, formatKm, paceMinPerKm } from '../lib/geo';
import { Activity, RouteDifficulty, RouteType } from '../types/models';
import { RootStackParamList } from '../navigation/types';

const ROUTE_TYPES: RouteType[] = ['Corrida', 'Ciclismo', 'Caminhada'];

export function HistoryScreen() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { activities, loading, error, reload } = useActivities(profile?.id);
  const { routes, publishRoute, reload: reloadRoutes } = useRoutes();
  const [publishing, setPublishing] = useState<Activity | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useFocusEffect(
    useCallback(() => {
      reload();
      reloadRoutes();
    }, [reload, reloadRoutes]),
  );

  // Rota já publicada a partir dessa atividade (se houver) — evita publicar
  // a mesma corrida duas vezes e dá um atalho pra abrir a rota no mapa.
  const publishedRouteFor = (item: Activity) => routes.find((r) => r.source_activity_id === item.id) ?? null;

  const canPublish = (item: Activity) =>
    !!item.path && item.path.length > 1 && (ROUTE_TYPES as string[]).includes(item.type);

  /**
   * Por que essa atividade não pode virar rota. O botão aparece em TODAS as
   * atividades (independente da data) — antes ele só era escondido, e isso
   * dava a impressão errada de que só atividade recente podia ser publicada.
   * Na verdade o que falta é sempre o trajeto de GPS.
   */
  const blockReason = (item: Activity): string | null => {
    if (!(ROUTE_TYPES as string[]).includes(item.type)) {
      return `Rotas existem só pra ${ROUTE_TYPES.join(', ').toLowerCase()} — natação não entra.`;
    }
    if (!item.path || item.path.length < 2) {
      return 'Essa atividade não tem trajeto de GPS gravado.';
    }
    return null;
  };

  const explainBlock = (item: Activity) => {
    const reason = blockReason(item);
    if (!reason) return;
    tapLight();
    const isTypeIssue = !(ROUTE_TYPES as string[]).includes(item.type);
    Alert.alert(
      'Não dá pra publicar essa',
      isTypeIssue
        ? `${reason}\n\nUma rota é um trajeto que outras pessoas podem repetir, então só faz sentido pra atividades feitas em movimento pelo mapa.`
        : `${reason}\n\nUma rota é o desenho do caminho no mapa, e isso só é gravado quando a atividade é feita pelo GPS (botão "Iniciar corrida" na tela Início). Atividades registradas à mão guardam distância e tempo, mas não o caminho.\n\nVale pra qualquer data: qualquer atividade antiga feita por GPS pode ser publicada normalmente.`,
      [{ text: 'Entendi' }],
    );
  };

  const handlePublish = async (input: { name: string; difficulty: RouteDifficulty; terrain: string }) => {
    if (!publishing || !profile?.id || !publishing.path) return;
    try {
      await publishRoute({
        createdBy: profile.id,
        sourceActivityId: publishing.id,
        name: input.name,
        type: publishing.type as RouteType,
        difficulty: input.difficulty,
        terrain: input.terrain,
        distanceKm: Number(publishing.distance_km),
        elevationM: publishing.elevation_m,
        path: publishing.path,
      });
      success();
      // No iOS o Alert é apresentado pelo mesmo controlador do <Modal>, então
      // mostrar ele aqui (com o modal ainda montado) fazia o aviso sumir junto
      // com o modal, sem o usuário ver. Espera a animação de fechar terminar.
      setTimeout(() => {
        Alert.alert('Trainly', 'Rota publicada! Ela já aparece em Explorar Rotas.');
      }, 400);
    } finally {
      setPublishing(null);
    }
  };

  const firstLoad = loading && activities.length === 0 && !error;

  const renderItem = ({ item, index }: { item: Activity; index: number }) => {
    const published = publishedRouteFor(item);
    return (
      <FadeIn delay={Math.min(index, 5) * 60}>
        <Card style={styles.item}>
          <View style={styles.itemTop}>
            <SportBadge type={item.type} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title || item.type}</Text>
              <Text style={[styles.date, { color: colors.textMuted }]}>
                {new Date(item.date).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <Text style={[styles.xp, { color: colors.accent }]}>+{item.xp_earned} XP</Text>
          </View>

          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <MiniStat label="Distância" value={`${formatKm(Number(item.distance_km))} km`} colors={colors} />
            <MiniStat label="Tempo" value={formatClock(item.duration_sec)} colors={colors} />
            <MiniStat
              label="Ritmo"
              value={`${paceMinPerKm(Number(item.distance_km), item.duration_sec)}/km`}
              colors={colors}
            />
            {item.elevation_m ? <MiniStat label="Elevação" value={`${item.elevation_m} m`} colors={colors} /> : null}
          </View>

          <View style={{ marginTop: 12 }}>
            {published ? (
              <PressableScale
                scaleTo={0.98}
                onPress={() => {
                  tapLight();
                  navigation.navigate('RouteDetail', { routeId: published.id });
                }}
                style={[
                  styles.publishedBtn,
                  { borderColor: colors.success, backgroundColor: withAlpha(colors.success, 0.1) },
                ]}
              >
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.publishedBtnText, { color: colors.success }]}>Publicada como rota — ver no mapa</Text>
              </PressableScale>
            ) : canPublish(item) ? (
              <TrainlyButton title="Publicar como rota" variant="secondary" onPress={() => setPublishing(item)} />
            ) : (
              <>
                <PressableScale
                  scaleTo={0.98}
                  onPress={() => explainBlock(item)}
                  style={[styles.lockedBtn, { borderColor: colors.border }]}
                >
                  <Ionicons name="lock-closed-outline" size={15} color={colors.textMuted} />
                  <Text style={[styles.lockedBtnText, { color: colors.textMuted }]}>Publicar como rota</Text>
                </PressableScale>
                <Text style={[styles.lockedHint, { color: colors.textMuted }]}>
                  {blockReason(item)} Toque pra entender.
                </Text>
              </>
            )}
          </View>
        </Card>
      </FadeIn>
    );
  };

  return (
    // Só o topo — a tab bar de baixo já respeita a área segura inferior sozinha.
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onRefresh={reload}
        refreshing={loading}
        ListHeaderComponent={
          <View>
            <ScreenHeader wash="history" title="Histórico" />
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
              icon={error ? 'cloud-offline-outline' : 'time-outline'}
              title={error ? 'Não foi possível carregar' : 'Nenhuma atividade registrada ainda'}
              message={
                error
                  ? 'Puxe a tela pra baixo pra tentar de novo.'
                  : 'Toque em "Iniciar corrida" ou registre um treino feito em outro dia.'
              }
            />
          ) : null
        }
      />

      {publishing && (
        <PublishRouteModal
          visible
          onClose={() => setPublishing(null)}
          activityTitle={publishing.title || publishing.type}
          onSave={handlePublish}
        />
      )}
    </SafeAreaView>
  );
}

function MiniStat({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.miniValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.miniLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 130 },
  item: { marginBottom: 14 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: '700' },
  date: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  xp: { fontSize: 13, fontWeight: '800' },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12 },
  lockedBtn: {
    flexDirection: 'row',
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBtnText: { fontSize: 14.5, fontWeight: '700' },
  publishedBtn: {
    flexDirection: 'row',
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishedBtnText: { fontSize: 13.5, fontWeight: '800' },
  lockedHint: { fontSize: 11.5, fontWeight: '600', marginTop: 8, textAlign: 'center', lineHeight: 16 },
  miniValue: { fontSize: 14, fontWeight: '800' },
  miniLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 3, textTransform: 'uppercase' },
});
