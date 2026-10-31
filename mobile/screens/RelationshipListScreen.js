import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest, toggleFollow as requestFollow } from '../services/api';
import { publishUserUpdate } from '../services/sync';
import { resolveMediaUrl } from '../config';
import { colors } from '../theme';

export default function RelationshipListScreen({ navigation, route }) {
  const userId = route?.params?.userId;
  const relationship = route?.params?.relationship === 'following' ? 'following' : 'followers';
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const followVersionsRef = React.useRef(new Map());

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [currentUser, list] = await Promise.all([apiRequest('/users/me'), apiRequest(`/users/${userId}/${relationship}`)]);
      setMe(currentUser);
      setUsers(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }, [relationship, userId]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async (target) => {
    if (!me || String(target._id) === String(me._id)) return;
    const wasFollowing = Boolean(target.isFollowing);
    const id = String(target._id);
    const version = (followVersionsRef.current.get(id) || 0) + 1;
    followVersionsRef.current.set(id, version);
    setUsers((items) => items.map((item) => String(item._id) === String(target._id) ? { ...item, isFollowing: !wasFollowing } : item));
    requestFollow(me._id, target._id, wasFollowing).then((response) => {
      if (followVersionsRef.current.get(id) !== version) return;
      if (response?.currentUser) setMe(response.currentUser);
      setUsers((items) => items.map((item) => String(item._id) === id
        ? { ...item, ...(response?.targetUser || {}), isFollowing: Boolean(response?.isFollowing) }
        : item));
      publishUserUpdate(response);
    }).catch((error) => {
      if (followVersionsRef.current.get(id) === version) setUsers((items) => items.map((item) => String(item._id) === id ? { ...item, isFollowing: wasFollowing } : item));
      console.warn('Relationship follow failed:', error.message);
    });
  };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>Back</Text></TouchableOpacity><Text style={styles.title}>{relationship === 'followers' ? 'Followers' : 'Following'}</Text><View style={styles.spacer} /></View>
    {loading ? <View style={styles.center}><ActivityIndicator color="#111827" /></View> : <FlatList data={users} keyExtractor={(item) => String(item._id)} renderItem={({ item }) => <View style={styles.row}>
      <TouchableOpacity style={styles.user} onPress={() => String(item._id) === String(me?._id) ? navigation.navigate('ProfileViewer') : navigation.navigate('UserProfile', { userId: item._id })}>{item.profilePicture ? <Image source={{ uri: resolveMediaUrl(item.profilePicture) }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarInitial}>{item.username?.charAt(0)?.toUpperCase() || 'U'}</Text></View>}<View><Text style={styles.username}>@{item.username}</Text><Text style={styles.name}>{item.name}</Text></View></TouchableOpacity>
      {String(item._id) !== String(me?._id) ? <TouchableOpacity style={[styles.follow, item.isFollowing && styles.following]} onPress={() => toggleFollow(item)}><Text style={[styles.followText, item.isFollowing && styles.followingText]}>{item.isFollowing ? 'Following' : 'Follow'}</Text></TouchableOpacity> : null}
    </View>} ListEmptyComponent={<View style={styles.center}><Text>No users yet.</Text></View>} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safeArea: { flex: 1, backgroundColor: '#fff' }, header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#eee' }, back: { fontWeight: '700', color: '#111827' }, title: { fontSize: 18, fontWeight: '800' }, spacer: { width: 34 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: '#f3f4f6' }, user: { flex: 1, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 46, height: 46, borderRadius: 23, marginRight: 12, backgroundColor: '#e5e7eb' }, avatarFallback: { alignItems: 'center', justifyContent: 'center' }, avatarInitial: { color: '#374151', fontWeight: '800' }, username: { fontWeight: '700', color: '#111827' }, name: { marginTop: 2, color: '#6b7280' }, follow: { backgroundColor: '#111827', borderRadius: 8, paddingHorizontal: 13, paddingVertical: 8 }, following: { backgroundColor: colors.accentSoft }, followText: { color: '#fff', fontWeight: '700', fontSize: 12 }, followingText: { color: colors.accentDeep } });
