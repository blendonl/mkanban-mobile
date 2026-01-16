import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme/colors';
import AppIcon from './icons/AppIcon';

interface OrphanedItemBadgeProps {
  size?: 'small' | 'medium';
}

export const OrphanedItemBadge: React.FC<OrphanedItemBadgeProps> = ({ size = 'medium' }) => {
  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, isSmall && styles.badgeSmall]}>
      <View style={styles.badgeContent}>
        <AppIcon name="alert" size={isSmall ? 12 : 14} color={theme.background.primary} />
        <Text style={[styles.badgeText, isSmall && styles.badgeTextSmall]}>
          Task Deleted
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    backgroundColor: theme.accent.warning,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    color: theme.background.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextSmall: {
    fontSize: 10,
  },
});
