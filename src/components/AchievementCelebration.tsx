import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Modal, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { supabase } from '../lib/supabase';
import { success } from '../lib/haptics';
import { TIER_LABEL, achievementTierColor } from '../lib/achievements';
import { navigationRef } from '../navigation/navigationRef';
import { AchievementDefinition } from '../types/models';
import { AchievementBadge } from './AchievementBadge';
import { TrainlyButton } from './TrainlyButton';
import { prefersReducedMotion } from './Motion';
import { Text } from './Typography';

const SEEN_KEY = (userId: string) => `trainly:achievements:seenAt:${userId}`;
/** Não consulta o banco mais de uma vez nesse intervalo (troca de tela é frequente). */
const MIN_INTERVAL_MS = 15000;

type Unlocked = AchievementDefinition & { unlockedAt: string };

// Quem quiser forçar uma checagem na hora (ex: logo depois de salvar um treino).
const listeners = new Set<() => void>();
let lastCheck = 0;

/** Pede pra checar conquistas novas. `force` ignora o intervalo mínimo. */
export function requestAchievementCheck(force = false) {
  if (!force && Date.now() - lastCheck < MIN_INTERVAL_MS) return;
  lastCheck = Date.now();
  listeners.forEach((fn) => fn());
}

/**
 * Aviso de "Conquista desbloqueada!". O banco libera as conquistas sozinho
 * (conquistas.sql); aqui o app só descobre as que saíram desde a última vez
 * que avisou — guardando no celular a data do último aviso — e mostra uma de
 * cada vez. Funciona pra conquista ganha em qualquer lugar: treino no app,
 * curtida que alguém deu, ou algo feito no site.
 */
export function AchievementCelebration({ userId, onShown }: { userId: string | undefined; onShown?: () => void }) {
  const { colors, colorBlindMode } = useTheme();
  const [queue, setQueue] = useState<Unlocked[]>([]);
  const checking = useRef(false);
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const check = useCallback(async () => {
    if (!userId || checking.current) return;
    // Durante a introdução não interrompe — ela mesma pede a checagem no fim.
    if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === 'Onboarding') return;
    checking.current = true;
    try {
      const stored = await AsyncStorage.getItem(SEEN_KEY(userId));
      // Primeira vez neste celular: mostra só as das últimas 24h (não todas de uma vez).
      const since = stored ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from('user_achievements')
        .select('achievement_id, unlocked_at')
        .eq('user_id', userId)
        .gt('unlocked_at', since)
        .order('unlocked_at', { ascending: true })
        .limit(10);
      if (error) return;
      const rows = (data ?? []) as { achievement_id: string; unlocked_at: string }[];
      if (!rows.length) {
        if (!stored) await AsyncStorage.setItem(SEEN_KEY(userId), new Date().toISOString());
        return;
      }
      const { data: defs } = await supabase
        .from('achievement_definitions')
        .select('*')
        .in('id', rows.map((r) => r.achievement_id));
      const byId = new Map(((defs ?? []) as AchievementDefinition[]).map((d) => [d.id, d]));
      const fresh = rows
        .filter((r) => byId.has(r.achievement_id))
        .map((r) => ({ ...(byId.get(r.achievement_id) as AchievementDefinition), unlockedAt: r.unlocked_at }));
      // A introdução pode ter aberto enquanto buscava: deixa pra depois (sem marcar como visto).
      if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === 'Onboarding') return;
      await AsyncStorage.setItem(SEEN_KEY(userId), rows[rows.length - 1].unlocked_at);
      if (fresh.length) {
        setQueue((prev) => [...prev, ...fresh.filter((f) => !prev.some((p) => p.id === f.id))]);
        onShown?.();
      }
    } catch {
      // Sem internet: tenta de novo na próxima.
    } finally {
      checking.current = false;
    }
  }, [userId, onShown]);

  useEffect(() => {
    listeners.add(check);
    requestAchievementCheck(true);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestAchievementCheck(true);
    });
    return () => {
      listeners.delete(check);
      sub.remove();
    };
  }, [check]);

  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    success();
    if (prefersReducedMotion()) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    scale.setValue(0.85);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [current, scale, opacity]);

  if (!current) return null;
  const tint = achievementTierColor(current.tier, colorBlindMode);
  const remaining = queue.length - 1;

  const next = () => setQueue((q) => q.slice(1));
  const openAll = () => {
    setQueue([]);
    if (userId && navigationRef.isReady()) navigationRef.navigate('Achievements', { userId });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={next} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border, opacity, transform: [{ scale }] },
          ]}
        >
          <Text style={[styles.kicker, { color: colors.goldText }]}>Conquista desbloqueada!</Text>
          <View style={styles.badgeWrap}>
            <AchievementBadge icon={current.icon} tier={current.tier} unlocked size={96} />
          </View>
          <View style={styles.tierChip}>
            <View style={[styles.tierDot, { backgroundColor: tint }]} />
            <Text style={[styles.tierText, { color: colors.textMuted }]}>{TIER_LABEL[current.tier ?? 'bronze']}</Text>
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{current.title}</Text>
          <Text style={[styles.description, { color: colors.textMuted }]}>{current.description}</Text>
          <View style={[styles.xpPill, { backgroundColor: colors.goldSoft }]}>
            <Ionicons name="star" size={14} color={colors.goldText} />
            <Text style={[styles.xpText, { color: colors.goldText }]}>+{current.xp_reward} XP</Text>
          </View>

          <View style={{ alignSelf: 'stretch', marginTop: 22 }}>
            <TrainlyButton
              variant="gold"
              title={remaining > 0 ? `Próxima (${remaining})` : 'Show!'}
              icon={remaining > 0 ? 'arrow-forward' : 'checkmark'}
              onPress={next}
            />
          </View>
          <Text onPress={openAll} style={[styles.link, { color: colors.primary }]}>
            Ver todas as conquistas
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  sheet: { width: '100%', maxWidth: 380, borderRadius: 24, borderWidth: 1, padding: 24, alignItems: 'center' },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  badgeWrap: { marginTop: 18, marginBottom: 12 },
  tierChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  description: { fontSize: 14, fontWeight: '500', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  xpPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginTop: 14 },
  xpText: { fontSize: 13, fontWeight: '800' },
  link: { fontSize: 13.5, fontWeight: '700', marginTop: 14, padding: 4 },
});
