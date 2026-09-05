import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '../services/api';
import { publishUserUpdate, subscribeToUserUpdates } from '../services/sync';
import { resolveMediaThumbnailUrl, resolveMediaUrl, resolvePostMediaUrl } from '../config';

const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [exploreItems, setExploreItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const debouncedSearchRef = useRef(null);

  const loadExplore = useCallback(async () => {
    try {
      const user = await apiRequest('/users/me');
      setCurrentUser(user);

      const [feed, reelResponse] = await Promise.all([
        apiRequest(`/posts/feed?userId=${user._id}`),
        apiRequest('/reels'),
      ]);

      const combined = [
        ...(Array.isArray(feed) ? feed : []).map((post) => ({
          _id: post._id,
          type: 'post',
          caption: post.caption,
          mediaUrl: post.mediaUrl,
          user: post.user,
        })),
        ...(Array.isArray(reelResponse) ? reelResponse : []).map((reel) => ({
          _id: reel._id,
          type: 'reel',
          caption: reel.caption,
          mediaUrl: reel.mediaUrl,
          thumbnailUrl: reel.thumbnailUrl || reel.posterUrl || reel.thumbnail || reel.poster,
          videoUrl: reel.videoUrl,
          user: reel.user,
        })),
      ];

      setExploreItems(combined.slice(0, 18));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load explore content.');
      setExploreItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExplore();
  }, [loadExplore]);

  useEffect(() => subscribeToUserUpdates(({ targetUser, currentUser: updatedCurrentUser }) => {
    if (targetUser?._id) {
      setUsers((prev) => prev.map((item) => String(item._id) === String(targetUser._id) ? { ...item, ...targetUser, isFollowing: Boolean(updatedCurrentUser?.following?.some((id) => String(id) === String(targetUser._id))) } : item));
    }
    if (updatedCurrentUser?._id && String(updatedCurrentUser._id) === String(currentUser?._id)) setCurrentUser(updatedCurrentUser);
  }), [currentUser?._id]);

  const runSearch = useCallback(async (value) => {
    const trimmed = value.trim();

    if (!trimmed) {
      setUsers([]);
      setPosts([]);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [userResults, postResults] = await Promise.all([
        apiRequest(`/search/users?q=${encodeURIComponent(trimmed)}`),
        apiRequest(`/search/posts?q=${encodeURIComponent(trimmed)}`),
      ]);

      setUsers(userResults || []);
      setPosts(postResults || []);
    } catch (searchError) {
      setError(searchError.message || 'Search failed');
      setUsers([]);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!debouncedSearchRef.current) {
      debouncedSearchRef.current = debounce(runSearch, 300);
    }

    if (!query.trim()) {
      setUsers([]);
      setPosts([]);
      setError('');
      setLoading(false);
      return;
    }

    debouncedSearchRef.current(query);
  }, [query, runSearch]);

  const toggleFollow = async (targetUserId, isFollowing) => {
    if (!currentUser || !targetUserId) return;

    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const response = await apiRequest(`/users/${targetUserId}/follow`, {
        method,
        body: JSON.stringify({ currentUserId: currentUser._id }),
      });

      setUsers((prev) => prev.map((item) => (
        String(item._id) === String(targetUserId)
          ? { ...item, isFollowing: !isFollowing }
          : item
      )));
      publishUserUpdate(response);
    } catch (searchError) {
      console.warn('Search follow failed:', searchError.message);
    }
  };

  const handleMessageUser = async (user) => {
    if (!currentUser || !user?._id || String(user._id) === String(currentUser._id)) return;

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
      console.warn('Create conversation failed:', error.message);
    }
  };

  const results = [...users.map((user) => ({ type: 'user', ...user })), ...posts.map((post) => ({ type: 'post', ...post }))];

  const renderSearchResults = () => {
    if (loading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#111827" />
        </View>
      );
    }

    if (error && query.trim()) {
      return (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>Search error</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      );
    }

    if (!results.length) {
      return (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>No results</Text>
          <Text style={styles.emptyText}>Try another keyword.</Text>
        </View>
      );
    }

    return (
      <FlatList
        key="search-results-list"
        data={results}
        keyExtractor={(item) => `${item.type}-${item._id}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          if (item.type === 'user') {
            const isFollowing = Boolean(item.isFollowing || item.following?.includes(currentUser?._id));
            return (
              <View style={styles.userRow}>
                <TouchableOpacity style={styles.userResultHitTarget} onPress={() => String(item._id) === String(currentUser?._id) ? navigation.navigate('ProfileViewer') : navigation.navigate('UserProfile', { userId: item._id })}>
                  <Image source={{ uri: resolveMediaUrl(item.profilePicture) || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80' }} style={styles.avatar} />
                  <View style={styles.userInfo}>
                  <Text style={styles.userName}>@{item.username}</Text>
                  <Text style={styles.userFullName}>{item.name}</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.followButton, isFollowing && styles.followingButton]}
                    onPress={() => toggleFollow(item._id, isFollowing)}
                  >
                    <Text style={[styles.followText, isFollowing && styles.followingText]}>{isFollowing ? 'Following' : 'Follow'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.messageButton}
                    onPress={() => handleMessageUser(item)}
                  >
                    <Text style={styles.messageText}>Message</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }

          return (
            <TouchableOpacity style={styles.postRow} onPress={() => navigation.navigate('PostDetail', { postId: item._id })}>
              <Image source={{ uri: resolvePostMediaUrl(item) }} style={styles.postThumb} resizeMode="cover" />
              <View style={styles.postCopy}>
                <Text style={styles.postUser}>@{item.user?.username || 'user'}</Text>
                <Text style={styles.postCaption} numberOfLines={2}>{item.caption || 'Post'}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    );
  };

  const renderExploreGrid = () => {
    if (loading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#111827" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>Explore unavailable</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      );
    }

    if (!exploreItems.length) {
      return (
        <View style={styles.centerState}>
          <Text style={styles.emptyTitle}>No explore content</Text>
          <Text style={styles.emptyText}>There are no posts or reels to show yet.</Text>
        </View>
      );
    }

    return (
      <FlatList
        key="search-explore-grid"
        data={exploreItems}
        keyExtractor={(item) => `${item.type}-${item._id}`}
        numColumns={3}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => item.type === 'post'
              ? navigation.navigate('PostDetail', { postId: item._id })
              : navigation.navigate('ReelViewer', { reelId: item._id })}
          >
            {resolveMediaThumbnailUrl(item) ? (
              <Image source={{ uri: resolveMediaThumbnailUrl(item) }} style={styles.gridImage} resizeMode="cover" />
            ) : (
              <View style={styles.mediaFallback}><Text style={styles.mediaFallbackIcon}>▶</Text></View>
            )}
          </TouchableOpacity>
        )}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Text style={styles.logo}>Search</Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search users, posts and reels"
          style={styles.input}
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {query.trim() ? renderSearchResults() : renderExploreGrid()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerRow: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  searchBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userResultHitTarget: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  userName: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 15,
  },
  userFullName: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  followButton: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  followingButton: {
    backgroundColor: '#e5e7eb',
  },
  followText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  followingText: {
    color: '#111827',
  },
  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  messageButton: { backgroundColor: '#f3f4f6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  messageText: { color: '#111827', fontSize: 12, fontWeight: '700' },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  postThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  postCopy: {
    flex: 1,
    marginLeft: 12,
  },
  postUser: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  postCaption: {
    color: '#4b5563',
    fontSize: 13,
  },
  gridContent: {
    padding: 2,
  },
  gridItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: 2,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  mediaFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#d1d5db',
  },
  mediaFallbackIcon: {
    color: '#6b7280',
    fontSize: 18,
  },
});
