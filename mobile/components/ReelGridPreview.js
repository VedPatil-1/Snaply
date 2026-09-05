import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getReelThumbnail, resolveMediaThumbnailUrl, resolveMediaUrl } from '../config';

export default function ReelGridPreview({ reel, style }) {
  const videoUrl = resolveMediaUrl(reel?.videoUrl || reel?.mediaUrl);
  const thumbnailUrl = resolveMediaThumbnailUrl(reel) || getReelThumbnail(videoUrl);
  const player = useVideoPlayer(videoUrl || null, (instance) => {
    if (!instance) return;
    instance.muted = true;
    instance.loop = false;
  });

  useEffect(() => {
    if (!player) return;
    try {
      player.pause();
    } catch (error) {
      // The preview player may be released during list recycling.
    }
  }, [player]);

  if (thumbnailUrl) {
    return <Image source={{ uri: thumbnailUrl }} style={[styles.fill, style]} resizeMode="cover" />;
  }

  if (player && videoUrl) {
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