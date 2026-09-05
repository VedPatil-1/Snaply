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
import { DEV_USERNAME, resolvePostMediaUrl } from '../config';
import ReelGridPreview from '../components/ReelGridPreview';
import { apiRequest } from '../services/api';
import { publishUserUpdate, subscribeToPostUpdates, subscribeToUserUpdates } from '../services/sync';
import { useFocusEffect } from '@react-navigation/native';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');

  const loadProfile = useCallback(async () => {
    try {
      const currentUser = await apiRequest('/users/me');
      const [userPosts, userReels] = await Promise.all([
        apiRequest(`/posts/user/${currentUser._id}`),
        apiRequest(`/reels/user/${currentUser._id}`),
      ]);

      setUser({
        ...currentUser,
        postsCount: userPosts.length,
        isFollowing: false,
      });
      setPosts(userPosts);
      setReels(userReels);
    } catch (error) {
      console.warn('Profile load failed:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  useEffect(() => {
    const unsubscribePost = subscribeToPostUpdates((updatedPost) => {
      setPosts((prev) => prev.map((post) => String(post._id) === String(updatedPost._id) ? { ...post, ...updatedPost } : post));
    });
    const unsubscribeUser = subscribeToUserUpdates(({ currentUser: updatedUser }) => {
      if (updatedUser?._id && String(updatedUser._id) === String(user?._id)) setUser((prev) => ({ ...prev, ...updatedUser, postsCount: prev?.postsCount }));
    });
    return () => { unsubscribePost(); unsubscribeUser(); };
  }, [user?._id]);

  const handleFollowToggle = async () => {
    if (!user || !user._id) return;

    try {
      const isFollowing = Boolean(user.isFollowing);
      const method = isFollowing ? 'DELETE' : 'POST';
      const result = await apiRequest(`/users/${user._id}/follow`, {
        method,
        body: JSON.stringify({ currentUserId: user._id }),
      });

      if (result?.currentUser) {
        setUser((prev) => ({ ...prev, ...result.currentUser, postsCount: prev?.postsCount }));
      }
      publishUserUpdate(result);

      if (result?.message) {
        console.log(result.message);
      }
    } catch (error) {
      console.warn('Profile follow failed:', error.message);
    }
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
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
      <View style={styles.topBar}>
        {navigation.canGoBack() ? <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backText}>Back</Text></TouchableOpacity> : null}
        <Text style={styles.usernameText}>@{user?.username || DEV_USERNAME}</Text>
        <View style={styles.iconRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Create')}>
            <Text style={styles.iconText}>＋</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Activity')}>
            <Text style={styles.iconText}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={activeTab === 'posts' ? posts : reels}
        keyExtractor={(item) => String(item._id)}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <>
            <ProfileHeader
              user={user}
              isCurrentUser
              onEditProfile={handleEditProfile}
              onFollowToggle={handleFollowToggle}
              onMessage={() => navigation.navigate('Inbox')}
              onOpenFollowers={() => navigation.navigate('RelationshipList', { userId: user?._id, relationship: 'followers' })}
              onOpenFollowing={() => navigation.navigate('RelationshipList', { userId: user?._id, relationship: 'following' })}
            />
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'posts' && styles.activeTab]}
                onPress={() => setActiveTab('posts')}
              >
                <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>Posts</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'reels' && styles.activeTab]}
                onPress={() => setActiveTab('reels')}
              >
                <Text style={[styles.tabText, activeTab === 'reels' && styles.activeTabText]}>Reels</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        ListEmptyComponent={<View style={styles.placeholderBox}><Text style={styles.placeholderText}>{activeTab === 'reels' ? 'No reels yet' : 'No posts yet'}</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.profileTile} onPress={() => navigation.navigate(activeTab === 'reels' ? 'ReelViewer' : 'PostDetail', activeTab === 'reels' ? { reelId: item._id } : { postId: item._id })}>
            {activeTab === 'reels' ? (
              <ReelGridPreview reel={item} style={styles.profileTileImage} />
            ) : resolvePostMediaUrl(item) ? (
              <Image source={{ uri: resolvePostMediaUrl(item) }} style={styles.profileTileImage} resizeMode="cover" />
            ) : (
              <View style={[styles.profileTileImage, styles.mediaFallback]} />
            )}
            {activeTab === 'reels' ? <View style={styles.videoIndicator}><Text style={styles.profileTileText}>▶</Text></View> : null}
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: { marginRight: 10 },
  backText: { color: '#111827', fontWeight: '700' },
  usernameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconText: {
    fontSize: 20,
    color: '#111827',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#111827',
  },
  tabText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#111827',
  },
  placeholderBox: {
    flex: 1,
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#6b7280',
    fontSize: 16,
  },
  profileTile: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 1,
    backgroundColor: '#e5e7eb',
  },
  profileTileImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
  mediaFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1d5db',
  },
  videoIndicator: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(17,24,39,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTileText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
