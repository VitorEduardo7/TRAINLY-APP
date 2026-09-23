import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Text } from './Typography';
import { FadeIn } from './Motion';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  icon: IconName;
  title: string;
  message?: string;
  /** Botão/ação opcional embaixo (ex: "Tentar de novo"). */
  action?: React.ReactNode;
  /** Versão menor, pra usar dentro de um card. */
  compact?: boolean;
}

/** Estado vazio ilustrado: ícone num círculo, título e explicação. */
export function EmptyState({ icon, title, message, action, compact }: Props) {
  const { colors } = useTheme();
  const circle = compact ? 48 : 64;
  return (
    <FadeIn style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.circle, { width: circle, height: circle, borderRadius: circle / 2, backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={compact ? 22 : 28} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }, compact && { fontSize: 14 }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 18 },
  wrapCompact: { paddingVertical: 14 },
  circle: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 15.5, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 6, lineHeight: 19, maxWidth: 300 },
  action: { marginTop: 18, alignSelf: 'stretch', paddingHorizontal: 30 },
});
