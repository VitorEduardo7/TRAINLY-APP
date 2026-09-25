import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { withAlpha } from '../theme/colors';
import { emblemFor } from '../lib/rank';
import { Text } from './Typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Props {
  tierName: string;
  color: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Selo flutuante no canto do mapa mostrando qual patente está "vestindo" o
 * traçado — sem ele, a cor sozinha não deixa claro que é uma personalização
 * (podia parecer só um azul diferente por acaso).
 */
export function MapTierBadge({ tierName, color, style }: Props) {
  return (
    <View style={[styles.badge, { borderColor: withAlpha(color, 0.55) }, style]}>
      <Ionicons name={emblemFor(tierName) as IconName} size={12} color={color} />
      <Text style={styles.text}>{tierName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(10,11,15,0.68)',
  },
  text: { fontSize: 11, fontWeight: '800', color: '#ffffff', letterSpacing: 0.2 },
});
