import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { resolvePostMediaUrl } from '../config';
import ReelGridPreview from './ReelGridPreview';

export default function ProfileGrid({ posts = [], navigation }) {
  if (!posts.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No posts yet.</Text>
      </View>
    );
  }

  const handleTilePress = (item) => {
    if (!navigation) return;
    
    // Determine if this is a reel or post based on the presence of videoUrl
    if (item.videoUrl) {
      // It's a reel
      navigation.navigate('ReelViewer', { reelId: item._id });
    } else {
      // It's a post
      navigation.navigate('PostDetail', { postId: item._id });
    }
  };

  return (
    <FlatList
      data={posts}
      numColumns={3}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.gridContent}
      columnWrapperStyle={styles.columnWrapper}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => handleTilePress(item)} style={styles.tileWrapper}>
          {item.videoUrl ? (
            <ReelGridPreview reel={item} style={styles.postTile} />
          ) : resolvePostMediaUrl(item) ? (
            <Image
              source={{ uri: resolvePostMediaUrl(item) }}
              style={styles.postTile}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.mediaFallback}><Text style={styles.videoIcon}>▶</Text></View>
          )}
          {item.videoUrl && (
            <View style={styles.videoIndicator}>
              <Text style={styles.videoIcon}>▶</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  gridContent: {
    paddingHorizontal: 2,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  tileWrapper: {
    width: '32.5%',
    height: 120,
    marginBottom: 2,
  },
  postTile: {
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
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
    padding: 2,
  },
  videoIcon: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
});
