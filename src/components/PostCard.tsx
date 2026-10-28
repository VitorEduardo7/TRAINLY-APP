import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Post, PostComment } from '../types/models';
import { selection, tapLight, warning } from '../lib/haptics';
import { timeAgo } from '../lib/time';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { CardPhoto } from './Photo';
import { FadeIn, prefersReducedMotion } from './Motion';
import { Text, TextInput } from './Typography';

interface Props {
  post: Post;
  viewerId: string | undefined;
  onToggleLike: (post: Post) => void;
  onAddComment: (post: Post, text: string) => Promise<void>;
  onDeleteComment: (post: Post, comment: PostComment) => Promise<void>;
  onDelete: (post: Post) => Promise<void>;
  onOpenProfile: (userId: string, name?: string) => void;
}

/**
 * Uma publicação do feed de amigos — o mesmo "post" do site: texto e/ou
 * foto, curtidas e comentários. Curtir e comentar só pra amigos (a regra é
 * do banco; aqui o botão só fica apagado pra deixar isso claro).
 */
export function PostCard({ post, viewerId, onToggleLike, onAddComment, onDeleteComment, onDelete, onOpenProfile }: Props) {
  const { colors } = useTheme();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const pop = useRef(new Animated.Value(1)).current;

  const like = () => {
    if (!post.canInteract) {
      Alert.alert('Trainly', 'Só amigos podem curtir essa publicação. Siga essa pessoa pra interagir.');
      return;
    }
    tapLight();
    if (!post.likedByMe && !prefersReducedMotion()) {
      pop.setValue(0.7);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 18 }).start();
    }
    onToggleLike(post);
  };

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onAddComment(post, text);
      setText('');
    } catch (err: any) {
      Alert.alert('Trainly', err?.message ?? 'Não foi possível comentar agora.');
    } finally {
      setSending(false);
    }
  };

  const confirmDeletePost = () => {
    warning();
    Alert.alert('Trainly', 'Apagar essa publicação?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => onDelete(post).catch((err) => Alert.alert('Trainly', err?.message ?? 'Não foi possível apagar.')),
      },
    ]);
  };

  const confirmDeleteComment = (comment: PostComment) => {
    warning();
    Alert.alert('Trainly', 'Apagar esse comentário?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () =>
          onDeleteComment(post, comment).catch((err) => Alert.alert('Trainly', err?.message ?? 'Não foi possível apagar.')),
      },
    ]);
  };

  const likeColor = colors.danger;
  const commentCount = post.comments.length;

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <Pressable
          onPress={() => onOpenProfile(post.userId, post.authorName)}
          style={({ pressed }) => [styles.author, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={`Abrir perfil de ${post.authorName}`}
        >
          <Avatar name={post.authorName} size={40} uri={post.authorAvatarUrl} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.authorName, { color: colors.textPrimary }]} numberOfLines={1}>
              {post.authorName}
            </Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{timeAgo(post.createdAt)}</Text>
          </View>
        </Pressable>
        {post.isMine && (
          <Pressable
            onPress={confirmDeletePost}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Apagar publicação"
            style={[styles.iconBtn, { borderColor: colors.border }]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {post.content ? <Text style={[styles.content, { color: colors.textPrimary }]}>{post.content}</Text> : null}
      {post.photoUrl ? <CardPhoto uri={post.photoUrl} style={{ marginBottom: 12 }} /> : null}

      <View style={styles.actions}>
        <Pressable
          onPress={like}
          hitSlop={6}
          style={[styles.actionBtn, !post.canInteract && { opacity: 0.45 }]}
          accessibilityRole="button"
          accessibilityLabel={post.likedByMe ? 'Descurtir' : 'Curtir'}
          accessibilityState={{ selected: post.likedByMe }}
        >
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <Ionicons name={post.likedByMe ? 'heart' : 'heart-outline'} size={20} color={post.likedByMe ? likeColor : colors.textMuted} />
          </Animated.View>
          <Text style={[styles.actionText, { color: post.likedByMe ? likeColor : colors.textMuted }]}>
            {post.likeCount > 0 ? post.likeCount : 'Curtir'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            selection();
            setCommentsOpen((v) => !v);
          }}
          hitSlop={6}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={commentsOpen ? 'Esconder comentários' : 'Ver comentários'}
        >
          <Ionicons
            name={commentsOpen ? 'chatbubble' : 'chatbubble-outline'}
            size={19}
            color={commentsOpen ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.actionText, { color: commentsOpen ? colors.primary : colors.textMuted }]}>
            {commentCount > 0 ? commentCount : 'Comentar'}
          </Text>
        </Pressable>
      </View>

      {commentsOpen && (
        <FadeIn offset={6} duration={240} style={[styles.comments, { borderColor: colors.border }]}>
          {commentCount === 0 && (
            <Text style={[styles.empty, { color: colors.textMuted }]}>Nenhum comentário ainda. Seja o primeiro!</Text>
          )}
          {post.comments.map((c) => {
            const canDelete = !!viewerId && (c.userId === viewerId || post.userId === viewerId);
            return (
              <View key={c.id} style={styles.commentRow}>
                <Pressable onPress={() => onOpenProfile(c.userId, c.authorName)} hitSlop={4}>
                  <Avatar name={c.authorName} size={30} uri={c.authorAvatarUrl} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <View style={[styles.bubble, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.commentAuthor, { color: colors.textPrimary }]}>{c.authorName}</Text>
                    <Text style={[styles.commentBody, { color: colors.textPrimary }]}>{c.content}</Text>
                  </View>
                  <View style={styles.commentMeta}>
                    <Text style={[styles.commentTime, { color: colors.textMuted }]}>{timeAgo(c.createdAt)}</Text>
                    {canDelete && (
                      <Pressable onPress={() => confirmDeleteComment(c)} hitSlop={8}>
                        <Text style={[styles.commentAction, { color: colors.danger }]}>Apagar</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          })}

          {post.canInteract ? (
            <View style={styles.inputRow}>
              <TextInput
                placeholder="Escreva um comentário..."
                placeholderTextColor={colors.textMuted}
                value={text}
                onChangeText={setText}
                maxLength={500}
                multiline
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              />
              <Pressable
                onPress={send}
                disabled={sending || !text.trim()}
                accessibilityRole="button"
                accessibilityLabel="Enviar comentário"
                style={[styles.sendBtn, { backgroundColor: colors.primary }, (sending || !text.trim()) && { opacity: 0.45 }]}
              >
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={16} color="#fff" />}
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.empty, { color: colors.textMuted }]}>Só amigos podem comentar nessa publicação.</Text>
          )}
        </FadeIn>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorName: { fontSize: 14.5, fontWeight: '700' },
  meta: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { fontSize: 15, fontWeight: '400', lineHeight: 22, marginBottom: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingHorizontal: 2 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  actionText: { fontSize: 13, fontWeight: '600' },
  comments: { borderTopWidth: 1, marginTop: 14, paddingTop: 14, gap: 12 },
  empty: { fontSize: 13, fontWeight: '500' },
  commentRow: { flexDirection: 'row', gap: 10 },
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  commentAuthor: { fontSize: 12.5, fontWeight: '700' },
  commentBody: { fontSize: 13.5, fontWeight: '400', marginTop: 2, lineHeight: 19 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4, marginLeft: 12 },
  commentTime: { fontSize: 11, fontWeight: '500' },
  commentAction: { fontSize: 11.5, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 90,
    textAlignVertical: 'top',
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
