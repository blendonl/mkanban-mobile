import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import theme from '../theme/colors';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
}

export default function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (status === 'idle') {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [status, fadeAnim]);

  if (status === 'idle') {
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'saving':
        return {
          text: 'Saving...',
          color: theme.text.muted,
          icon: null,
        };
      case 'saved':
        return {
          text: 'Saved',
          color: theme.accent.success,
          icon: '✓',
        };
      case 'error':
        return {
          text: 'Error saving',
          color: theme.accent.error,
          icon: '⚠',
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {status === 'saving' ? (
        <ActivityIndicator size="small" color={config.color} />
      ) : (
        config.icon && <Text style={[styles.icon, { color: config.color }]}>{config.icon}</Text>
      )}
      <Text style={[styles.text, { color: config.color }]}>{config.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.glass.border,
    zIndex: 1000,
  },
  icon: {
    fontSize: 16,
    marginRight: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
});
