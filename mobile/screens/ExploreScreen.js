import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { apiRequest } from '../services/api';
import { subscribeToPostUpdates, subscribeToUserUpdates } from '../services/sync';

export default function ExploreScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const loadExplore = useCallback(async () => {
    try {
      const user = await apiRequest('/users/me');
      setCurrentUser(user);
      const [posts, reels] = await Promise.all([apiRequest(`/posts/feed?userId=${user._id}`), apiRequest('/reels')]);
      const mappedPosts = (Array.isArray(posts) ? posts : []).map((item) => ({
        ...item,
        kind: 'post',
        _id: item._id,
      }));
      const mappedReels = (Array.isArray(reels) ? reels : []).map((item) => ({
        ...item,
        kind: 'reel',
        _id: item._id,
      }));
      setItems([...mappedPosts, ...mappedReels].slice(0, 24));
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
      setItems((prev) => prev.map((item) => (
        item.kind === 'post' && String(item._id) === String(updatedPost._id)
          ? { ...item, ...updatedPost }
          : item
      )));
    });
    const unsubscribeUser = subscribeToUserUpdates(({ currentUser: updatedUser }) => {
      if (updatedUser?._id && String(updatedUser._id) === String(currentUser?._id)) setCurrentUser(updatedUser);
    });
    return () => { unsubscribePost(); unsubscribeUser(); };
  }, [currentUser?._id]);

  const data = useMemo(() => items, [items]);

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
        <Text style={styles.logo}>Explore</Text>
      </View>

      <FlatList
        data={data}
        numColumns={3}
        keyExtractor={(item) => `${item.kind}-${item._id}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const isLarge = index % 5 === 0 || index % 5 === 4;
          const mediaUrl = item.kind === 'reel' ? (item.videoUrl || item.mediaUrl) : item.mediaUrl;

          return (
            <TouchableOpacity
              onPress={() => {
                if (item.kind === 'post') navigation.navigate('PostDetail', { postId: item._id });
                else navigation.navigate('ReelViewer', { reelId: item._id });
              }}
              style={[styles.tileWrapper, isLarge && styles.largeTile]}
            >
              <Image source={{ uri: mediaUrl }} style={styles.tileImage} resizeMode="cover" />
              {item.kind === 'post' ? (
                <View style={styles.likeBadge}>
                  <Text style={styles.likeBadgeText}>♥ {Number(item.likesCount ?? item.likes?.length ?? 0)}</Text>
                </View>
              ) : null}
              {item.kind === 'reel' ? <View style={styles.reelBadge}><Text style={styles.reelBadgeText}>▶</Text></View> : null}
            </TouchableOpacity>
          );
        }}
      />
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
    margin: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  largeTile: {
    flex: 1 / 2.05,
    height: 180,
  },
  tileImage: {
    width: '100%',
    height: '100%',
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
