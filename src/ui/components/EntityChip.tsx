import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import theme from '../theme/colors';
import { spacing } from '../theme/spacing';
import { EntityType } from '../../domain/entities/Note';
import AppIcon, { AppIconName } from './icons/AppIcon';

interface EntityChipProps {
  entityType: EntityType;
  entityName: string;
  entityId: string;
  onRemove?: (entityId: string) => void;
  onPress?: (entityId: string) => void;
  showRemove?: boolean;
}

const ENTITY_CONFIG: Record<EntityType, { icon: AppIconName; color: string }> = {
  project: { icon: 'folder', color: theme.accent.primary },
  board: { icon: 'board', color: theme.accent.secondary },
  task: { icon: 'check', color: theme.accent.success },
};

export default function EntityChip({
  entityType,
  entityName,
  entityId,
  onRemove,
  onPress,
  showRemove = true,
}: EntityChipProps) {
  const config = ENTITY_CONFIG[entityType];

  const handlePress = () => {
    if (onPress) {
      onPress(entityId);
    }
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove(entityId);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { borderColor: config.color }]}
      onPress={handlePress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.icon}>
        <AppIcon name={config.icon} size={14} color={config.color} />
      </View>
      <Text style={styles.name} numberOfLines={1}>{entityName}</Text>
      {showRemove && onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={handleRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.removeText, { color: config.color }]}>×</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass.tint.neutral,
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    height: 32,
    borderWidth: 1,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  icon: {
    marginRight: spacing.xs,
  },
  name: {
    color: theme.text.primary,
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 120,
  },
  removeButton: {
    marginLeft: spacing.xs,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    fontSize: 18,
    fontWeight: '300',
    lineHeight: 16,
  },
});
