import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import theme from '../theme/colors';

interface AutoRefreshIndicatorProps {
  isRefreshing: boolean;
  size?: 'small' | 'large';
}

export default function AutoRefreshIndicator({ isRefreshing, size = 'small' }: AutoRefreshIndicatorProps) {
  if (!isRefreshing) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={theme.accent.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 4,
  },
});
