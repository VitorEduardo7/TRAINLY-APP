import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useActivities } from '../hooks/useActivities';
import { useRoutes } from '../hooks/useRoutes';
import { Card } from '../components/Card';
import { TrainlyButton } from '../components/TrainlyButton';
import { PublishRouteModal } from '../components/PublishRouteModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatClock, formatKm, paceMinPerKm } from '../lib/geo';
import { Activity, RouteDifficulty, RouteType } from '../types/models';
import { RootStackParamList } from '../navigation/types';

const TYPE_ICON: Record<string, string> = {
  Corrida: '🏃',
  Ciclismo: '🚴',
  Natação: '🏊',
  Caminhada: '🚶',
};

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

  const renderItem = ({ item }: { item: Activity }) => (
    <Card style={styles.item}>
      <View style={styles.itemTop}>
        <Text style={styles.icon}>{TYPE_ICON[item.type] ?? '🏅'}</Text>
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
        <Text style={[styles.xp, { color: colors.primary }]}>+{item.xp_earned} XP</Text>
      </View>

      <View style={[styles.statsRow, { borderColor: colors.border }]}>
        <MiniStat label="Distância" value={`${formatKm(Number(item.distance_km))} km`} colors={colors} />
        <MiniStat label="Tempo" value={formatClock(item.duration_sec)} colors={colors} />
        <MiniStat
          label="Ritmo"
          value={`${paceMinPerKm(Number(item.distance_km), item.duration_sec)}/km`}
          colors={colors}
        />
        {item.elevation_m ? (
          <MiniStat label="Elevação" value={`${item.elevation_m} m`} colors={colors} />
        ) : null}
      </View>

      <View style={{ marginTop: 12 }}>
        {publishedRouteFor(item) ? (
          <Pressable
            onPress={() => navigation.navigate('RouteDetail', { routeId: publishedRouteFor(item)!.id })}
            style={({ pressed }) => [
              styles.publishedBtn,
              { borderColor: colors.success, backgroundColor: `${colors.success}18` },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={[styles.publishedBtnText, { color: colors.success }]}>✓ Publicada como rota — ver no mapa</Text>
          </Pressable>
        ) : canPublish(item) ? (
          <TrainlyButton title="Publicar como rota" variant="secondary" onPress={() => setPublishing(item)} />
        ) : (
          <>
            <Pressable
              onPress={() => explainBlock(item)}
              style={({ pressed }) => [
                styles.lockedBtn,
                { borderColor: colors.border },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.lockedBtnText, { color: colors.textMuted }]}>🔒 Publicar como rota</Text>
            </Pressable>
            <Text style={[styles.lockedHint, { color: colors.textMuted }]}>
              {blockReason(item)} Toque pra entender.
            </Text>
          </>
        )}
      </View>
    </Card>
  );

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
        ListHeaderComponent={<ScreenHeader title="Histórico" />}
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {error
                ? 'Não foi possível carregar — puxe a tela pra baixo pra tentar de novo.'
                : 'Nenhuma atividade registrada ainda.'}
            </Text>
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
  list: { padding: 20, paddingBottom: 40 },
  header: { fontSize: 24, fontWeight: '900', marginBottom: 16 },
  item: { marginBottom: 14 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  icon: { fontSize: 26 },
  title: { fontSize: 15, fontWeight: '700' },
  date: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  xp: { fontSize: 13, fontWeight: '800' },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12 },
  lockedBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBtnText: { fontSize: 14.5, fontWeight: '700' },
  publishedBtn: {
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
  empty: { textAlign: 'center', marginTop: 60, fontSize: 14 },
});
