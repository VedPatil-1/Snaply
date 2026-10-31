import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { apiRequest, toggleFollow } from '../services/api';
import PostCard from '../components/PostCard';
import { publishPostUpdate, publishUserUpdate, subscribeToPostUpdates, subscribeToUserUpdates } from '../services/sync';

export default function PostDetailScreen({ route, navigation }) {
  const postId = route?.params?.postId;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const likeQueueRef = useRef(Promise.resolve());
  const likeServerStateRef = useRef(null);
  const followVersionRef = useRef(0);

  useEffect(() => {
    const loadPost = async () => {
      if (!postId) {
        setError('Missing post id');
        setLoading(false);
        return;
      }

      try {
        const [me, data] = await Promise.all([
          apiRequest('/users/me'),
          apiRequest(`/posts/${postId}`),
        ]);
        setCurrentUser(me);
        setPost(data);
      } catch (err) {
        setError(err.message || 'Unable to load post');
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [postId]);

  useEffect(() => {
    const unsubscribePost = subscribeToPostUpdates((updatedPost) => {
      if (String(updatedPost._id) === String(postId)) mergePost(updatedPost);
    });
    const unsubscribeUser = subscribeToUserUpdates(({ currentUser: updatedUser, targetUser, isFollowing }) => {
      if (updatedUser?._id && String(updatedUser._id) === String(currentUser?._id)) setCurrentUser(updatedUser);
      if (targetUser?._id && String(targetUser._id) === String(post?.user?._id)) {
        setPost((previous) => previous ? { ...previous, user: { ...previous.user, followersCount: targetUser.followers?.length, followingCount: targetUser.following?.length, ...(typeof isFollowing === 'boolean' ? { isFollowing } : {}) } } : previous);
      }
    });
    return () => { unsubscribePost(); unsubscribeUser(); };
  }, [currentUser?._id, post?.user?._id, postId]);

  const handleProfileClick = (userId) => {
    if (!userId || !currentUser) return;
    if (String(userId) === String(currentUser._id)) {
      navigation.navigate('ProfileViewer');
      return;
    }
    navigation.navigate('UserProfile', { userId });
  };

  const mergePost = (updated) => setPost((previous) => ({ ...previous, ...updated, user: { ...previous.user, ...(updated.user || {}), isFollowing: previous.user?.isFollowing } }));
  const handleLike = (targetPostId, nextLiked) => {
    const request = likeQueueRef.current
      .catch(() => null)
      .then(async () => {
        const currentServerState = likeServerStateRef.current ?? Boolean(post?.isLiked);
        if (currentServerState === Boolean(nextLiked)) return { isLiked: currentServerState };
        const updated = await apiRequest(`/posts/${targetPostId}/like`, { method: 'POST', body: JSON.stringify({ userId: currentUser._id }) });
        likeServerStateRef.current = Boolean(updated?.isLiked);
        mergePost(updated);
        publishPostUpdate(updated);
        return updated;
      });
    likeQueueRef.current = request;
    return request;
  };
  const handleFollowToggle = (targetUserId, isFollowing) => {
    const version = followVersionRef.current + 1;
    followVersionRef.current = version;
    setPost((previous) => ({ ...previous, user: { ...previous.user, isFollowing: !isFollowing } }));
    return toggleFollow(currentUser._id, targetUserId, isFollowing).then((response) => {
      if (followVersionRef.current !== version) return response;
      setPost((previous) => ({ ...previous, user: { ...previous.user, isFollowing: Boolean(response?.isFollowing) } }));
      publishUserUpdate(response);
      return response;
    }).catch((error) => {
      if (followVersionRef.current === version) setPost((previous) => ({ ...previous, user: { ...previous.user, isFollowing } }));
      throw error;
    });
  };
  const handleAddComment = async (_postId, text) => {
    const optimisticComment = {
      _id: `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      user: currentUser,
      text: text.trim(),
    };
    setPost((previous) => previous ? {
      ...previous,
      comments: [...(previous.comments || []), optimisticComment],
      commentsCount: Number(previous.commentsCount || previous.comments?.length || 0) + 1,
    } : previous);

    try {
    const updated = await apiRequest(`/posts/${post._id}/comments`, { method: 'POST', body: JSON.stringify({ userId: currentUser._id, text }) });
    mergePost(updated);
    publishPostUpdate(updated);
    return updated;
    } catch (error) {
      setPost((previous) => previous ? {
        ...previous,
        comments: (previous.comments || []).filter((comment) => comment._id !== optimisticComment._id),
        commentsCount: Math.max(0, Number(previous.commentsCount || 0) - 1),
      } : previous);
      throw error;
    }
  };
  const handleSave = async (_postId, nextSaved) => {
    const updated = await apiRequest(`/users/${currentUser._id}/saved-posts/${post._id}`, {
      method: nextSaved ? 'POST' : 'DELETE',
      body: JSON.stringify({ userId: currentUser._id, postId: post._id }),
    });
    mergePost({ ...post, isSaved: Boolean(updated?.isSaved) });
    return updated;
  };
  const handleShare = async (item) => Share.share({ message: item.mediaUrl || item.caption || 'Snaply post' });

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.title}>Post unavailable</Text>
          <Text style={styles.subtitle}>{error || 'This post could not be found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={28} color="#111827" />
        </TouchableOpacity>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PostCard post={post} currentUser={currentUser} onLike={handleLike} onFollowToggle={handleFollowToggle} onAddComment={handleAddComment} onShare={handleShare} onSave={handleSave} onProfileClick={handleProfileClick} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  content: { padding: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, paddingHorizontal: 8 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 40 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  userMeta: { flex: 1 },
  username: { color: '#111827', fontWeight: '700', fontSize: 15 },
  name: { color: '#6b7280', fontSize: 13 },
  media: { width: '100%', height: 320, borderRadius: 18, backgroundColor: '#e5e7eb' },
  caption: { color: '#111827', fontSize: 16, lineHeight: 24, marginTop: 14 },
  metaRow: { flexDirection: 'row', marginTop: 14, gap: 16 },
  meta: { color: '#6b7280', fontSize: 13 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subtitle: { color: '#6b7280', textAlign: 'center' },
});
