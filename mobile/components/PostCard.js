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
import Video from 'react-native-video';
import { colors, radius, spacing, typography } from '../theme';

export default function PostCard({ post, currentUser, onLike, onFollowToggle, onAddComment, onShare, onSave, onProfileClick }) {
  const resolvedMediaUrl = resolvePostMediaUrl(post);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [mediaAspectRatio, setMediaAspectRatio] = useState(0.8);
  const [mediaLoading, setMediaLoading] = useState(Boolean(resolvedMediaUrl));
  const [mediaError, setMediaError] = useState(false);
  const lastTapRef = useRef(0);
  const heartScale = useRef(new Animated.Value(0.4)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const mediaPulse = useRef(new Animated.Value(0.35)).current;
  const actionVersionRef = useRef({ like: 0, save: 0 });
  const [optimisticLiked, setOptimisticLiked] = useState(Boolean(post.isLiked));
  const [optimisticLikesCount, setOptimisticLikesCount] = useState(Number(post.likesCount ?? post.likes?.length ?? 0));
  const [optimisticSaved, setOptimisticSaved] = useState(Boolean(post.isSaved));

  const isCurrentUser = currentUser && post.user && String(post.user._id) === String(currentUser._id);
  const isFollowing = post.user && post.user.isFollowing;
  const caption = String(post.caption || '').trim();
  const isVideo = String(post.mediaType || '').toLowerCase() === 'video';
  const comments = Array.isArray(post.comments)
    ? [...new Map(post.comments
      .filter((comment) => comment?._id)
      .map((comment) => [String(comment._id), comment])).values()].reverse()
    : [];
  const likesCount = optimisticLikesCount;
  const saved = optimisticSaved;
  useEffect(() => {
    console.log('[Snaply] post media', {
      id: post?._id,
      mediaType: post?.mediaType,
      original: post?.mediaUrl || post?.imageUrl || post?.media?.url || post?.image || post?.url,
      resolved: resolvedMediaUrl,
    });
  }, [
    post?._id,
    post?.mediaType,
    post?.mediaUrl,
    post?.imageUrl,
    post?.media?.url,
    post?.image,
    post?.url,
    resolvedMediaUrl,
  ]);

  useEffect(() => {
    if (showComments) console.log('[Snaply] comments rendered:', comments.length);
  }, [showComments, comments.length]);

  useEffect(() => {
    setOptimisticLiked(Boolean(post.isLiked));
    setOptimisticLikesCount(Number(post.likesCount ?? post.likes?.length ?? 0));
    setOptimisticSaved(Boolean(post.isSaved));
  }, [post._id, post.isLiked, post.likesCount, post.likes?.length, post.isSaved]);

  useEffect(() => {
    setMediaLoading(Boolean(resolvedMediaUrl));
    setMediaError(false);
    setMediaAspectRatio(0.8);
  }, [resolvedMediaUrl]);

  useEffect(() => {
    if (!mediaLoading) return undefined;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(mediaPulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(mediaPulse, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [mediaLoading, mediaPulse]);

  const formatPostTime = (value) => {
    const timestamp = new Date(value).getTime();
    if (!value || Number.isNaN(timestamp)) return 'Just now';
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    if (minutes < 10080) return `${Math.floor(minutes / 1440)}d`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

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
      if (!optimisticLiked) handleLikePress();
      triggerHeart();
    }

    lastTapRef.current = now;
  };

  const handleLikePress = async () => {
    const actionVersion = actionVersionRef.current.like + 1;
    actionVersionRef.current.like = actionVersion;
    const previousLiked = optimisticLiked;
    const previousCount = optimisticLikesCount;
    const nextLiked = !previousLiked;
    setOptimisticLiked(nextLiked);
    setOptimisticLikesCount(Math.max(0, previousCount + (nextLiked ? 1 : -1)));

    try {
      const response = await onLike?.(post._id, nextLiked);
      if (actionVersionRef.current.like !== actionVersion) return;
      if (response?.isLiked !== undefined) setOptimisticLiked(Boolean(response.isLiked));
      if (response?.likesCount !== undefined) setOptimisticLikesCount(Number(response.likesCount));
    } catch (error) {
      if (actionVersionRef.current.like !== actionVersion) return;
      setOptimisticLiked(previousLiked);
      setOptimisticLikesCount(previousCount);
    }
  };

  const handleSavePress = async () => {
    const actionVersion = actionVersionRef.current.save + 1;
    actionVersionRef.current.save = actionVersion;
    const previousSaved = optimisticSaved;
    const nextSaved = !previousSaved;
    setOptimisticSaved(nextSaved);

    try {
      const response = await onSave?.(post._id, nextSaved);
      if (actionVersionRef.current.save !== actionVersion) return;
      if (response?.isSaved !== undefined) setOptimisticSaved(Boolean(response.isSaved));
    } catch (error) {
      if (actionVersionRef.current.save !== actionVersion) return;
      setOptimisticSaved(previousSaved);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    const submittedText = commentText.trim();
    setShowComments(true);
    setCommentText('');

    try {
      await onAddComment(post._id, submittedText);
    } catch (error) {
      setCommentText(submittedText);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.authorRow} activeOpacity={0.8} onPress={() => onProfileClick?.(post.user?._id)}>
          {post.user?.profilePicture ? <Image source={{ uri: resolveMediaUrl(post.user.profilePicture) }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitial}>{post.user?.username?.charAt(0)?.toUpperCase() || 'U'}</Text></View>}
          <View style={styles.authorText}>
            <Text style={styles.username}>{post.user?.username || 'unknown'}</Text>
            <Text style={styles.location} numberOfLines={1}>
              {post.location || formatPostTime(post.createdAt)}
            </Text>
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
        <TouchableOpacity style={styles.moreButton} accessibilityLabel="Post menu">
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap}>
        <View style={[styles.mediaContainer, { aspectRatio: mediaAspectRatio }]}>
          {resolvedMediaUrl ? (
            <>
              {isVideo ? (
                <Video
                  source={{ uri: resolvedMediaUrl }}
                  style={styles.image}
                  resizeMode="cover"
                  paused
                  muted
                  repeat={false}
                  controls
                  onLoad={() => setMediaLoading(false)}
                  onError={() => {
                    setMediaLoading(false);
                    setMediaError(true);
                  }}
                />
              ) : <Image
                source={{ uri: resolvedMediaUrl }}
                style={styles.image}
                resizeMode="cover"
                onLoadStart={() => {
                  setMediaLoading(true);
                  setMediaError(false);
                }}
                onLoad={(event) => {
                  setMediaLoading(false);
                  const source = event.nativeEvent?.source;
                  if (source?.width && source?.height) {
                    setMediaAspectRatio(Math.min(1.35, Math.max(0.75, source.width / source.height)));
                  }
                }}
                onError={() => {
                  setMediaLoading(false);
                  setMediaError(true);
                }}
              />}
              {mediaLoading ? (
                <Animated.View style={[styles.mediaStatus, styles.mediaSkeleton, { opacity: mediaPulse }]}>
                  <View style={styles.skeletonMark} />
                </Animated.View>
              ) : null}
              {mediaError ? (
                <View style={styles.mediaStatus}>
                  <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                  <Text style={styles.mediaStatusText}>This snap could not be loaded.</Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.mediaStatus}>
              <Ionicons name="images-outline" size={30} color={colors.textMuted} />
              <Text style={styles.mediaStatusText}>Media is unavailable</Text>
            </View>
          )}
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
          <TouchableOpacity onPress={handleLikePress} style={styles.actionButton}>
            <Ionicons name={optimisticLiked ? 'heart' : 'heart-outline'} size={24} color={optimisticLiked ? '#ef4444' : '#111827'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowComments((value) => !value)} style={styles.actionButton}>
            <Ionicons name="chatbubble-outline" size={22} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onShare?.(post)} style={styles.actionButton}>
            <Ionicons name="paper-plane-outline" size={22} color="#111827" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleSavePress} style={styles.actionButton}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.metaBlock}>
        <View style={styles.socialLine}>
          <View style={styles.likeCount}>
            {optimisticLiked ? <Ionicons name="heart" size={14} color={colors.like} /> : null}
            <Text style={styles.likesText}>{likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}</Text>
          </View>
          <Text style={styles.timeText}>{formatPostTime(post.createdAt)}</Text>
        </View>
        {caption ? (
          <Text style={styles.captionText}>
            <Text style={styles.captionUser}>{post.user?.username || 'user'} </Text>
            {caption}
          </Text>
        ) : null}
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
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
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
  authorText: {
    flex: 1,
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
    backgroundColor: colors.accentSoft,
  },
  followButtonText: {
    color: colors.accentDeep,
    fontWeight: '800',
    fontSize: 12,
  },
  moreButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  followingButtonText: {
    color: colors.accentDeep,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.bg,
    alignSelf: 'center',
  },
  mediaContainer: {
    width: '100%',
    minHeight: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  mediaFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaStatus: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  mediaStatusText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  mediaSkeleton: {
    backgroundColor: '#E8E5E1',
  },
  skeletonMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#D1CCC6',
    backgroundColor: '#F2F0ED',
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
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 44,
    height: 44,
    marginRight: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
  socialLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  likeCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
