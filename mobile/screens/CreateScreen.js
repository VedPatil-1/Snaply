import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import { launchImageLibrary } from 'react-native-image-picker';
import { apiRequest, uploadImageAsset, uploadVideoAsset } from '../services/api';
import { API_BASE_URL } from '../config';
import { colors, radius } from '../theme';

function CreateVideoPreview({ uri }) {
  return (
    <View style={styles.previewWrap}>
      <Video
        source={{ uri }}
        style={styles.previewVideo}
        resizeMode="cover"
        muted
        repeat
        nativeControls
      />
    </View>
  );
}

export default function CreateScreen({ navigation, route }) {
  const [videoUri, setVideoUri] = useState('');
  const [storyVideoDuration, setStoryVideoDuration] = useState(0);
  const [photoAsset, setPhotoAsset] = useState(null);
  const [creationMode, setCreationMode] = useState(route.params?.mode === 'story' ? 'story' : 'reel');
  const [caption, setCaption] = useState('');
  const [musicName, setMusicName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const pickPhoto = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });

    const asset = result.assets?.[0];
    if (!result.didCancel && asset?.uri) {
      setPhotoAsset(asset);
    }
  };

  const switchToMode = (mode) => {
    setCreationMode(mode);
    setVideoUri('');
    setStoryVideoDuration(0);
    setPhotoAsset(null);
    setCaption('');
    setMusicName('');
    setComposerOpen(false);
  };

  const pickStoryMedia = async () => {
    const result = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1 });
    const asset = result.assets?.[0];
    if (result.didCancel || !asset?.uri) return;
    if (asset.type === 'video') {
      if (Number(asset.duration || 0) > 30000) {
        Alert.alert('Video too long', 'Stories can be up to 30 seconds long. Choose a shorter video.');
        return;
      }
      setVideoUri(asset.uri);
      setStoryVideoDuration(Number(asset.duration || 0));
      setPhotoAsset(null);
    } else {
      setPhotoAsset(asset);
      setVideoUri('');
      setStoryVideoDuration(0);
    }
  };

  const pickVideo = async () => {
    console.log('[Snaply] reel picker opened');
    const result = await launchImageLibrary({ mediaType: 'video', selectionLimit: 1 });

    const asset = result.assets?.[0];
    if (!result.didCancel && asset?.uri) {
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
      const uploadResponse = await uploadVideoAsset(videoUri, uploadUrl, fileName);
      const permanentVideoUrl = uploadResponse?.mediaUrl || uploadResponse?.url;
      const thumbnailUrl = uploadResponse?.thumbnailUrl || uploadResponse?.posterUrl;
      if (!permanentVideoUrl) throw new Error('Video upload did not return a media URL.');
      if (!thumbnailUrl) throw new Error('Video upload did not return a thumbnail URL.');

      console.log('[Snaply] create reel URL:', `${API_BASE_URL}/reels`);
      const createdReel = await apiRequest('/reels', {
        method: 'POST',
        body: JSON.stringify({
          userId: devUser._id,
          videoUrl: permanentVideoUrl,
          thumbnailUrl,
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

  const publishPost = async () => {
    if (!photoAsset?.uri) {
      Alert.alert('No photo selected', 'Choose an image before posting.');
      return;
    }

    try {
      setSubmitting(true);
      const devUser = await apiRequest('/users/me');
      const upload = await uploadImageAsset(photoAsset);
      const mediaUrl = upload.mediaUrl;

      if (!mediaUrl || /\.(mp4|mov|m4v|webm)(?:[?#]|$)/i.test(mediaUrl)) {
        throw new Error('The image upload did not return an image URL.');
      }

      await apiRequest('/posts', {
        method: 'POST',
        body: JSON.stringify({
          userId: devUser._id,
          mediaUrl,
          mediaType: 'image',
          caption,
        }),
      });

      Alert.alert(
        'Post published',
        'Your photo is ready to be viewed in the feed.',
        [{ text: 'OK', onPress: () => navigation?.goBack() }]
      );
      setPhotoAsset(null);
      setCaption('');
    } catch (error) {
      console.warn('[Snaply] publish post error:', error?.message || error);
      Alert.alert('Post failed', error.message || 'Unable to create post.');
    } finally {
      setSubmitting(false);
    }
  };

  const publishStory = async () => {
    if (!photoAsset?.uri && !videoUri) {
      Alert.alert('No media selected', 'Choose a photo or video before publishing.');
      return;
    }

    try {
      setSubmitting(true);
      const devUser = await apiRequest('/users/me');
      let upload;
      let mediaType;
      if (photoAsset?.uri) {
        upload = await uploadImageAsset(photoAsset);
        mediaType = 'image';
      } else {
        upload = await uploadVideoAsset(videoUri, `${API_BASE_URL}/uploads/file`, `snaply-story-${Date.now()}.mp4`);
        mediaType = 'video';
      }

      if (!upload?.mediaUrl) throw new Error('Story upload did not return a media URL.');
      await apiRequest('/stories', {
        method: 'POST',
        body: JSON.stringify({ userId: devUser._id, mediaUrl: upload.mediaUrl, mediaType, caption, durationMs: mediaType === 'video' ? storyVideoDuration : 0 }),
      });
      Alert.alert('Story published', 'Your story is now available.', [{ text: 'OK', onPress: () => navigation?.goBack() }]);
      setPhotoAsset(null);
      setVideoUri('');
      setStoryVideoDuration(0);
      setCaption('');
    } catch (error) {
      Alert.alert('Story failed', error.message || 'Unable to create story.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, creationMode === 'reel' && styles.activeModeButton]}
            onPress={() => switchToMode('reel')}
          >
            <Text style={[styles.modeText, creationMode === 'reel' && styles.activeModeText]}>Reel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, creationMode === 'post' && styles.activeModeButton]}
            onPress={() => switchToMode('post')}
          >
            <Text style={[styles.modeText, creationMode === 'post' && styles.activeModeText]}>Photo post</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, creationMode === 'story' && styles.activeModeButton]}
            onPress={() => switchToMode('story')}
          >
            <Text style={[styles.modeText, creationMode === 'story' && styles.activeModeText]}>Story</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{creationMode === 'post' ? 'Create Photo Post' : creationMode === 'story' ? 'Create Story' : 'Create Reel'}</Text>
        <Text style={styles.subtitle}>{creationMode === 'post' ? 'Share a photo with your Snaply friends.' : creationMode === 'story' ? 'Share a photo or video for 24 hours.' : 'Share a short video with your Snaply friends.'}</Text>

        {creationMode === 'post' ? (
          photoAsset ? (
            <>
              <Image source={{ uri: photoAsset.uri }} style={styles.photoPreview} resizeMode="contain" />
              <TouchableOpacity style={styles.secondaryButton} onPress={pickPhoto}>
                <Text style={styles.secondaryText}>Choose another photo</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.selectButton} onPress={pickPhoto}>
              <Text style={styles.selectText}>Select photo</Text>
            </TouchableOpacity>
          )
        ) : creationMode === 'story' ? (
          photoAsset ? (
            <>
              <Image source={{ uri: photoAsset.uri }} style={styles.photoPreview} resizeMode="contain" />
              <TouchableOpacity style={styles.secondaryButton} onPress={pickStoryMedia}><Text style={styles.secondaryText}>Choose different media</Text></TouchableOpacity>
            </>
          ) : videoUri ? (
            <>
              <CreateVideoPreview uri={videoUri} />
              <TouchableOpacity style={styles.secondaryButton} onPress={pickStoryMedia}><Text style={styles.secondaryText}>Choose different media</Text></TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.selectButton} onPress={pickStoryMedia}><Text style={styles.selectText}>Select photo or video</Text></TouchableOpacity>
          )
        ) : videoUri ? (
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

        {creationMode === 'post' ? (
          <>
            <TextInput
              style={styles.input}
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption (optional)"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity style={styles.publishButton} onPress={publishPost} disabled={submitting || !photoAsset}>
              <Text style={styles.publishText}>{submitting ? 'Posting...' : 'Post'}</Text>
            </TouchableOpacity>
          </>
        ) : creationMode === 'story' ? (
          <>
            <TextInput style={styles.input} value={caption} onChangeText={setCaption} placeholder="Add a caption (optional)" placeholderTextColor={colors.textMuted} multiline />
            <TouchableOpacity style={styles.publishButton} onPress={publishStory} disabled={submitting || (!photoAsset && !videoUri)}>
              <Text style={styles.publishText}>{submitting ? 'Publishing...' : 'Share story'}</Text>
            </TouchableOpacity>
          </>
        ) : composerOpen ? (
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
  modeRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 18,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  activeModeButton: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  modeText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  activeModeText: {
    color: colors.text,
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
  photoPreview: {
    width: '100%',
    height: 360,
    borderRadius: radius.lg,
    marginBottom: 12,
    backgroundColor: '#e5e7eb',
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
