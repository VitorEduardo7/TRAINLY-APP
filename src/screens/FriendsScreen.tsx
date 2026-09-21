import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useFollowing, useFeed, useComments } from '../hooks/useSocial';
import { Card } from '../components/Card';
import { TrainlyButton } from '../components/TrainlyButton';
import { Avatar } from '../components/Avatar';
import { formatClock, formatKm, paceMinPerKm } from '../lib/geo';
import { ActivityComment, FeedActivity, SearchProfile } from '../types/models';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPE_ICON: Record<string, string> = {
  Corrida: '🏃',
  Ciclismo: '🚴',
  Natação: '🏊',
  Caminhada: '🚶',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function FriendsScreen() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const {
    followingIds,
    results,
    searching,
    search,
    follow,
    unfollow,
    reload: reloadFollowing,
  } = useFollowing(profile?.id);
  const { feed, loading, error, toggleLike, reload: reloadFeed } = useFeed(profile?.id, followingIds);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const navigation = useNavigation<Nav>();

  const openProfile = useCallback(
    (userId: string, name?: string) => navigation.navigate('UserProfile', { userId, name }),
    [navigation],
  );

  // `search` entra nas dependências de propósito: ele só existe de verdade
  // depois que o perfil carrega (depende do userId). Sem isso, se o timeout
  // disparasse antes do perfil chegar, a busca saía vazia e não era refeita
  // até digitar outra letra.
  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  // Recarrega quem eu sigo e o feed toda vez que a aba ganha foco — sem isso,
  // uma atividade manual registrada no Dashboard não aparecia aqui ao trocar de aba.
  useFocusEffect(
    useCallback(() => {
      reloadFollowing();
      reloadFeed();
    }, [reloadFollowing, reloadFeed]),
  );

  const handleToggleFollow = async (person: SearchProfile) => {
    setBusyId(person.id);
    try {
      if (person.isFollowing) await unfollow(person.id);
      else await follow(person.id);
    } catch (err: any) {
      // Sem esse catch, uma falha aqui virava "Uncaught (in promise)" — o
      // banner vermelho de erro do Expo na tela, sem explicar nada pro usuário.
      Alert.alert('Trainly', err?.message ?? 'Não foi possível concluir. Tente de novo.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    // Só o topo — a tab bar de baixo já respeita a área segura inferior sozinha.
    // Sem isso, o título "Amigos" ficava embaixo da barra de status/notch no
    // iPhone: era a única aba que não tinha SafeAreaView.
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              reloadFollowing();
              reloadFeed();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={[styles.header, { color: colors.textPrimary }]}>Amigos</Text>

        <TextInput
          placeholder="Buscar atletas pelo nome..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
        />

        {query.trim().length > 0 && (
          <View style={{ marginBottom: 10 }}>
            {searching && <Text style={[styles.empty, { color: colors.textMuted }]}>Buscando...</Text>}
            {!searching && results.length === 0 && (
              <Text style={[styles.empty, { color: colors.textMuted }]}>Ninguém encontrado com esse nome.</Text>
            )}
            {results.map((person) => (
              <Card key={person.id} style={styles.personCard}>
                {/* Toque no avatar/nome abre o perfil; o botão de seguir fica
                    fora do Pressable pra os dois toques não se atrapalharem. */}
                <Pressable
                  onPress={() => openProfile(person.id, person.name)}
                  style={({ pressed }) => [styles.personTap, pressed && { opacity: 0.6 }]}
                >
                  <Avatar name={person.name} size={40} />
                  <Text style={[styles.personName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {person.name}
                  </Text>
                </Pressable>
                <TrainlyButton
                  title={person.isFollowing ? 'Seguindo' : 'Seguir'}
                  variant={person.isFollowing ? 'secondary' : 'primary'}
                  onPress={() => handleToggleFollow(person)}
                  loading={busyId === person.id}
                />
              </Card>
            ))}

          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Feed de Amigos</Text>

        {!loading && feed.length === 0 && (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            {error
              ? 'Não foi possível carregar o feed — puxe a tela pra baixo pra tentar de novo.'
              : followingIds.size === 0
                ? 'Você ainda não segue ninguém. Busque acima pra começar.'
                : 'Ninguém que você segue registrou atividade ainda.'}
          </Text>
        )}

        {feed.map((activity) => (
          <FeedCard
            key={activity.id}
            activity={activity}
            currentUserId={profile?.id}
            onToggleLike={() => toggleLike(activity)}
            onOpenProfile={openProfile}
          />
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FeedCard({
  activity,
  currentUserId,
  onToggleLike,
  onOpenProfile,
}: {
  activity: FeedActivity;
  currentUserId: string | undefined;
  onToggleLike: () => void;
  onOpenProfile: (userId: string, name?: string) => void;
}) {
  const { colors } = useTheme();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [hasLoadedComments, setHasLoadedComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string } | null>(null);
  const {
    comments,
    loading: commentsLoading,
    error: commentsError,
    posting,
    load: loadComments,
    addComment,
    deleteComment,
    canDelete,
  } = useComments(activity.id, currentUserId, activity.user_id);

  // Enquanto a seção ainda não foi aberta, mostra a contagem que já veio
  // pronta do feed. Depois de abrir uma vez, usa o tamanho real da lista —
  // assim apagar até o último comentário zera o número na hora, sem
  // esperar o feed inteiro recarregar.
  // Só troca pra lista real quando ela carregou de fato: enquanto carrega (ou
  // se a busca falhar) a lista está vazia, e usá-la aí zerava a contagem de um
  // post que tem comentários.
  const commentCount =
    hasLoadedComments && !commentsLoading && !commentsError ? comments.length : activity.commentCount;

  const toggleComments = () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    // Recarrega toda vez que abre, não só na primeira vez — sem isso, um
    // comentário novo de outra pessoa (ou uma falha de rede na primeira
    // tentativa) ficava preso: fechar e abrir de novo não tentava de novo.
    if (next) {
      setHasLoadedComments(true);
      loadComments();
    }
  };

  const handleSend = async () => {
    if (!commentText.trim()) return;
    try {
      await addComment(commentText, replyTo?.id ?? null);
      setCommentText('');
      setReplyTo(null);
    } catch (err: any) {
      Alert.alert('Trainly', err?.message ?? 'Não foi possível enviar o comentário.');
    }
  };

  const handleDelete = (comment: ActivityComment) => {
    Alert.alert('Trainly', 'Apagar esse comentário?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(comment.id);
            // Se era o comentário que o usuário tinha selecionado pra
            // responder, tira a "resposta a" pendente — senão o envio
            // seguinte tentaria apontar pra um comentário que não existe
            // mais.
            setReplyTo((prev) => (prev?.id === comment.id ? null : prev));
          } catch {
            Alert.alert('Trainly', 'Não foi possível apagar o comentário.');
          }
        },
      },
    ]);
  };

  return (
    <Card style={styles.feedCard}>
      <Pressable
        onPress={() => onOpenProfile(activity.user_id, activity.authorName)}
        style={({ pressed }) => [styles.feedTop, pressed && { opacity: 0.6 }]}
      >
        <Avatar name={activity.authorName} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.feedAuthor, { color: colors.textPrimary }]}>{activity.authorName}</Text>
          <Text style={[styles.feedMeta, { color: colors.textMuted }]}>
            {timeAgo(activity.date)} · {TYPE_ICON[activity.type] ?? '🏅'} {activity.type}
          </Text>
        </View>
        <Text style={[styles.feedChevron, { color: colors.textMuted }]}>›</Text>
      </Pressable>

      {activity.title ? <Text style={[styles.feedTitle, { color: colors.textPrimary }]}>{activity.title}</Text> : null}

      <View style={[styles.statsRow, { borderColor: colors.border }]}>
        <MiniStat label="Distância" value={`${formatKm(activity.distance_km)} km`} colors={colors} />
        <MiniStat label="Tempo" value={formatClock(activity.duration_sec)} colors={colors} />
        <MiniStat label="Ritmo" value={`${paceMinPerKm(activity.distance_km, activity.duration_sec)}/km`} colors={colors} />
      </View>

      <View style={styles.actionsRow}>
        <Pressable onPress={onToggleLike} style={styles.likeRow}>
          <Text style={{ fontSize: 16 }}>{activity.likedByMe ? '❤️' : '🤍'}</Text>
          <Text style={[styles.likeCount, { color: activity.likedByMe ? colors.primary : colors.textMuted }]}>
            {activity.likeCount > 0 ? activity.likeCount : 'Curtir'}
          </Text>
        </Pressable>

        <Pressable onPress={toggleComments} style={styles.likeRow}>
          <Text style={{ fontSize: 16 }}>💬</Text>
          <Text style={[styles.likeCount, { color: commentsOpen ? colors.primary : colors.textMuted }]}>
            {commentCount > 0 ? commentCount : 'Comentar'}
          </Text>
        </Pressable>
      </View>

      {commentsOpen && (
        <View style={[styles.commentsBox, { borderColor: colors.border }]}>
          {commentsLoading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />}

          {!commentsLoading && commentsError && (
            <Pressable onPress={loadComments}>
              <Text style={[styles.empty, { color: colors.primary }]}>
                Não foi possível carregar os comentários — toque para tentar de novo.
              </Text>
            </Pressable>
          )}

          {!commentsLoading && !commentsError && comments.length === 0 && (
            <Text style={[styles.empty, { color: colors.textMuted }]}>Nenhum comentário ainda. Seja o primeiro!</Text>
          )}

          {!commentsLoading &&
            comments.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                replyToAuthorName={comments.find((c) => c.id === comment.replyToId)?.authorName}
                canDelete={canDelete(comment)}
                onReply={() => setReplyTo({ id: comment.id, authorName: comment.authorName })}
                onDelete={() => handleDelete(comment)}
                onOpenProfile={() => onOpenProfile(comment.userId, comment.authorName)}
              />
            ))}

          {replyTo && (
            <View style={[styles.replyChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.replyChipText, { color: colors.textMuted }]} numberOfLines={1}>
                Respondendo a {replyTo.authorName}
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <Text style={[styles.replyChipClose, { color: colors.textMuted }]}>✕</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              placeholder="Escreva um comentário..."
              placeholderTextColor={colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              style={[
                styles.commentInput,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary },
              ]}
            />
            <Pressable
              onPress={handleSend}
              disabled={posting || !commentText.trim()}
              style={[
                styles.sendBtn,
                { backgroundColor: colors.primary },
                (posting || !commentText.trim()) && { opacity: 0.5 },
              ]}
            >
              {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>➤</Text>}
            </Pressable>
          </View>
        </View>
      )}
    </Card>
  );
}

function CommentRow({
  comment,
  replyToAuthorName,
  canDelete,
  onReply,
  onDelete,
  onOpenProfile,
}: {
  comment: ActivityComment;
  replyToAuthorName?: string;
  canDelete: boolean;
  onReply: () => void;
  onDelete: () => void;
  onOpenProfile: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.commentRow, comment.replyToId ? styles.commentRowReply : null]}>
      <Pressable onPress={onOpenProfile} hitSlop={4}>
        <Avatar name={comment.authorName} size={30} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={[styles.commentBubble, { backgroundColor: colors.background }]}>
          <Text onPress={onOpenProfile} style={[styles.commentAuthor, { color: colors.textPrimary }]}>
            {comment.authorName}
          </Text>
          {replyToAuthorName && (
            <Text style={[styles.commentReplyTag, { color: colors.primary }]}>↳ respondendo a {replyToAuthorName}</Text>
          )}
          <Text style={[styles.commentBody, { color: colors.textPrimary }]}>{comment.body}</Text>
        </View>
        <View style={styles.commentActions}>
          <Text style={[styles.commentTime, { color: colors.textMuted }]}>{timeAgo(comment.createdAt)}</Text>
          <Pressable onPress={onReply} hitSlop={8}>
            <Text style={[styles.commentActionText, { color: colors.textMuted }]}>Responder</Text>
          </Pressable>
          {canDelete && (
            <Pressable onPress={onDelete} hitSlop={8}>
              <Text style={[styles.commentActionText, { color: colors.danger }]}>Apagar</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function MiniStat({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.miniValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.miniLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  header: { fontSize: 24, fontWeight: '900', marginBottom: 16 },
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  empty: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  personCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  personTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  personName: { flex: 1, fontSize: 14.5, fontWeight: '700' },
  feedCard: { marginBottom: 14 },
  feedTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  feedChevron: { fontSize: 22, fontWeight: '700', marginTop: -2 },
  feedAuthor: { fontSize: 14.5, fontWeight: '800' },
  feedMeta: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  feedTitle: { fontSize: 13.5, fontWeight: '600', marginBottom: 12 },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12, marginBottom: 10 },
  miniValue: { fontSize: 13.5, fontWeight: '800' },
  miniLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 3, textTransform: 'uppercase' },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  likeCount: { fontSize: 12.5, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  commentsBox: { borderTopWidth: 1, marginTop: 12, paddingTop: 12, gap: 10 },
  replyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  replyChipText: { fontSize: 11.5, fontWeight: '600', flex: 1 },
  replyChipClose: { fontSize: 13, fontWeight: '800', paddingLeft: 10 },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13.5,
    maxHeight: 90,
    textAlignVertical: 'top',
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  commentRow: { flexDirection: 'row', gap: 10 },
  commentRowReply: { marginLeft: 26 },
  commentBubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  commentAuthor: { fontSize: 12.5, fontWeight: '800' },
  commentReplyTag: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  commentBody: { fontSize: 13, fontWeight: '500', marginTop: 3, lineHeight: 18 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4, marginLeft: 12 },
  commentTime: { fontSize: 10.5, fontWeight: '600' },
  commentActionText: { fontSize: 11.5, fontWeight: '700' },
});
