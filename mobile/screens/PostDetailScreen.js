import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '../services/api';
import PostCard from '../components/PostCard';
import { publishPostUpdate, publishUserUpdate, subscribeToPostUpdates, subscribeToUserUpdates } from '../services/sync';

export default function PostDetailScreen({ route, navigation }) {
  const postId = route?.params?.postId;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

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
    const unsubscribeUser = subscribeToUserUpdates(({ currentUser: updatedUser, targetUser }) => {
      if (updatedUser?._id && String(updatedUser._id) === String(currentUser?._id)) setCurrentUser(updatedUser);
      if (targetUser?._id && String(targetUser._id) === String(post?.user?._id)) {
        setPost((previous) => previous ? { ...previous, user: { ...previous.user, followersCount: targetUser.followers?.length, followingCount: targetUser.following?.length } } : previous);
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
  const handleLike = async () => {
    const updated = await apiRequest(`/posts/${post._id}/like`, { method: 'POST', body: JSON.stringify({ userId: currentUser._id }) });
    mergePost(updated);
    publishPostUpdate(updated);
  };
  const handleFollowToggle = async (targetUserId, isFollowing) => {
    const response = await apiRequest(`/users/${targetUserId}/follow`, { method: isFollowing ? 'DELETE' : 'POST', body: JSON.stringify({ currentUserId: currentUser._id }) });
    setPost((previous) => ({ ...previous, user: { ...previous.user, isFollowing: !isFollowing } }));
    publishUserUpdate(response);
  };
  const handleAddComment = async (_postId, text) => {
    const updated = await apiRequest(`/posts/${post._id}/comments`, { method: 'POST', body: JSON.stringify({ userId: currentUser._id, text }) });
    mergePost(updated);
    publishPostUpdate(updated);
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Post</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PostCard post={post} currentUser={currentUser} onLike={handleLike} onFollowToggle={handleFollowToggle} onAddComment={handleAddComment} onShare={handleShare} onProfileClick={handleProfileClick} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  content: { padding: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  backText: { color: '#111827', fontSize: 16, fontWeight: '600' },
  spacer: { width: 40 },
  header: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
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
