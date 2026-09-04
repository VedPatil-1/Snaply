import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { resolveMediaUrl } from '../config';

export default function ReelCommentsModal({ visible, reel, currentUser, onClose, onSubmitComment, onOpenProfile }) {
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(reel?.comments || []);

  useEffect(() => {
    setComments(reel?.comments || []);
  }, [reel]);

  const handleSubmit = () => {
    if (!commentText.trim()) return;
    onSubmitComment(reel._id, commentText.trim());
    setCommentText('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {comments.length ? (
              comments.map((comment, index) => (
                <View key={String(comment._id || `${comment.user?._id || comment.user || 'user'}-${index}`)} style={styles.commentRow}>
                  <TouchableOpacity onPress={() => comment.user?._id && onOpenProfile?.(comment.user._id)}><Image source={{ uri: resolveMediaUrl(comment.user?.profilePicture) || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80' }} style={styles.avatar} /></TouchableOpacity>
                  <View style={styles.commentBody}>
                    <Text style={styles.commentUser}>{comment.user?.username || 'user'}</Text>
                    <Text style={styles.commentText}>{comment.text}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No comments yet.</Text>
            )}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor="#9ca3af"
              value={commentText}
              onChangeText={setCommentText}
            />
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17,24,39,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '75%',
    minHeight: '50%',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeText: {
    color: '#111827',
    fontWeight: '600',
  },
  list: {
    flexGrow: 1,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  commentBody: {
    flex: 1,
  },
  commentUser: {
    fontWeight: '700',
    fontSize: 13,
    color: '#111827',
    marginBottom: 3,
  },
  commentText: {
    color: '#374151',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: '#111827',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});
