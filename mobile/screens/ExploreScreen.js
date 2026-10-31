import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest, toggleFollow } from '../services/api';
import { subscribeToPostUpdates, subscribeToUserUpdates } from '../services/sync';
import { resolveMediaThumbnailUrl, resolvePostMediaUrl, resolveReelThumbnailUrl } from '../config';
import { colors, radius, spacing, typography } from '../theme';
import Ionicons from 'react-native-vector-icons/Ionicons';
import PostCard from '../components/PostCard';

function interleaveExploreItems(posts, reels) {
  const normalizedPosts = (Array.isArray(posts) ? posts : []).filter((post) => post?._id && resolvePostMediaUrl(post)).map((post) => ({
    type: 'post',
    id: String(post._id),
    data: post,
  }));

  const normalizedReels = (Array.isArray(reels) ? reels : []).filter((reel) => reel?._id && resolveMediaThumbnailUrl(reel)).map((reel) => ({
    type: 'reel',
    id: String(reel._id),
    data: reel,
  }));

  if (!normalizedPosts.length) return normalizedReels;
  if (!normalizedReels.length) return normalizedPosts;

  const list = [];
  let postIndex = 0;
  let reelIndex = 0;
  let patternIndex = 0;

  while (postIndex < normalizedPosts.length || reelIndex < normalizedReels.length) {
    const remainingPosts = normalizedPosts.length - postIndex;
    const remainingReels = normalizedReels.length - reelIndex;

    if (!remainingPosts) {
      list.push(normalizedReels[reelIndex++]);
      continue;
    }

    const burstSize = Math.min(2 + (patternIndex % 3), remainingPosts);
    for (let i = 0; i < burstSize; i += 1) {
      if (postIndex < normalizedPosts.length) {
        list.push(normalizedPosts[postIndex++]);
      }
    }

    patternIndex += 1;

    if (reelIndex < normalizedReels.length && (remainingPosts > 0 || remainingReels > 0)) {
      list.push(normalizedReels[reelIndex++]);
    }
  }

  return list.slice(0, 24);
}

function shuffleItems(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function formatLikeCount(value) {
  const count = Math.max(0, Number(value) || 0);
  if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(count);
}

export default function ExploreScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const saveVersionsRef = useRef(new Map());
  const saveQueuesRef = useRef(new Map());
  const likeVersionsRef = useRef(new Map());
  const likeQueuesRef = useRef(new Map());
  const followVersionsRef = useRef(new Map());
  const masonryColumns = useMemo(() => {
    const left = [];
    const right = [];
    items.forEach((item, index) => {
      const height = [188, 248, 216, 278, 196][index % 5];
      (index % 2 === 0 ? left : right).push({ item, height });
    });
    return [left, right];
  }, [items]);

  const loadExplore = useCallback(async () => {
    try {
      const user = await apiRequest('/users/me');
      setCurrentUser(user);
      const [feedPosts, feedReels] = await Promise.all([
        apiRequest(`/posts/feed?userId=${user._id}`),
        apiRequest('/reels'),
      ]);
      const nextPosts = Array.isArray(feedPosts) ? feedPosts : [];
      const nextReels = Array.isArray(feedReels) ? feedReels : [];
      setItems(shuffleItems(interleaveExploreItems(nextPosts, nextReels)));
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to load explore content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExplore();
  }, [loadExplore]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError('');
      setSearchLoading(false);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError('');
      try {
        const [users, posts, reels] = await Promise.all([
          apiRequest(`/search/users?q=${encodeURIComponent(trimmed)}`),
          apiRequest(`/search/posts?q=${encodeURIComponent(trimmed)}&userId=${currentUser?._id || ''}`),
          apiRequest('/reels'),
        ]);
        if (!active) return;
        const reelResults = (Array.isArray(reels) ? reels : []).filter((reel) => {
          const haystack = `${reel?.caption || ''} ${reel?.user?.username || ''} ${reel?.user?.name || ''}`.toLowerCase();
          return haystack.includes(trimmed.toLowerCase());
        }).map((reel) => ({ type: 'reel', ...reel }));
        setSearchResults([
          ...(Array.isArray(users) ? users : []).map((user) => ({ type: 'user', ...user })),
          ...(Array.isArray(posts) ? posts : []).map((post) => ({ type: 'post', ...post })),
          ...reelResults,
        ]);
      } catch (requestError) {
        if (active) {
          setSearchResults([]);
          setSearchError(requestError.message || 'Search failed');
        }
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentUser?._id, query]);

  useEffect(() => {
    const unsubscribePost = subscribeToPostUpdates((updatedPost) => {
      if (updatedPost?.deleted) {
        setItems((prev) => prev.filter((item) => !(item.type === 'post' && String(item.id) === String(updatedPost._id))));
        return;
      }
      setItems((prev) => prev.map((item) => (
        item.type === 'post' && String(item.id) === String(updatedPost._id)
          ? { ...item, data: { ...item.data, ...updatedPost } }
          : item
      )));
    });
    const unsubscribeUser = subscribeToUserUpdates(({ currentUser: updatedUser }) => {
      if (updatedUser?._id && String(updatedUser._id) === String(currentUser?._id)) setCurrentUser(updatedUser);
    });
    return () => { unsubscribePost(); unsubscribeUser(); };
  }, [currentUser?._id]);

  const handleSave = useCallback((postId, nextSaved) => {
    if (!currentUser?._id) return Promise.reject(new Error('Current user is unavailable.'));

    const id = String(postId);
    const previousItem = items.find((item) => item.type === 'post' && String(item.id) === id);
    const previousSaved = Boolean(previousItem?.data?.isSaved);
    const version = (saveVersionsRef.current.get(id) || 0) + 1;
    saveVersionsRef.current.set(id, version);

    setItems((previous) => previous.map((item) => (
      item.type === 'post' && String(item.id) === id
        ? { ...item, data: { ...item.data, isSaved: nextSaved } }
        : item
    )));

    const request = (saveQueuesRef.current.get(id) || Promise.resolve())
      .catch(() => null)
      .then(async () => {
        const response = await apiRequest(`/users/${currentUser._id}/saved-posts/${postId}`, {
          method: nextSaved ? 'POST' : 'DELETE',
          body: JSON.stringify({ userId: currentUser._id, postId }),
        });

        if (saveVersionsRef.current.get(id) === version) {
          setItems((previous) => previous.map((item) => (
            item.type === 'post' && String(item.id) === id
              ? { ...item, data: { ...item.data, isSaved: Boolean(response?.isSaved) } }
              : item
          )));
        }

        return response;
      })
      .catch((error) => {
        if (saveVersionsRef.current.get(id) === version) {
          setItems((previous) => previous.map((item) => (
            item.type === 'post' && String(item.id) === id
              ? { ...item, data: { ...item.data, isSaved: previousSaved } }
              : item
          )));
        }
        throw error;
      });

    saveQueuesRef.current.set(id, request);
    return request;
  }, [currentUser, items]);

  const handleLike = useCallback((postId, nextLiked) => {
    if (!currentUser?._id) return Promise.reject(new Error('Current user is unavailable.'));
    const id = String(postId);
    const version = (likeVersionsRef.current.get(id) || 0) + 1;
    likeVersionsRef.current.set(id, version);
    setItems((previous) => previous.map((item) => item.type === 'post' && String(item.id) === id
      ? { ...item, data: { ...item.data, isLiked: nextLiked, likesCount: Math.max(0, Number(item.data.likesCount || item.data.likes?.length || 0) + (nextLiked ? 1 : -1)) } }
      : item));

    const request = (likeQueuesRef.current.get(id) || Promise.resolve())
      .catch(() => null)
      .then(async () => {
        const response = await apiRequest(`/posts/${postId}/like`, {
          method: 'POST',
          body: JSON.stringify({ userId: currentUser._id }),
        });
        if (likeVersionsRef.current.get(id) === version) {
          setItems((previous) => previous.map((item) => item.type === 'post' && String(item.id) === id
            ? { ...item, data: { ...item.data, ...response } }
            : item));
        }
        return response;
      })
      .catch((error) => {
        if (likeVersionsRef.current.get(id) === version) {
          setItems((previous) => previous.map((item) => item.type === 'post' && String(item.id) === id
            ? { ...item, data: { ...item.data, isLiked: !nextLiked, likesCount: Math.max(0, Number(item.data.likesCount || 0) + (nextLiked ? -1 : 1)) } }
            : item));
        }
        throw error;
      });
    likeQueuesRef.current.set(id, request);
    return request;
  }, [currentUser]);

  const handleSearchSave = useCallback((postId, nextSaved) => {
    setSearchResults((previous) => previous.map((item) => item.type === 'post' && String(item._id) === String(postId)
      ? { ...item, isSaved: nextSaved }
      : item));
    return handleSave(postId, nextSaved);
  }, [handleSave]);

  const handleSearchFollow = useCallback((targetUserId, isFollowing) => {
    if (!currentUser?._id) return Promise.reject(new Error('Current user is unavailable.'));
    const id = String(targetUserId);
    const version = (followVersionsRef.current.get(id) || 0) + 1;
    followVersionsRef.current.set(id, version);
    setSearchResults((previous) => previous.map((item) => item.type === 'user'
      ? (String(item._id) === id ? { ...item, isFollowing: !isFollowing } : item)
      : String(item.user?._id) === id ? { ...item, user: { ...item.user, isFollowing: !isFollowing } } : item));
    return toggleFollow(currentUser._id, targetUserId, isFollowing).then((response) => {
      if (followVersionsRef.current.get(id) !== version) return response;
      setSearchResults((previous) => previous.map((item) => item.type === 'user'
        ? (String(item._id) === id ? { ...item, isFollowing: Boolean(response?.isFollowing) } : item)
        : String(item.user?._id) === id ? { ...item, user: { ...item.user, isFollowing: Boolean(response?.isFollowing) } } : item));
      return response;
    }).catch((error) => {
      if (followVersionsRef.current.get(id) === version) setSearchResults((previous) => previous.map((item) => item.type === 'user'
        ? (String(item._id) === id ? { ...item, isFollowing } : item)
        : String(item.user?._id) === id ? { ...item, user: { ...item.user, isFollowing } } : item));
      throw error;
    });
  }, [currentUser]);

  const renderSearchResult = useCallback(({ item }) => {
    if (item.type === 'user') {
      return <TouchableOpacity style={styles.searchUserRow} onPress={() => navigation.navigate('UserProfile', { userId: item._id })}>
        <Image source={{ uri: item.profilePicture }} style={styles.searchAvatar} />
        <View style={styles.searchCopy}><Text style={styles.searchUserName}>@{item.username}</Text><Text style={styles.searchUserFullName}>{item.name}</Text></View>
        {String(item._id) !== String(currentUser?._id) ? <TouchableOpacity style={[styles.searchFollowButton, item.isFollowing && styles.searchFollowingButton]} onPress={(event) => { event.stopPropagation(); handleSearchFollow(item._id, Boolean(item.isFollowing)); }}><Text style={[styles.searchFollowText, item.isFollowing && styles.searchFollowingText]}>{item.isFollowing ? 'Following' : 'Follow'}</Text></TouchableOpacity> : null}
      </TouchableOpacity>;
    }
    if (item.type === 'post') {
      return <PostCard post={item} currentUser={currentUser} onLike={handleLike} onSave={handleSearchSave} onFollowToggle={handleSearchFollow} onAddComment={() => Promise.resolve()} onShare={(post) => Share.share({ message: post.mediaUrl || post.caption || 'Snaply post' })} onProfileClick={(userId) => navigation.navigate('UserProfile', { userId })} />;
    }
    return <TouchableOpacity style={styles.searchUserRow} onPress={() => navigation.navigate('ReelViewer', { reelId: item._id })}>
      <Image source={{ uri: resolveReelThumbnailUrl(item) }} style={styles.searchAvatar} /><View style={styles.searchCopy}><Text style={styles.searchUserName}>@{item.user?.username || 'user'}</Text><Text style={styles.searchUserFullName}>{item.caption || 'Reel'}</Text></View>
    </TouchableOpacity>;
  }, [currentUser, handleLike, handleSearchFollow, handleSearchSave, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Explore unavailable</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <View><Text style={styles.eyebrow}>SNAPLY DISCOVER</Text><Text style={styles.logo}>Explore</Text></View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color={colors.textMuted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search users, posts and reels" placeholderTextColor={colors.textMuted} style={styles.searchInput} autoCapitalize="none" autoCorrect={false} />
      </View>

      {query.trim() ? (searchLoading ? <View style={styles.loadingWrap}><ActivityIndicator size="small" color={colors.accent} /></View> : searchError ? <View style={styles.emptyState}><Text style={styles.emptyText}>{searchError}</Text></View> : <FlatList key="explore-list-1" data={searchResults} keyExtractor={(item) => `${item.type}-${item._id}`} contentContainerStyle={styles.searchResults} renderItem={renderSearchResult} />) : (
        <ScrollView
          key="explore-masonry"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.masonryContent}
          removeClippedSubviews
        >
          <View style={styles.masonryRow}>
            {masonryColumns.map((column, columnIndex) => (
              <View key={`column-${columnIndex}`} style={styles.masonryColumn}>
                {column.map(({ item, height }) => (
                  <ExploreTile
                    key={`${item.type}-${item.id}`}
                    item={item}
                    mediaHeight={height}
                    thumbnailUrl={item.type === 'reel' ? resolveReelThumbnailUrl(item.data) : resolvePostMediaUrl(item.data)}
                    likes={item.data?.likesCount ?? item.data?.likes?.length ?? 0}
                    navigation={navigation}
                    onSave={handleSave}
                    onLike={handleLike}
                  />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const ExploreTile = React.memo(function ExploreTile({ item, isLarge, mediaHeight, thumbnailUrl, likes, navigation, onSave, onLike }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [liked, setLiked] = React.useState(Boolean(item.data?.isLiked));
  const [likeCount, setLikeCount] = React.useState(Number(likes || 0));

  useEffect(() => {
    setLiked(Boolean(item.data?.isLiked));
    setLikeCount(Number(item.data?.likesCount ?? item.data?.likes?.length ?? 0));
  }, [item.data?.isLiked, item.data?.likesCount, item.data?.likes?.length]);

  const handleLikePress = async () => {
    const previousLiked = liked;
    const previousCount = likeCount;
    const nextLiked = !previousLiked;
    setLiked(nextLiked);
    setLikeCount(Math.max(0, previousCount + (nextLiked ? 1 : -1)));
    try {
      const response = await onLike?.(item.id, nextLiked);
      if (response?.isLiked !== undefined) setLiked(Boolean(response.isLiked));
      if (response?.likesCount !== undefined) setLikeCount(Number(response.likesCount));
    } catch (error) {
      setLiked(previousLiked);
      setLikeCount(previousCount);
    }
  };

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const openItem = () => {
    if (item.type === 'post') {
      navigation.navigate('PostDetail', { postId: item.id });
      return;
    }
    navigation.navigate('ReelViewer', { reelId: item.id });
  };

  const imageSource = thumbnailUrl ? { uri: thumbnailUrl } : null;

  return (
    <Animated.View style={[styles.tileWrapper, mediaHeight ? { height: mediaHeight } : null, isLarge && styles.largeTile, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={openItem}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.tileButton}
      >
        <View style={styles.mediaFrame}>
          {imageSource ? (
            <Image source={imageSource} style={styles.tileImage} resizeMode="cover" />
          ) : (
            <View style={styles.mediaFallback}><Ionicons name="play" size={20} color="#fff" /></View>
          )}

          {item.type === 'reel' ? (
            <View style={styles.reelBadge}><Ionicons name="play" size={12} color="#fff" /></View>
          ) : null}

          {item.type === 'reel' ? <View style={styles.reelLabel}><Text style={styles.reelLabelText}>Reel</Text></View> : null}
        </View>
      </TouchableOpacity>
      <View style={styles.likeRow}>
        {item.type === 'post' ? <TouchableOpacity style={styles.tileActionButton} onPress={handleLikePress}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? colors.like : colors.text} /></TouchableOpacity> : <Ionicons name="heart" size={14} color={colors.like} />}
        <Text style={styles.likeCount}>{formatLikeCount(item.type === 'post' ? likeCount : likes)}</Text>
        <Text style={styles.likeLabel}>likes</Text>
        {item.type === 'post' ? (
          <TouchableOpacity style={styles.saveButton} onPress={() => onSave?.(item.id, !item.data?.isSaved)}>
            <Ionicons name={item.data?.isSaved ? 'bookmark' : 'bookmark-outline'} size={17} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    ...typography.title,
    color: colors.text,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '800',
    color: colors.accent,
    marginBottom: 4,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  masonryContent: {
    paddingHorizontal: 4,
    paddingBottom: 24,
  },
  masonryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  masonryColumn: {
    flex: 1,
    paddingHorizontal: 2,
  },
  searchBox: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.xs },
  searchResults: { paddingBottom: spacing.lg },
  searchUserRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border, marginRight: spacing.md },
  searchCopy: { flex: 1 },
  searchUserName: { ...typography.body, color: colors.text, fontWeight: '800' },
  searchUserFullName: { ...typography.caption, color: colors.textSecondary },
  searchFollowButton: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  searchFollowingButton: { backgroundColor: colors.accentSoft },
  searchFollowText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  searchFollowingText: { color: colors.accentDeep },
  tileWrapper: {
    width: '100%',
    height: 220,
    margin: 2,
    marginBottom: 4,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  largeTile: {
    flex: 1 / 2.05,
    height: 208,
  },
  mediaFrame: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  mediaFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1d5db',
  },
  likeRow: {
    height: 28,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  likeCount: {
    marginLeft: 5,
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  likeLabel: {
    marginLeft: 3,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  saveButton: {
    marginLeft: 'auto',
    padding: 4,
  },
  tileActionButton: { padding: 2 },
  tileButton: {
    flex: 1,
  },
  reelBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(17,24,39,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  reelLabel: {
    position: 'absolute',
    left: 8,
    top: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,39,0.7)',
  },
  reelLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  emptyState: {
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
});
