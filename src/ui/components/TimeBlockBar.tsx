import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TaskType } from '../../domain/entities/Task';
import { theme } from '../theme/colors';

interface TimeBlockBarProps {
  taskType: TaskType;
  durationMinutes?: number | null;
  maxDurationMinutes?: number;
}

export const TimeBlockBar: React.FC<TimeBlockBarProps> = ({
  taskType,
  durationMinutes,
  maxDurationMinutes = 120,
}) => {
  const getTaskTypeColor = () => {
    switch (taskType) {
      case 'meeting':
        return theme.accent.success;
      case 'milestone':
        return theme.accent.secondary;
      default:
        return theme.accent.primary;
    }
  };

  if (!durationMinutes) {
    return null;
  }

  const widthPercentage = Math.min((durationMinutes / maxDurationMinutes) * 100, 100);
  const color = getTaskTypeColor();

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View
          style={[
            styles.bar,
            {
              width: `${widthPercentage}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  track: {
    height: 4,
    backgroundColor: theme.border.secondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 2,
  },
});
