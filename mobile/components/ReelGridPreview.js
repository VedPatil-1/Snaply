import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Video from 'react-native-video';
import { resolveMediaUrl, resolveReelThumbnailUrl } from '../config';

export default function ReelGridPreview({ reel, style, allowVideoPreview = false }) {
  const videoUrl = resolveMediaUrl(reel?.videoUrl || reel?.mediaUrl || '');
  const thumbnailUrl = resolveReelThumbnailUrl(reel);
  if (thumbnailUrl) {
    return <Image source={{ uri: thumbnailUrl }} style={[styles.fill, style]} resizeMode="cover" />;
  }

  if (allowVideoPreview && videoUrl) {
    return <Video source={{ uri: videoUrl }} style={[styles.fill, style]} resizeMode="cover" muted paused repeat={false} />;
  }

  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.icon}>▶</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1d5db',
  },
  icon: {
    color: '#6b7280',
    fontSize: 18,
  },
});