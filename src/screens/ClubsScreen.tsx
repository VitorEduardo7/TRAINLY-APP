import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { SCREEN_WASH, withAlpha } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { useClubs } from '../hooks/useClubs';
import { Card } from '../components/Card';
import { TrainlyButton } from '../components/TrainlyButton';
import { CreateClubModal } from '../components/CreateClubModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionTitle } from '../components/SectionTitle';
import { FadeIn, PressableScale } from '../components/Motion';
import { SkeletonCard } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { Text, TextInput } from '../components/Typography';
import { Club } from '../types/models';
import { RootStackParamList } from '../navigation/types';

export function ClubsScreen() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { myClubs, loading, error, reload, joinByCode, createClub } = useClubs(profile?.id);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Recarrega a lista toda vez que essa aba ganha foco de novo — sem isso,
  // sair/entrar num clube na tela de detalhe não refletia aqui ao voltar.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [code, setCode] = useState('');
  const [codeFocused, setCodeFocused] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const club = await joinByCode(code);
      setCode('');
      navigation.navigate('ClubDetail', { clubId: club.id });
    } catch (err: any) {
      Alert.alert('Trainly', err.message ?? 'Não foi possível entrar no clube.');
    } finally {
      setJoining(false);
    }
  };

  const firstLoad = loading && myClubs.length === 0 && !error;

  return (
    // Só o topo — a tab bar de baixo já respeita a área segura inferior sozinha.
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
      >
        <ScreenHeader
          wash="clubs"
          title="Clubes"
          right={<TrainlyButton size="sm" title="Criar" icon="add" onPress={() => setModalVisible(true)} />}
        />

        <FadeIn>
          <Card accent={SCREEN_WASH.clubs} style={styles.joinCard}>
            <LinearGradient
              colors={[withAlpha(SCREEN_WASH.clubs[0], 0.14), 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.joinHeader}>
              <View style={[styles.joinIcon, { backgroundColor: withAlpha(SCREEN_WASH.clubs[0], 0.16) }]}>
                <Ionicons name="key" size={18} color={SCREEN_WASH.clubs[0]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.joinTitle, { color: colors.textPrimary }]}>Entrar em um clube</Text>
                <Text style={[styles.joinHint, { color: colors.textMuted }]}>Peça o código de convite pra quem criou.</Text>
              </View>
            </View>
            <View style={styles.joinRow}>
              <TextInput
                placeholder="CÓDIGO"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                value={code}
                onChangeText={setCode}
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: codeFocused ? SCREEN_WASH.clubs[0] : colors.border,
                    color: colors.textPrimary,
                  },
                ]}
              />
              <TrainlyButton title="Entrar" icon="enter-outline" onPress={handleJoin} loading={joining} disabled={!code.trim()} />
            </View>
          </Card>
        </FadeIn>

        <SectionTitle
          title="Meus clubes"
          style={{ marginTop: 26 }}
          right={
            myClubs.length > 0 ? (
              <Text style={[styles.count, { color: colors.textMuted }]}>{myClubs.length}</Text>
            ) : undefined
          }
        />

        {firstLoad && (
          <>
            <SkeletonCard withStats={false} />
            <SkeletonCard withStats={false} />
          </>
        )}

        {!loading && myClubs.length === 0 && (
          <EmptyState
            icon={error ? 'cloud-offline-outline' : 'trophy-outline'}
            title={error ? 'Não foi possível carregar' : 'Nenhum clube ainda'}
            message={
              error
                ? 'Puxe a tela pra baixo pra tentar de novo.'
                : 'Crie um clube pra treinar com a sua turma, ou entre com um código de convite acima.'
            }
          />
        )}

        {myClubs.map((club, i) => (
          <FadeIn key={club.id} delay={Math.min(i, 5) * 60}>
            <ClubRow club={club} onPress={() => navigation.navigate('ClubDetail', { clubId: club.id })} />
          </FadeIn>
        ))}

        <CreateClubModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSave={async (name, description) => {
            const club = await createClub(name, description);
            navigation.navigate('ClubDetail', { clubId: club.id });
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ClubRow({ club, onPress }: { club: Club; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={{ marginBottom: 12 }}>
      <Card style={styles.clubCard}>
        <LinearGradient colors={SCREEN_WASH.clubs} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.clubIcon}>
          <Ionicons name="trophy" size={20} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[styles.clubName, { color: colors.textPrimary }]} numberOfLines={1}>
            {club.name}
          </Text>
          {club.description ? (
            <Text style={[styles.clubDesc, { color: colors.textMuted }]} numberOfLines={2}>
              {club.description}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 130 },
  joinCard: { overflow: 'hidden' },
  joinHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  joinIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  joinTitle: { fontSize: 15, fontWeight: '800' },
  joinHint: { fontSize: 12.5, fontWeight: '500', marginTop: 2 },
  joinRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  codeInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.5,
    minHeight: 52,
  },
  count: { fontSize: 12, fontWeight: '700' },
  clubCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  clubIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  clubName: { fontSize: 15.5, fontWeight: '800' },
  clubDesc: { fontSize: 12.5, fontWeight: '500', marginTop: 3, lineHeight: 17 },
});
