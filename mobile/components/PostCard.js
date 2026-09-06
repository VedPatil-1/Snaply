import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { resolveMediaUrl, resolvePostMediaUrl } from '../config';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, radius, shadows, spacing, typography } from '../theme';

export default function PostCard({ post, currentUser, onLike, onFollowToggle, onAddComment, onShare, onSave, onProfileClick }) {
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [mediaAspectRatio, setMediaAspectRatio] = useState(0.8);
  const lastTapRef = useRef(0);
  const heartScale = useRef(new Animated.Value(0.4)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  const isCurrentUser = currentUser && post.user && String(post.user._id) === String(currentUser._id);
  const isFollowing = post.user && post.user.isFollowing;
  const caption = post.caption || 'No caption';
  const comments = Array.isArray(post.comments)
    ? [...new Map(post.comments
      .filter((comment) => comment?._id)
      .map((comment) => [String(comment._id), comment])).values()].reverse()
    : [];
  const likesCount = post.likesCount || post.likes?.length || 0;
  const saved = Boolean(post.isSaved);
  const resolvedMediaUrl = resolvePostMediaUrl(post);

  useEffect(() => {
    console.log('[Snaply] post media', {
      id: post?._id,
      mediaType: post?.mediaType,
      original: post?.mediaUrl || post?.imageUrl || post?.media?.url || post?.image || post?.url,
      resolved: resolvedMediaUrl,
    });
  }, [post?._id, post?.mediaType, resolvedMediaUrl]);

  useEffect(() => {
    if (showComments) console.log('[Snaply] comments rendered:', comments.length);
  }, [showComments, comments.length]);

  const triggerHeart = () => {
    setShowHeart(true);
    heartScale.setValue(0.4);
    heartOpacity.setValue(1);

    Animated.parallel([
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(heartOpacity, {
        toValue: 0,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowHeart(false);
    });
  };

  const handleDoubleTap = () => {
    const now = Date.now();

    if (now - lastTapRef.current < 300) {
      if (!post.isLiked) {
        onLike(post._id);
      }
      triggerHeart();
    }

    lastTapRef.current = now;
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    setShowComments(true);

    try {
      await onAddComment(post._id, commentText.trim());
      setCommentText('');
    } catch (error) {
      // Keep the typed comment available when the existing API fails.
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.authorRow} activeOpacity={0.8} onPress={() => onProfileClick?.(post.user?._id)}>
          {post.user?.profilePicture ? <Image source={{ uri: resolveMediaUrl(post.user.profilePicture) }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitial}>{post.user?.username?.charAt(0)?.toUpperCase() || 'U'}</Text></View>}
          <View>
            <Text style={styles.username}>{post.user?.username || 'unknown'}</Text>
            {post.location ? <Text style={styles.location}>{post.location}</Text> : null}
          </View>
        </TouchableOpacity>

        {!isCurrentUser && post.user?._id ? (
          <TouchableOpacity
            style={[styles.followButton, isFollowing && styles.followingButton]}
            onPress={() => onFollowToggle(post.user._id, Boolean(isFollowing))}
          >
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap}>
        <View style={[styles.mediaContainer, { aspectRatio: mediaAspectRatio }]}>
          {resolvedMediaUrl ? (
            <Image
              source={{ uri: resolvedMediaUrl }}
              style={styles.image}
              resizeMode="contain"
              onLoad={(event) => {
                const source = event.nativeEvent?.source;
                if (source?.width && source?.height) {
                  setMediaAspectRatio(Math.max(0.8, source.width / source.height));
                }
              }}
            />
          ) : <View style={[styles.image, styles.mediaFallback]} />}
        </View>
        {showHeart ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.heartOverlay, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]}
          >
            <Text style={styles.heartText}>♥</Text>
          </Animated.View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={() => onLike(post._id)} style={styles.actionButton}>
            <Ionicons name={post.isLiked ? 'heart' : 'heart-outline'} size={24} color={post.isLiked ? '#ef4444' : '#111827'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowComments((value) => !value)} style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={22} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onShare?.(post)} style={styles.actionButton}>
            <Ionicons name="paper-plane-outline" size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => onSave?.(post._id, !saved)} style={styles.actionButton}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.metaBlock}>
        <Text style={styles.likesText}>{likesCount} likes</Text>
        <Text style={styles.captionText}>
          <Text style={styles.captionUser}>{post.user?.username || 'user'}</Text> {caption}
        </Text>
        <Text style={styles.timeText}>2h ago</Text>
      </View>

      {showComments ? (
        <View style={styles.commentsBlock}>
          {comments.length ? (
            comments.slice(0, 2).map((comment) => (
              <Text key={String(comment._id)} style={styles.commentText}>
                <Text style={styles.commentUser}>{comment.user?.username || 'user'}</Text> {comment.text}
              </Text>
            ))
          ) : (
            <Text style={styles.emptyCommentText}>Be the first to comment.</Text>
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              style={styles.commentInput}
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity onPress={handleSubmitComment} style={styles.commentButton}>
              <Text style={styles.commentButtonText}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  avatarFallback: { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#374151', fontWeight: '800' },
  username: {
    ...typography.body,
    fontWeight: '800',
    color: colors.text,
  },
  location: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  followingButton: {
    backgroundColor: '#e5e7eb',
  },
  followButtonText: {
    color: colors.accentDeep,
    fontWeight: '800',
    fontSize: 12,
  },
  followingButtonText: {
    color: '#111827',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
  },
  mediaContainer: {
    width: '100%',
    minHeight: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  mediaFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    top: '37%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartText: {
    fontSize: 72,
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 16,
  },
  actionText: {
    fontSize: 26,
    lineHeight: 26,
  },
  likedText: {
    color: '#ef4444',
  },
  metaBlock: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  likesText: {
    fontWeight: '700',
    color: '#111827',
    fontSize: 14,
    marginBottom: 6,
  },
  captionText: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  captionUser: {
    fontWeight: '700',
    color: '#111827',
  },
  timeText: {
    marginTop: 6,
    color: '#9ca3af',
    fontSize: 11,
  },
  commentsBlock: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  commentText: {
    color: '#374151',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  commentUser: {
    fontWeight: '700',
    color: '#111827',
  },
  emptyCommentText: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 8,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginTop: 8,
    paddingHorizontal: 10,
  },
  commentInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#111827',
    fontSize: 13,
  },
  commentButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  commentButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
});
