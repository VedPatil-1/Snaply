import React, { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { apiRequest, uploadImageAsset } from '../services/api';
import { resolveMediaUrl } from '../config';
import { publishUserUpdate } from '../services/sync';

export default function EditProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [form, setForm] = useState({
    name: '',
    username: '',
    bio: '',
    profilePicture: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const user = await apiRequest('/users/me');
        setForm({
          name: user.name || '',
          username: user.username || '',
          bio: user.bio || '',
          profilePicture: user.profilePicture || '',
        });
      } catch (error) {
        Alert.alert('Profile load failed', error.message || 'Unable to load your profile.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (saving) return;
    try {
      setSaving(true);
      let profilePicture = form.profilePicture;
      if (selectedImage) {
        if (selectedImage.fileSize && selectedImage.fileSize > 25 * 1024 * 1024) throw new Error('Choose an image smaller than 25 MB.');
        const upload = await uploadImageAsset(selectedImage);
        profilePicture = upload.mediaUrl;
        if (!profilePicture || /^(file:|blob:)/i.test(profilePicture)) throw new Error('The image upload did not return a usable URL.');
      }
      const payload = {
        name: form.name,
        username: form.username,
        bio: form.bio,
        profilePicture,
      };

      const updatedUser = await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      publishUserUpdate({ currentUser: updatedUser });
      Alert.alert('Profile updated', 'Your changes are saved.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Update failed', error.message || 'Unable to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const chooseProfilePicture = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
    if (result.didCancel || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.uri) {
      Alert.alert('Invalid image', 'The selected image could not be read.');
      return;
    }
    setSelectedImage({ uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg', fileName: (asset.fileName || `profile-${Date.now()}.jpg`).replace(/\s+/g, '-'), fileSize: asset.fileSize });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving || loading}>
          <Text style={[styles.saveText, (saving || loading) && styles.saveDisabled]}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#111827" /></View> : <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.avatarPicker} onPress={chooseProfilePicture} disabled={saving}>
          {selectedImage?.uri || form.profilePicture ? <Image source={{ uri: selectedImage?.uri || resolveMediaUrl(form.profilePicture) }} style={styles.avatar} /> : <Text style={styles.avatarInitial}>{form.name?.charAt(0)?.toUpperCase() || 'A'}</Text>}
          <Text style={styles.changePhoto}>Change profile picture</Text>
        </TouchableOpacity>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(value) => updateField('name', value)}
          placeholder="Your name"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={form.username}
          onChangeText={(value) => updateField('username', value)}
          placeholder="username"
          autoCapitalize="none"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={form.bio}
          onChangeText={(value) => updateField('bio', value)}
          placeholder="Tell people about yourself"
          multiline
          numberOfLines={4}
          placeholderTextColor="#9ca3af"
        />

      </ScrollView>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  saveText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  saveDisabled: {
    opacity: 0.5,
  },
  content: {
    padding: 20,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarPicker: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: '#e5e7eb' },
  avatarInitial: { width: 104, height: 104, borderRadius: 52, backgroundColor: '#e5e7eb', textAlign: 'center', textAlignVertical: 'center', fontSize: 36, fontWeight: '800', color: '#374151' },
  changePhoto: { marginTop: 10, color: '#111827', fontWeight: '700' },
  label: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 18,
  },
  bioInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
