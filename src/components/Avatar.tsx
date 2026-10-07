import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Typography';
import { AvatarZoomModal } from './AvatarZoomModal';
import { tapLight } from '../lib/haptics';
import { lighten, tierColor, withAlpha } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

function getInitials(name: string): string {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Gradientes que combinam com o azul da marca. Cada pessoa cai sempre no
// mesmo (pela "soma" do nome), então o feed fica colorido mas previsível —
// antes todo mundo era o mesmo círculo verde.
const PALETTES: readonly (readonly [string, string])[] = [
  ['#4a93ff', '#1f5ee8'],
  ['#8b7cf6', '#5b3fd6'],
  ['#2dd4bf', '#0e8f86'],
  ['#fb923c', '#e0531a'],
  ['#f472b6', '#c02f79'],
  ['#4ade80', '#15964a'],
];

function paletteFor(name: string): readonly [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

interface Props {
  name: string;
  size?: number;
  /** Anel colorido simples em volta (ex: cor da patente numa listinha). Ignorado quando `frameTier` está presente. */
  ringColor?: string;
  /**
   * Moldura desbloqueável por patente (Bronze/Prata/Ouro/Platina/Diamante) —
   * anel com degradê e brilho por trás, mais elaborado que `ringColor`. Pra
   * usar nos avatares "hero" (Perfil, perfil de outro usuário), onde a
   * personalização de verdade aparece.
   */
  frameTier?: string | null;
  /** Foto de perfil (se houver) — sem ela, cai pro círculo com iniciais de sempre. */
  uri?: string | null;
  /** Segurar o avatar abre a foto em tela cheia (só faz sentido quando tem `uri`). */
  zoomable?: boolean;
}

/**
 * Moldura de patente: um anel fino na cor da patente, separado da foto por
 * um respiro transparente — discreto, tipo aro de medalha. Ocupa o mesmo
 * espaço total de antes (ver `avatarFrameSize`), então quem ancora coisas na
 * borda (o selo de sequência do Perfil) não muda.
 */
function TierFrame({ tier, size, children }: { tier: string; size: number; children: React.ReactNode }) {
  const { colorBlindMode } = useTheme();
  const base = tierColor(tier, colorBlindMode);
  const ringWidth = Math.max(3, Math.round(size * 0.09));
  const outer = size + ringWidth * 2;
  const frame = outer + 12;
  const stroke = Math.max(2, Math.round(size * 0.035));
  const gap = (frame - size) / 2 - stroke;

  return (
    <View
      style={{
        width: frame,
        height: frame,
        borderRadius: frame / 2,
        borderWidth: stroke,
        borderColor: base,
        padding: gap,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

/**
 * Tamanho total do bloco renderizado por `<Avatar frameTier .../>` pra um
 * dado `size` — a moldura de patente soma o anel + o brilho por trás, então
 * o avatar "hero" ocupa mais espaço que só `size`. Usado por quem precisa
 * ancorar algo (ex: o badge de streak) exatamente na borda da moldura.
 */
export function avatarFrameSize(size: number): number {
  const ringWidth = Math.max(3, Math.round(size * 0.09));
  const outer = size + ringWidth * 2;
  return outer + 12;
}

// Avatar circular com a foto de perfil (quando existe) ou iniciais do nome —
// mesmo padrão visual do ProfileScreen, reutilizado em qualquer lugar que
// mostre outro usuário (busca, feed).
export function Avatar({ name, size = 40, ringColor, frameTier, uri, zoomable }: Props) {
  const [zoomOpen, setZoomOpen] = useState(false);

  const photo = (
    <Image source={{ uri: uri ?? undefined }} style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]} />
  );

  const circle = uri ? (
    zoomable ? (
      <Pressable
        onLongPress={() => {
          tapLight();
          setZoomOpen(true);
        }}
        delayLongPress={280}
        accessibilityRole="imagebutton"
        accessibilityLabel="Foto de perfil — segure para ampliar"
      >
        {photo}
        <AvatarZoomModal visible={zoomOpen} uri={uri} onClose={() => setZoomOpen(false)} />
      </Pressable>
    ) : (
      photo
    )
  ) : (
    <LinearGradient
      colors={paletteFor(name || '?')}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{getInitials(name)}</Text>
    </LinearGradient>
  );

  if (frameTier) {
    return (
      <TierFrame tier={frameTier} size={size}>
        {circle}
      </TierFrame>
    );
  }

  if (!ringColor) return circle;

  const ring = Math.max(2, Math.round(size * 0.04));
  return (
    <View
      style={{
        padding: ring + 1,
        borderRadius: size,
        borderWidth: ring,
        borderColor: ringColor,
      }}
    >
      {circle}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
});
