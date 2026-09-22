import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useClubs } from '../hooks/useClubs';
import { Card } from '../components/Card';
import { TrainlyButton } from '../components/TrainlyButton';
import { CreateClubModal } from '../components/CreateClubModal';
import { ScreenHeader } from '../components/ScreenHeader';
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

  return (
    // Só o topo — a tab bar de baixo já respeita a área segura inferior sozinha.
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
    >
      <ScreenHeader
        title="Clubes"
        right={<TrainlyButton title="+ Criar" onPress={() => setModalVisible(true)} />}
      />

      <Card style={styles.joinCard}>
        <Text style={[styles.joinLabel, { color: colors.textMuted }]}>Entrar em um clube</Text>
        <View style={styles.joinRow}>
          <TextInput
            placeholder="Código de convite"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
            style={[styles.codeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
          />
          <TrainlyButton title="Entrar" onPress={handleJoin} loading={joining} disabled={!code.trim()} />
        </View>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Meus clubes</Text>
      {!loading && myClubs.length === 0 && (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          {error
            ? 'Não foi possível carregar seus clubes — puxe a tela pra baixo pra tentar de novo.'
            : 'Você ainda não está em nenhum clube. Crie um ou entre com um código de convite acima.'}
        </Text>
      )}
      {myClubs.map((club) => (
        <ClubRow key={club.id} club={club} onPress={() => navigation.navigate('ClubDetail', { clubId: club.id })} />
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
    <Card style={styles.clubCard}>
      <Pressable onPress={onPress} style={styles.clubCardMain}>
        <View style={[styles.clubIcon, { backgroundColor: `${colors.primary}22` }]}>
          <Text style={{ fontSize: 20 }}>🏆</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.clubName, { color: colors.textPrimary }]}>{club.name}</Text>
          {club.description ? (
            <Text style={[styles.clubDesc, { color: colors.textMuted }]} numberOfLines={2}>
              {club.description}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  header: { fontSize: 24, fontWeight: '900' },
  joinCard: { marginTop: 18 },
  joinLabel: { fontSize: 12.5, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase' },
  joinRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  codeInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  sectionTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 24, marginBottom: 12 },
  empty: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  clubCard: { marginBottom: 12 },
  clubCardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clubIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  clubName: { fontSize: 15, fontWeight: '800' },
  clubDesc: { fontSize: 12.5, fontWeight: '600', marginTop: 3 },
});
