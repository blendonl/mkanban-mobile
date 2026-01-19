import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { GoalsStackParamList } from "../../navigation/TabNavigator";
import { Screen } from "../../components/Screen";
import theme from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { getGoalService, getProjectService } from "../../../core/DependencyContainer";
import { Goal } from "../../../domain/entities/Goal";
import { Project } from "../../../domain/entities/Project";
import { GoalProgress } from "../../../services/GoalService";
import GoalFormModal from "../../components/GoalFormModal";
import AppIcon from "../../components/icons/AppIcon";

type GoalDetailRouteProp = RouteProp<GoalsStackParamList, "GoalDetail">;

export default function GoalDetailScreen() {
  const route = useRoute<GoalDetailRouteProp>();
  const navigation = useNavigation();
  const { goalId } = route.params;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [progress, setProgress] = useState<GoalProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadGoal = useCallback(async () => {
    try {
      const goalService = getGoalService();
      const projectService = getProjectService();
      const [loadedGoal, loadedProjects, goalProgress] = await Promise.all([
        goalService.getGoalById(goalId),
        projectService.getAllProjects(),
        goalService.getGoalProgress(goalId),
      ]);
      setGoal(loadedGoal);
      setProjects(loadedProjects);
      setProgress(goalProgress);
    } catch (error) {
      console.error("Failed to load goal:", error);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    loadGoal();
  }, [loadGoal]);

  const handleUpdateGoal = async (data: {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    projectIds: string[];
  }) => {
    const goalService = getGoalService();
    await goalService.updateGoal(goalId, {
      title: data.title,
      description: data.description,
      start_date: data.startDate,
      end_date: data.endDate,
      project_ids: data.projectIds,
    });
    await loadGoal();
    setShowEditModal(false);
  };

  const handleDeleteGoal = () => {
    Alert.alert(
      "Delete Goal",
      "Are you sure you want to delete this goal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const goalService = getGoalService();
              await goalService.deleteGoal(goalId);
              navigation.goBack();
            } catch (error) {
              Alert.alert("Error", "Failed to delete goal");
            }
          },
        },
      ]
    );
  };

  const linkedProjects = projects.filter((project) =>
    goal?.project_ids.includes(project.id)
  );

  if (loading || !goal) {
    return (
      <Screen hasTabBar>
        <Text style={styles.loadingText}>Loading goal...</Text>
      </Screen>
    );
  }

  const percent = progress?.percentComplete || 0;

  return (
    <Screen hasTabBar scrollable contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{goal.title}</Text>
          {goal.description ? (
            <Text style={styles.description}>{goal.description}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setShowEditModal(true)}
        >
          <AppIcon name="edit" size={16} color={theme.accent.primary} />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Timeline</Text>
        <Text style={styles.cardText}>
          {goal.start_date} → {goal.end_date}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progress</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {percent}% complete ({progress?.completedOccurrences || 0}/
          {progress?.totalOccurrences || 0} check-ins)
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Linked Projects</Text>
        {linkedProjects.length === 0 ? (
          <Text style={styles.cardTextMuted}>No linked projects yet.</Text>
        ) : (
          linkedProjects.map((project) => (
            <View key={project.id} style={styles.projectRow}>
              <View style={[styles.projectDot, { backgroundColor: project.color }]} />
              <Text style={styles.projectName}>{project.name}</Text>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteGoal}>
        <AppIcon name="trash" size={16} color={theme.accent.error} />
        <Text style={styles.deleteButtonText}>Delete Goal</Text>
      </TouchableOpacity>

      <GoalFormModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleUpdateGoal}
        projects={projects}
        initialGoal={goal}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  loadingText: {
    color: theme.text.secondary,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.text.primary,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 14,
    color: theme.text.secondary,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.accent.primary,
  },
  editButtonText: {
    color: theme.accent.primary,
    fontWeight: "600",
    fontSize: 12,
  },
  card: {
    backgroundColor: theme.card.background,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.card.border,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.text.primary,
    marginBottom: spacing.xs,
  },
  cardText: {
    fontSize: 13,
    color: theme.text.secondary,
  },
  cardTextMuted: {
    fontSize: 12,
    color: theme.text.tertiary,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.border.secondary,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.accent.primary,
  },
  progressText: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: theme.text.secondary,
  },
  projectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  projectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  projectName: {
    fontSize: 13,
    color: theme.text.primary,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.accent.error,
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  deleteButtonText: {
    color: theme.accent.error,
    fontWeight: "600",
  },
});
