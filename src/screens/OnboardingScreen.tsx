import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { RANKS, tierColor, withAlpha } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { emblemFor } from '../lib/rank';
import { GOAL_TYPE_LABEL, goalTypeOf, goalValueOf } from '../lib/goal';
import { selection, success, tapLight } from '../lib/haptics';
import { RankBadge } from '../components/RankBadge';
import { ChipSelector } from '../components/ChipSelector';
import { TrainlyButton } from '../components/TrainlyButton';
import { TrainlyInput } from '../components/TrainlyInput';
import { PressableScale } from '../components/Motion';
import { requestAchievementCheck } from '../components/AchievementCelebration';
import { Text } from '../components/Typography';
import { GoalType } from '../types/models';
import { ScrollViewRef } from '../lib/keyboard';
import { RootStackParamList } from '../navigation/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Chave "já viu a introdução" — por conta, guardada no celular. */
export const onboardingKey = (userId: string) => `trainly:onboarding:done:${userId}`;

const PAGES = 4;
const GOAL_OPTIONS = ['Km', 'Atividades', 'Horas'] as const;
const GOAL_BY_LABEL: Record<(typeof GOAL_OPTIONS)[number], GoalType> = { Km: 'km', Atividades: 'activities', Horas: 'hours' };
const LABEL_BY_GOAL: Record<GoalType, (typeof GOAL_OPTIONS)[number]> = { km: 'Km', activities: 'Atividades', hours: 'Horas' };
const SUGGESTIONS: Record<GoalType, number[]> = { km: [20, 50, 100], activities: [8, 12, 20], hours: [5, 10, 20] };
const SUGGESTION_HINT: Record<GoalType, string[]> = {
  km: ['Começando', 'Regular', 'Puxado'],
  activities: ['2 por semana', '3 por semana', '5 por semana'],
  hours: ['Leve', 'Regular', 'Puxado'],
};

/**
 * Introdução no primeiro acesso: 3 telas explicando XP, patentes e o lado
 * social (amigos, clubes, conquistas) e uma 4ª pedindo a meta do mês. Aparece
 * uma vez por conta neste celular; dá pra rever em Configurações.
 */
export function OnboardingScreen() {
  const { colors, colorBlindMode } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollViewRef>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [page, setPage] = useState(0);

  const [goalType, setGoalType] = useState<GoalType>('km');
  const [goal, setGoal] = useState('50');
  const [saving, setSaving] = useState(false);
  const hasSiteFields = !!profile && 'monthly_goal_type' in profile;

  useEffect(() => {
    if (!profile) return;
    setGoalType(goalTypeOf(profile));
    setGoal(String(goalValueOf(profile)).replace('.', ','));
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== page) selection();
    setPage(i);
  };

  const finish = async (saveGoal: boolean) => {
    if (!profile) return;
    if (saveGoal) {
      const value = parseFloat(goal.replace(',', '.'));
      if (!value || value <= 0) {
        Alert.alert('Trainly', 'Escolha uma meta maior que zero.');
        return;
      }
      setSaving(true);
      try {
        const update: Record<string, unknown> = {};
        if (hasSiteFields) {
          update.monthly_goal_type = goalType;
          update.monthly_goal_value = value;
          if (goalType === 'km') update.monthly_goal_km = Math.max(1, Math.round(value));
        } else {
          update.monthly_goal_km = Math.max(1, Math.round(value));
        }
        const { error } = await supabase.from('profiles').update(update).eq('id', profile.id);
        if (error) throw error;
        await refreshProfile();
        success();
      } catch (err: any) {
        Alert.alert('Trainly', err?.message ?? 'Não foi possível salvar a meta.');
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    await AsyncStorage.setItem(onboardingKey(profile.id), new Date().toISOString());
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    setTimeout(() => requestAchievementCheck(true), 600);
  };

  const effectiveType: GoalType = hasSiteFields ? goalType : 'km';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.topBar}>
        <View style={styles.dots}>
          {Array.from({ length: PAGES }).map((_, i) => {
            const w = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [8, 22, 8],
              extrapolate: 'clamp',
            });
            const bg = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [colors.border, colors.primary, colors.border],
              extrapolate: 'clamp',
            });
            return <Animated.View key={i} style={[styles.dot, { width: w, backgroundColor: bg }]} />;
          })}
        </View>
        {page < PAGES - 1 ? (
          <Text onPress={() => goTo(PAGES - 1)} style={[styles.skip, { color: colors.textMuted }]}>
            Pular
          </Text>
        ) : null}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.ScrollView
          ref={scrollRef as any}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onMomentumScrollEnd={onScrollEnd}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {/* 1. XP */}
          <Page width={width}>
            <Hero icon="star" color={colors.gold} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Cada treino vale XP</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              Corrida, pedal, natação ou caminhada: tudo conta. Quanto mais longe e mais tempo, mais XP.
            </Text>
            <View style={[styles.formula, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.formulaLine, { color: colors.textMuted }]}>Exemplo: 5 km em 30 min</Text>
              <Text style={[styles.formulaMath, { color: colors.textPrimary }]}>
                5 × 10 + 30 = <Text style={{ color: colors.goldText }}>80 XP</Text>
              </Text>
              <Text style={[styles.formulaLine, { color: colors.textMuted }]}>km × 10 + minutos</Text>
            </View>
            <Bullet icon="gift" color={colors.gold} text="Recompensa diária: +20 XP só por abrir o app." />
            <Bullet icon="trophy" color={colors.gold} text="Conquistas e desafios dão XP extra." />
          </Page>

          {/* 2. Patentes */}
          <Page width={width}>
            <Hero icon="shield-half" color={tierColor('Ouro', colorBlindMode)} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Suba de patente</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              O XP vai enchendo seu nível. A cada nível novo fica um pouco mais difícil, e de tempos em tempos você
              troca de patente.
            </Text>
            <View style={styles.ranks}>
              {RANKS.map((r) => (
                <View key={r.name} style={styles.rankItem}>
                  <RankBadge icon={emblemFor(r.name)} color={tierColor(r.name, colorBlindMode)} size={46} />
                  <Text style={[styles.rankName, { color: colors.textPrimary }]}>{r.name}</Text>
                  <Text style={[styles.rankLevel, { color: colors.textMuted }]}>nível {r.min}</Text>
                </View>
              ))}
            </View>
            <Bullet icon="color-palette" color={colors.primary} text="Cada patente libera molduras de avatar e cores de mapa." />
            <Bullet icon="flame" color={colors.primary} text="Treine toda semana pra manter sua sequência acesa." />
          </Page>

          {/* 3. Social */}
          <Page width={width}>
            <Hero icon="people" color={colors.primary} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Treine junto</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>Motivação fica mais fácil com companhia.</Text>
            <Feature
              icon="chatbubbles"
              title="Amigos"
              text="Siga atletas, publique fotos e comente as publicações dos amigos."
            />
            <Feature
              icon="shield"
              title="Clubes"
              text="Entre ou crie um clube, faça desafios entre os membros e dispute a Guerra de Clã."
            />
            <Feature
              icon="map"
              title="Rotas"
              text="Publique o trajeto das suas corridas e descubra rotas perto de você."
            />
            <Feature
              icon="trophy"
              title="Conquistas"
              text="Mais de 80 pra desbloquear, algumas secretas. Boa sorte!"
            />
          </Page>

          {/* 4. Meta do mês */}
          <Page width={width}>
            <Hero icon="flag" color={colors.success} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Qual sua meta do mês?</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              Ela aparece na tela inicial e enche conforme você treina. Dá pra mudar quando quiser no perfil.
            </Text>

            {hasSiteFields ? (
              <ChipSelector
                options={GOAL_OPTIONS}
                value={LABEL_BY_GOAL[goalType]}
                onChange={(v) => {
                  const t = GOAL_BY_LABEL[v];
                  setGoalType(t);
                  setGoal(String(SUGGESTIONS[t][1]));
                }}
                style={{ marginTop: 18 }}
              />
            ) : null}

            <View style={styles.suggestions}>
              {SUGGESTIONS[effectiveType].map((n, i) => {
                const active = goal.replace(',', '.') === String(n);
                return (
                  <PressableScale
                    key={n}
                    onPress={() => {
                      tapLight();
                      setGoal(String(n));
                    }}
                    style={[
                      styles.suggestion,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? withAlpha(colors.primary, 0.12) : colors.card,
                      },
                    ]}
                  >
                    <Text style={[styles.suggestionValue, { color: colors.textPrimary }]}>{n}</Text>
                    <Text style={[styles.suggestionHint, { color: colors.textMuted }]}>{SUGGESTION_HINT[effectiveType][i]}</Text>
                  </PressableScale>
                );
              })}
            </View>
            <TrainlyInput
              label={`Ou digite (${GOAL_TYPE_LABEL[effectiveType]} por mês)`}
              value={goal}
              onChangeText={setGoal}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </Page>
        </Animated.ScrollView>

        <View style={styles.bottom}>
          {page < PAGES - 1 ? (
            <TrainlyButton size="lg" title="Próximo" icon="arrow-forward" onPress={() => goTo(page + 1)} />
          ) : (
            <>
              <TrainlyButton size="lg" title="Começar a treinar" icon="checkmark" onPress={() => finish(true)} loading={saving} />
              <Text onPress={() => finish(false)} style={[styles.later, { color: colors.textMuted }]}>
                Agora não
              </Text>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Page({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function Hero({ icon, color }: { icon: IconName; color: string }) {
  return (
    <View style={[styles.hero, { backgroundColor: withAlpha(color, 0.14), borderColor: withAlpha(color, 0.4) }]}>
      <Ionicons name={icon} size={44} color={color} />
    </View>
  );
}

function Bullet({ icon, color, text }: { icon: IconName; color: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.bullet}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.bulletText, { color: colors.textPrimary }]}>{text}</Text>
    </View>
  );
}

function Feature({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.feature, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.featureIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.featureText, { color: colors.textMuted }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, height: 44 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  skip: { fontSize: 14, fontWeight: '700', padding: 6 },
  page: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  hero: {
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: { fontSize: 34, fontWeight: '900', fontStyle: 'italic', lineHeight: 38 },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 22, marginTop: 10 },
  formula: { borderWidth: 1, borderRadius: 18, padding: 18, marginTop: 22, marginBottom: 14, alignItems: 'center' },
  formulaLine: { fontSize: 13, fontWeight: '600' },
  formulaMath: { fontSize: 30, fontWeight: '900', fontStyle: 'italic', marginVertical: 6 },
  bullet: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12 },
  bulletText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  ranks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 26, marginBottom: 14 },
  rankItem: { alignItems: 'center', flex: 1 },
  rankName: { fontSize: 12.5, fontWeight: '800', marginTop: 8 },
  rankLevel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  feature: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12, alignItems: 'center' },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontSize: 15, fontWeight: '800' },
  featureText: { fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 2 },
  suggestions: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 16 },
  suggestion: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  suggestionValue: { fontSize: 24, fontWeight: '900', fontStyle: 'italic' },
  suggestionHint: { fontSize: 11, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  bottom: { paddingHorizontal: 24, paddingBottom: 12, paddingTop: 8 },
  later: { textAlign: 'center', fontSize: 14, fontWeight: '700', marginTop: 12, padding: 4 },
});
