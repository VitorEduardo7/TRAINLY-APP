import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useRoutes } from '../hooks/useRoutes';
import { Card } from '../components/Card';
import { formatKm } from '../lib/geo';
import { TrainlyRoute } from '../types/models';
import { RootStackParamList } from '../navigation/types';

const TYPE_ICON: Record<string, string> = {
  Corrida: '🏃',
  Ciclismo: '🚴',
  Caminhada: '🚶',
};

function difficultyColor(difficulty: string, colors: { success: string; primary: string; danger: string }) {
  if (difficulty === 'Fácil') return colors.success;
  if (difficulty === 'Difícil') return colors.danger;
  return colors.primary;
}

export function ExploreRoutesScreen() {
  const { colors } = useTheme();
  const { routes, loading, error, reload } = useRoutes();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const renderItem = ({ item }: { item: TrainlyRoute }) => (
    <Pressable onPress={() => navigation.navigate('RouteDetail', { routeId: item.id })}>
      <Card style={styles.item}>
        <View style={styles.itemTop}>
          <Text style={styles.icon}>{TYPE_ICON[item.type] ?? '🗺️'}</Text>
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
    </Pressable>
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
        ListHeaderComponent={<Text style={[styles.header, { color: colors.textPrimary }]}>Explorar Rotas</Text>}
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {error
                ? 'Não foi possível carregar — puxe a tela pra baixo pra tentar de novo.'
                : 'Nenhuma rota publicada ainda. Termine uma atividade por GPS e publique ela como rota lá no Histórico.'}
            </Text>
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
  list: { padding: 20, paddingBottom: 40 },
  header: { fontSize: 24, fontWeight: '900', marginBottom: 16 },
  item: { marginBottom: 14 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  icon: { fontSize: 26 },
  name: { fontSize: 15, fontWeight: '700' },
  creator: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  difficulty: { fontSize: 12, fontWeight: '800' },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12 },
  miniValue: { fontSize: 13.5, fontWeight: '800' },
  miniLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 3, textTransform: 'uppercase' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 13.5, lineHeight: 19, paddingHorizontal: 10 },
});
