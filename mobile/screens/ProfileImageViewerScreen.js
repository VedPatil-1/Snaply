import React from 'react';
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileImageViewerScreen({ navigation, route }) {
  const { imageUrl, fallbackInitial = 'U', title = 'Profile photo' } = route.params || {};
  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <Pressable style={styles.backdrop} onPress={() => navigation.goBack()}>
      <Pressable style={styles.content} onPress={() => null}>
        <View style={styles.header}><Text style={styles.title}>{title}</Text><TouchableOpacity onPress={() => navigation.goBack()} style={styles.close}><Text style={styles.closeText}>✕</Text></TouchableOpacity></View>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" /> : <View style={styles.fallback}><Text style={styles.initial}>{fallbackInitial}</Text></View>}
      </Pressable>
    </Pressable>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)' },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16 },
  content: { maxHeight: '100%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  closeText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  image: { width: '100%', aspectRatio: 1, maxHeight: '82%', backgroundColor: '#111' },
  fallback: { width: '100%', aspectRatio: 1, maxHeight: '82%', borderRadius: 16, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  initial: { color: '#374151', fontSize: 96, fontWeight: '800' },
});
