import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { resolveMediaUrl, resolveReelThumbnailUrl } from '../config';

export default function ReelGridPreview({ reel, style, allowVideoPreview = false }) {
  const videoUrl = resolveMediaUrl(reel?.videoUrl || reel?.mediaUrl || '');
  const thumbnailUrl = resolveReelThumbnailUrl(reel);
  const player = allowVideoPreview && videoUrl ? useVideoPlayer(videoUrl, (instance) => {
    if (!instance) return;
    instance.muted = true;
    instance.loop = false;
  }) : null;

  useEffect(() => {
    if (!player) return;
    try {
      player.pause();
    } catch (error) {
      // Keep the preview paused until the reel is opened.
    }
  }, [player]);

  if (thumbnailUrl) {
    return <Image source={{ uri: thumbnailUrl }} style={[styles.fill, style]} resizeMode="cover" />;
  }

  if (allowVideoPreview && player && videoUrl) {
    return <VideoView player={player} style={[styles.fill, style]} contentFit="cover" nativeControls={false} />;
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