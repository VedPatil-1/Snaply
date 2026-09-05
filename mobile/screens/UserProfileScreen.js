import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProfileHeader from '../components/ProfileHeader';
import { resolvePostMediaUrl } from '../config';
import ReelGridPreview from '../components/ReelGridPreview';
import { apiRequest } from '../services/api';
import { publishUserUpdate, subscribeToPostUpdates, subscribeToUserUpdates } from '../services/sync';
import { useFocusEffect } from '@react-navigation/native';

export default function UserProfileScreen({ route, navigation }) {
  const userId = route.params?.userId;
  const [currentUser, setCurrentUser] = useState(null);
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!userId) return;

    try {
      const [me, profile, userPosts, userReels] = await Promise.all([
        apiRequest('/users/me'),
        apiRequest(`/users/${userId}`),
        apiRequest(`/posts/user/${userId}`),
        apiRequest(`/reels/user/${userId}`),
      ]);

      setCurrentUser(me);
      setUser({
        ...profile,
        postsCount: userPosts.length,
      });
      setPosts(userPosts);
      setReels(userReels);
    } catch (error) {
      console.warn('User profile load failed:', error.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  useEffect(() => {
    const unsubscribePost = subscribeToPostUpdates((updatedPost) => {
      setPosts((prev) => prev.map((post) => String(post._id) === String(updatedPost._id) ? { ...post, ...updatedPost } : post));
    });
    const unsubscribeUser = subscribeToUserUpdates(({ targetUser, currentUser: updatedCurrentUser }) => {
      if (targetUser?._id && String(targetUser._id) === String(userId)) setUser((prev) => ({ ...prev, ...targetUser, postsCount: prev?.postsCount }));
      if (updatedCurrentUser?._id && String(updatedCurrentUser._id) === String(currentUser?._id)) setCurrentUser(updatedCurrentUser);
    });
    return () => { unsubscribePost(); unsubscribeUser(); };
  }, [currentUser?._id, userId]);

  const handleFollowToggle = async () => {
    if (!currentUser || !user?._id) return;

    try {
      const isFollowing = Boolean(user.isFollowing);
      const method = isFollowing ? 'DELETE' : 'POST';
      const response = await apiRequest(`/users/${user._id}/follow`, {
        method,
        body: JSON.stringify({ currentUserId: currentUser._id }),
      });

      if (response?.currentUser) setCurrentUser(response.currentUser);
      if (response?.targetUser) setUser((prev) => ({ ...prev, ...response.targetUser, isFollowing: response.isFollowing, postsCount: prev?.postsCount }));
      publishUserUpdate(response);
    } catch (error) {
      console.warn('User follow toggle failed:', error.message);
    }
  };

  const handleMessage = async () => {
    if (!currentUser || !user?._id) return;

    try {
      const conversations = await apiRequest(`/conversations?userId=${currentUser._id}`);
      const existing = Array.isArray(conversations)
        ? conversations.find((conversation) => conversation?.participants?.some((participant) => String(participant?._id || participant) === String(user._id)))
        : null;

      const conversation = existing || await apiRequest('/conversations', {
        method: 'POST',
        body: JSON.stringify({ userAId: currentUser._id, userBId: user._id }),
      });

      const otherUser = existing?.otherUser
        || conversation?.participants?.find((participant) => String(participant?._id || participant) !== String(currentUser._id))
        || user;

      navigation.navigate('ChatThread', {
          conversationId: conversation?._id,
          otherUser,
          userId: currentUser._id,
      });
    } catch (error) {
      console.warn('Open user message failed:', error.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#111827" />
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
        <View style={styles.spacer} />
      </View>

      <FlatList
        data={activeTab === 'posts' ? posts : reels}
        numColumns={3}
        keyExtractor={(item) => String(item._id)}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <>
            <ProfileHeader
              user={user}
              isCurrentUser={false}
              onEditProfile={() => null}
            onAvatarPress={() => null}
            onFollowToggle={handleFollowToggle}
            onMessage={handleMessage}
            onOpenFollowers={() => navigation.navigate('RelationshipList', { userId: user?._id, relationship: 'followers' })}
            onOpenFollowing={() => navigation.navigate('RelationshipList', { userId: user?._id, relationship: 'following' })}
            />
            <View style={styles.tabBar}>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'posts' && styles.activeTab]} onPress={() => setActiveTab('posts')}><Text style={styles.tabText}>Posts</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'reels' && styles.activeTab]} onPress={() => setActiveTab('reels')}><Text style={styles.tabText}>Reels</Text></TouchableOpacity>
            </View>
          </>
        )}
        ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>{activeTab === 'reels' ? 'No reels yet.' : 'No posts yet.'}</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.postTile} onPress={() => navigation.navigate(activeTab === 'reels' ? 'ReelViewer' : 'PostDetail', activeTab === 'reels' ? { reelId: item._id } : { postId: item._id })}>
            {activeTab === 'reels' ? (
              <ReelGridPreview reel={item} style={styles.postImage} />
            ) : resolvePostMediaUrl(item) ? (
              <Image source={{ uri: resolvePostMediaUrl(item) }} style={styles.postImage} resizeMode="cover" />
            ) : (
              <View style={[styles.postImage, styles.mediaFallback]} />
            )}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  spacer: {
    width: 40,
  },
  postTile: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 1,
    backgroundColor: '#e5e7eb',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  mediaFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1d5db',
  },
  mediaFallbackIcon: {
    color: '#6b7280',
    fontSize: 18,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
  },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#111827' },
  tabText: { color: '#111827', fontWeight: '600' },
});
