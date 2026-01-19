import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import theme from '../theme';
import AppIcon from './icons/AppIcon';

export interface FilterChip {
  id: string;
  label: string;
  type: 'all' | 'project' | 'goal';
  icon?: string;
}

interface FilterChipBarProps {
  chips: FilterChip[];
  selectedChipId: string | null;
  onChipPress: (chipId: string | null) => void;
  onClearFilters?: () => void;
  showClearButton?: boolean;
}

export default function FilterChipBar({
  chips,
  selectedChipId,
  onChipPress,
  onClearFilters,
  showClearButton = true,
}: FilterChipBarProps) {
  const hasActiveFilter = selectedChipId !== null && selectedChipId !== 'all';

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {chips.map(chip => (
          <TouchableOpacity
            key={chip.id}
            style={[
              styles.chip,
              selectedChipId === chip.id && styles.chipActive,
            ]}
            onPress={() => onChipPress(chip.id === selectedChipId ? null : chip.id)}
          >
            {chip.icon && (
              <AppIcon
                name={chip.icon}
                size={14}
                color={
                  selectedChipId === chip.id
                    ? theme.button.text
                    : theme.text.secondary
                }
              />
            )}
            <Text
              style={[
                styles.chipText,
                selectedChipId === chip.id && styles.chipTextActive,
              ]}
            >
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}

        {showClearButton && hasActiveFilter && onClearFilters && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={onClearFilters}
          >
            <AppIcon name="x" size={14} color={theme.status.error} />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  scrollContent: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.chip,
    backgroundColor: theme.card.background,
    borderWidth: 1,
    borderColor: theme.border.primary,
  },
  chipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipText: {
    ...theme.typography.textStyles.caption,
    color: theme.text.primary,
  },
  chipTextActive: {
    color: theme.button.text,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.chip,
    backgroundColor: theme.status.error + '20',
    borderWidth: 1,
    borderColor: theme.status.error,
  },
  clearButtonText: {
    ...theme.typography.textStyles.caption,
    color: theme.status.error,
  },
});
