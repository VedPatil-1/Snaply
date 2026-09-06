import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '../services/api';
import { subscribeToPostUpdates, subscribeToUserUpdates } from '../services/sync';
import { resolveMediaThumbnailUrl, resolvePostMediaUrl, resolveReelThumbnailUrl } from '../config';
import { colors, radius, spacing, typography } from '../theme';
import Ionicons from 'react-native-vector-icons/Ionicons';

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

export default function ExploreScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const items = useMemo(() => interleaveExploreItems(posts, reels), [posts, reels]);

  const loadExplore = useCallback(async () => {
    try {
      const user = await apiRequest('/users/me');
      setCurrentUser(user);
      const [feedPosts, feedReels] = await Promise.all([
        apiRequest(`/posts/feed?userId=${user._id}`),
        apiRequest('/reels'),
      ]);
      setPosts(Array.isArray(feedPosts) ? feedPosts : []);
      setReels(Array.isArray(feedReels) ? feedReels : []);
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
    const unsubscribePost = subscribeToPostUpdates((updatedPost) => {
      if (updatedPost?.deleted) {
        setPosts((prev) => prev.filter((item) => String(item._id) !== String(updatedPost._id)));
        return;
      }
      setPosts((prev) => prev.map((item) => (
        String(item._id) === String(updatedPost._id)
          ? { ...item, ...updatedPost }
          : item
      )));
    });
    const unsubscribeUser = subscribeToUserUpdates(({ currentUser: updatedUser }) => {
      if (updatedUser?._id && String(updatedUser._id) === String(currentUser?._id)) setCurrentUser(updatedUser);
    });
    return () => { unsubscribePost(); unsubscribeUser(); };
  }, [currentUser?._id]);

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

  const renderItem = useCallback(({ item, index }) => {
    const isLarge = index % 5 === 0 || index % 5 === 4;
    const media = item.data;
    const thumbnailUrl = item.type === 'reel' ? resolveReelThumbnailUrl(media) : null;
    const likes = Number(item.data?.likesCount ?? item.data?.likes?.length ?? 0);

    return (
      <ExploreTile
        item={item}
        isLarge={isLarge}
        thumbnailUrl={thumbnailUrl}
        likes={likes}
        navigation={navigation}
      />
    );
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <View><Text style={styles.eyebrow}>SNAPLY DISCOVER</Text><Text style={styles.logo}>Explore</Text></View>
        <Ionicons name="search-outline" size={22} color={colors.text} />
      </View>

      <FlatList
        data={items}
        numColumns={3}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

const ExploreTile = React.memo(function ExploreTile({ item, isLarge, thumbnailUrl, likes, navigation }) {
  const scale = useRef(new Animated.Value(1)).current;

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
    <Animated.View style={[styles.tileWrapper, isLarge && styles.largeTile, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={openItem}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.tileButton}
      >
        {imageSource ? (
          <Image source={imageSource} style={styles.tileImage} resizeMode="cover" />
        ) : (
          <View style={styles.mediaFallback}><Text style={styles.reelBadgeText}>▶</Text></View>
        )}

        <View style={styles.likeBadge}>
          <Text style={styles.likeBadgeText}>♥ {likes}</Text>
        </View>

        {item.type === 'reel' ? (
          <View style={styles.reelBadge}><Text style={styles.reelBadgeText}>▶</Text></View>
        ) : null}

        {item.type === 'reel' ? <View style={styles.reelLabel}><Text style={styles.reelLabelText}>Reel</Text></View> : null}
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerRow: {
    paddingHorizontal: spacing.lg,
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
  tileWrapper: {
    flex: 1 / 3,
    height: 126,
    margin: 2,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  largeTile: {
    flex: 1 / 2.05,
    height: 180,
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
  likeBadge: {
    position: 'absolute',
    left: 7,
    bottom: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(17,24,39,0.72)',
  },
  likeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
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
