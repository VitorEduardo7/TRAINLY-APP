import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { ScreenWashKey } from '../theme/colors';
import { NotificationBell } from './NotificationBell';
import { Text } from './Typography';

interface Props {
  title: string;
  /** Linha menor em cima do título (ex: "Bom dia,"). */
  subtitle?: string;
  /** Algo antes do título, na mesma linha (ex: um avatar). */
  leading?: React.ReactNode;
  /** Ação extra à esquerda do sino — ex: o botão "Criar" em Clubes. */
  right?: React.ReactNode;
  /**
   * Aceito só por compatibilidade: no redesign anterior virava um bloco
   * "hero" com blobs de gradiente. Na identidade Arena o cabeçalho é liso,
   * igual em todas as abas — o destaque fica no conteúdo, não no topo.
   */
  wash?: ScreenWashKey;
}

/**
 * Cabeçalho reaproveitado em toda tela principal (aba): título grande em
 * Barlow Condensed + sino de notificações sempre visível.
 */
export function ScreenHeader({ title, subtitle, leading, right }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        {leading}
        <View style={styles.titleText}>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {right}
        <NotificationBell />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 20, gap: 10 },
  titles: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  titleText: { flexShrink: 1 },
  subtitle: { fontSize: 13.5, fontWeight: '600', marginBottom: 2 },
  title: { fontSize: 40, fontWeight: '900', letterSpacing: -0.3, lineHeight: 44 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
