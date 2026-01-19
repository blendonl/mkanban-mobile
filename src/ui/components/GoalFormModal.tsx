import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import BaseModal from './BaseModal';
import { Input, TextArea } from './Input';
import { Button, SecondaryButton } from './Button';
import theme from '../theme/colors';
import { spacing } from '../theme/spacing';
import { CheckIcon } from './icons/TabIcons';
import { Project } from '../../domain/entities/Project';
import { Goal } from '../../domain/entities/Goal';

interface GoalFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    projectIds: string[];
  }) => Promise<void>;
  projects: Project[];
  initialGoal?: Goal | null;
}

export default function GoalFormModal({
  visible,
  onClose,
  onSubmit,
  projects,
  initialGoal,
}: GoalFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setTitle(initialGoal?.title || '');
    setDescription(initialGoal?.description || '');
    setStartDate(initialGoal?.start_date || '');
    setEndDate(initialGoal?.end_date || '');
    setProjectIds(initialGoal?.project_ids || []);
    setError('');
  }, [visible, initialGoal]);

  const handleToggleProject = (projectId: string) => {
    setProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Goal title is required');
      return;
    }
    if (!startDate || !endDate) {
      setError('Start and end dates are required');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be after start date');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate,
        projectIds,
      });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save goal');
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <View style={styles.footer}>
      <SecondaryButton
        title="Cancel"
        onPress={onClose}
        style={styles.cancelButton}
      />
      <Button
        title={initialGoal ? 'Update Goal' : 'Create Goal'}
        onPress={handleSubmit}
        loading={loading}
        disabled={!title.trim()}
      />
    </View>
  );

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={initialGoal ? 'Edit Goal' : 'New Goal'}
      footer={footer}
    >
      <Input
        label="Goal Title"
        placeholder="Enter your goal"
        value={title}
        onChangeText={setTitle}
        autoFocus
        error={error}
        required
      />

      <TextArea
        label="Description"
        placeholder="What does success look like?"
        value={description}
        onChangeText={setDescription}
        numberOfLines={3}
      />

      <Input
        label="Start Date"
        placeholder="YYYY-MM-DD"
        value={startDate}
        onChangeText={setStartDate}
      />

      <Input
        label="End Date"
        placeholder="YYYY-MM-DD"
        value={endDate}
        onChangeText={setEndDate}
      />

      <View style={styles.projectSection}>
        <Text style={styles.projectLabel}>Linked Projects</Text>
        {projects.length === 0 ? (
          <Text style={styles.projectEmpty}>
            Create a project first, then link it here.
          </Text>
        ) : (
          <View style={styles.projectList}>
            {projects.map((project) => {
              const selected = projectIds.includes(project.id);
              return (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.projectItem,
                    selected && styles.projectItemSelected,
                  ]}
                  onPress={() => handleToggleProject(project.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.projectColor,
                      { backgroundColor: project.color },
                    ]}
                  />
                  <Text style={styles.projectName} numberOfLines={1}>
                    {project.name}
                  </Text>
                  {selected && (
                    <CheckIcon size={18} focused={false} color={theme.accent.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  cancelButton: {
    marginRight: spacing.sm,
  },
  projectSection: {
    marginBottom: spacing.lg,
  },
  projectLabel: {
    color: theme.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  projectEmpty: {
    color: theme.text.tertiary,
    fontSize: 12,
  },
  projectList: {
    gap: spacing.sm,
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    backgroundColor: theme.card.background,
    gap: spacing.sm,
  },
  projectItemSelected: {
    borderColor: theme.accent.primary,
    backgroundColor: theme.accent.primary + '10',
  },
  projectColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  projectName: {
    flex: 1,
    color: theme.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
