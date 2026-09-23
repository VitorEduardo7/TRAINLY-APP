import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { ScreenWashKey, SCREEN_WASH, withAlpha } from '../theme/colors';
import { useNotifications } from '../hooks/useNotifications';
import { RootStackParamList } from '../navigation/types';
import { PressableScale } from './Motion';
import { GradientBackdrop } from './GradientBackdrop';
import { Text } from './Typography';
import { tapLight } from '../lib/haptics';

interface Props {
  title: string;
  /** Linha menor em cima do título (ex: "Bom dia," no Início). */
  subtitle?: string;
  /** Algo antes do título, na mesma linha (ex: o avatar no Início). */
  leading?: React.ReactNode;
  /** Ação extra à esquerda do sino — ex: o botão "Criar" em Clubes. */
  right?: React.ReactNode;
  /**
   * Identidade de cor da aba — quando presente, o cabeçalho vira um bloco
   * "hero" arredondado com blobs de gradiente atrás (ver `GradientBackdrop`).
   * Cada aba tem a sua (`SCREEN_WASH`), pra não parecer tudo a mesma tela azul.
   */
  wash?: ScreenWashKey;
}

/**
 * Cabeçalho reaproveitado em toda tela principal (aba): título + sino de
 * notificações sempre visível. Com `wash`, ganha o tratamento "hero" do
 * redesign — cor de fundo própria por aba, cantos arredondados.
 */
export function ScreenHeader({ title, subtitle, leading, right, wash }: Props) {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { unreadCount } = useNotifications();
  const hasUnread = unreadCount > 0;
  const washColors = wash ? SCREEN_WASH[wash] : undefined;

  const content = (
    <View style={[styles.row, wash && styles.rowHero]}>
      <View style={styles.titles}>
        {leading}
        <View style={styles.titleText}>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={[styles.title, wash && styles.titleHero, { color: colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {right}
        <PressableScale
          onPress={() => {
            tapLight();
            navigation.navigate('Notifications');
          }}
          hitSlop={10}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel="Notificações"
          accessibilityHint={hasUnread ? `${unreadCount} novas` : undefined}
          style={[
            styles.bellBtn,
            wash
              ? { backgroundColor: withAlpha('#ffffff', 0.14), borderColor: withAlpha('#ffffff', 0.22) }
              : { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name={hasUnread ? 'notifications' : 'notifications-outline'}
            size={19}
            color={hasUnread ? colors.accent : colors.textPrimary}
          />
          {hasUnread && (
            <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.background }]}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </PressableScale>
      </View>
    </View>
  );

  if (!washColors) return content;

  return (
    <View style={styles.heroWrap}>
      <GradientBackdrop wash={washColors} />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: { borderRadius: 28, overflow: 'hidden', marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 10 },
  rowHero: { marginBottom: 0, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 24 },
  titles: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  titleText: { flexShrink: 1 },
  subtitle: { fontSize: 13, fontWeight: '600', marginBottom: 1 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  titleHero: { fontSize: 28, letterSpacing: -0.7 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
});
