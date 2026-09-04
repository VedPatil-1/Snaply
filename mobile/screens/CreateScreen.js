import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { apiRequest } from '../services/api';
import { API_BASE_URL } from '../config';
import { colors, radius } from '../theme';

function CreateVideoPreview({ uri }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.muted = true;
    instance.loop = true;
  });

  return (
    <View style={styles.previewWrap}>
      <VideoView
        player={player}
        style={styles.previewVideo}
        contentFit="cover"
        nativeControls
      />
    </View>
  );
}

export default function CreateScreen({ navigation }) {
  const [videoUri, setVideoUri] = useState('');
  const [caption, setCaption] = useState('');
  const [musicName, setMusicName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const pickVideo = async () => {
    console.log('[Snaply] reel picker opened');
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library to choose a video.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 0.8,
    });

    const asset = result.assets?.[0];
    if (!result.canceled && asset?.uri && (asset.mediaType === 'video' || asset.type === 'video' || !asset.mediaType)) {
      setVideoUri(asset.uri);
      setComposerOpen(false);
      console.log('[Snaply] reel selected:', asset.uri);
    }
  };

  const openComposer = () => {
    console.log('[Snaply] reel next pressed');
    if (!videoUri) {
      Alert.alert('No video selected', 'Choose a video before continuing.');
      return;
    }
    setComposerOpen(true);
    console.log('[Snaply] opening reel composer');
  };

  const publishReel = async () => {
    console.log('[Snaply] publish reel started');
    if (!videoUri) {
      Alert.alert('No video selected', 'Choose a short video before publishing.');
      return;
    }

    try {
      setSubmitting(true);
      const devUser = await apiRequest('/users/me');

      const fileName = `snaply-reel-${Date.now()}.mp4`;
      const uploadUrl = `${API_BASE_URL}/uploads/reel-video`;
      console.log('[Snaply] upload URL:', uploadUrl);
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, videoUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: 'video/mp4',
        parameters: {
          fileName,
        },
      });
      console.log('[Snaply] upload response status:', uploadResult.status);
      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Video upload failed (${uploadResult.status}).`);
      }
      let uploadResponse;
      try {
        uploadResponse = JSON.parse(uploadResult.body || '{}');
      } catch (parseError) {
        throw new Error('Video upload returned an invalid server response.');
      }
      const permanentVideoUrl = uploadResponse?.mediaUrl || uploadResponse?.url;
      if (!permanentVideoUrl) throw new Error('Video upload did not return a media URL.');

      console.log('[Snaply] create reel URL:', `${API_BASE_URL}/reels`);
      const createdReel = await apiRequest('/reels', {
        method: 'POST',
        body: JSON.stringify({
          userId: devUser._id,
          videoUrl: permanentVideoUrl,
          caption,
          musicName,
        }),
      });
      console.log('[Snaply] create reel response status:', createdReel?._id ? 201 : 'unexpected');

      console.log('[Snaply] reel publish success:', createdReel?._id);
      console.log('[Snaply] newly published reel url:', createdReel?.videoUrl || permanentVideoUrl);
      Alert.alert(
        'Reel published',
        'Your reel is ready to be viewed in the Reels feed.',
        [{ text: 'OK', onPress: () => navigation?.goBack() }]
      );
      setVideoUri('');
      setCaption('');
      setMusicName('');
      setComposerOpen(false);
    } catch (error) {
      console.warn('[Snaply] publish reel error:', error?.message || error);
      Alert.alert('Publish failed', error.message || 'Unable to create reel.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Create Reel</Text>
        <Text style={styles.subtitle}>Share a short video with your Snaply friends.</Text>

        {videoUri ? (
          <>
            <CreateVideoPreview uri={videoUri} />
            <TouchableOpacity style={styles.secondaryButton} onPress={pickVideo}>
              <Text style={styles.secondaryText}>Choose another video</Text>
            </TouchableOpacity>
            {!composerOpen ? (
              <TouchableOpacity style={styles.publishButton} onPress={openComposer}>
                <Text style={styles.publishText}>Next</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <TouchableOpacity style={styles.selectButton} onPress={pickVideo}>
            <Text style={styles.selectText}>Select video</Text>
          </TouchableOpacity>
        )}

        {composerOpen ? (
          <>
            <TextInput
              style={styles.input}
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption"
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <TextInput
              style={styles.input}
              value={musicName}
              onChangeText={setMusicName}
              placeholder="Music name"
              placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity style={styles.publishButton} onPress={publishReel} disabled={submitting || !videoUri}>
              <Text style={styles.publishText}>{submitting ? 'Publishing...' : 'Publish'}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 22,
  },
  selectButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  selectText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    alignItems: 'center',
    marginBottom: 18,
  },
  secondaryText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  previewWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#e5e7eb',
    height: 360,
  },
  previewVideo: {
    width: '100%',
    height: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 16,
  },
  publishButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  publishText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
