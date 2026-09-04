import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PlaceholderScreen({
  title,
  subtitle,
  accent = '#3b82f6',
}) {
  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: accent }]}>
        <Text style={styles.badgeText}>{title}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 24,
  },
  badge: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    marginBottom: 16,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});
