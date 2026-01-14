import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useRoute,
  useNavigation,
  RouteProp,
  CommonActions,
} from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import theme from "../../theme/colors";
import { spacing } from "../../theme/spacing";
import { Project } from "../../../domain/entities/Project";
import { Board } from "../../../domain/entities/Board";
import { Note } from "../../../domain/entities/Note";
import {
  getProjectService,
  getBoardService,
  getNoteService,
} from "../../../core/DependencyContainer";
import { ProjectStackParamList } from "../../navigation/TabNavigator";
import GlassCard from "../../components/GlassCard";
import {
  ProjectsIcon,
  BoardsIcon,
  NotesIcon,
  TimeIcon,
  AgendaIcon,
  ChevronRightIcon,
} from "../../components/icons/TabIcons";

type ProjectDetailRouteProp = RouteProp<ProjectStackParamList, "ProjectDetail">;
type ProjectDetailNavProp = StackNavigationProp<
  ProjectStackParamList,
  "ProjectDetail"
>;

export default function ProjectDetailScreen() {
  const route = useRoute<ProjectDetailRouteProp>();
  const navigation = useNavigation<ProjectDetailNavProp>();
  const { projectId } = route.params;

  const [project, setProject] = useState<Project | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const projectService = getProjectService();
      const loadedProject = await projectService.getProjectById(projectId);
      setProject(loadedProject);

      const boardService = getBoardService();
      const projectBoards = await boardService.getBoardsByProject(projectId);
      setBoards(projectBoards.slice(0, 3));

      const noteService = getNoteService();
      const projectNotes = await noteService.getNotesByProject(projectId);
      const sortedNotes = projectNotes.sort(
        (a, b) => b.updated_at.getTime() - a.updated_at.getTime(),
      );
      setNotes(sortedNotes.slice(0, 3));
    } catch (error) {
      console.error("Failed to load project:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (project) {
      navigation.setOptions({ title: project.name });
    }
  }, [project, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return theme.accent.success;
      case "paused":
        return theme.accent.warning;
      case "archived":
        return theme.text.muted;
      default:
        return theme.text.tertiary;
    }
  };

  const navigateToTab = (tabName: string) => {
    navigation.dispatch(
      CommonActions.navigate({
        name: tabName,
      }),
    );
  };

  const handleNewBoard = () => navigateToTab("BoardsTab");
  const handleNewNote = () => navigateToTab("NotesTab");
  const handleSchedule = () => navigateToTab("AgendaTab");

  const handleBoardPress = (board: Board) => {
    navigation.dispatch(
      CommonActions.navigate({
        name: "BoardsTab",
        params: {
          screen: "Board",
          params: { boardId: board.id },
        },
      }),
    );
  };

  const handleNotePress = (note: Note) => {
    navigation.dispatch(
      CommonActions.navigate({
        name: "NotesTab",
        params: {
          screen: "NoteEditor",
          params: { noteId: note.id },
        },
      }),
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading project...</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Project not found</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(project.status);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent.primary}
          />
        }
      >
        <GlassCard style={styles.headerCard} tint="blue">
          <View style={styles.headerContent}>
            <View
              style={[styles.colorBadge, { backgroundColor: project.color }]}
            >
              <ProjectsIcon size={24} focused />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.projectName}>{project.name}</Text>
              {project.description ? (
                <Text style={styles.projectDescription} numberOfLines={2}>
                  {project.description}
                </Text>
              ) : null}
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColor + "20" },
                ]}
              >
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {project.status}
                </Text>
              </View>
            </View>
          </View>
        </GlassCard>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <BoardsIcon size={18} focused />
              <Text style={styles.sectionTitle}>Boards</Text>
            </View>
            {boards.length > 0 && (
              <TouchableOpacity onPress={handleNewBoard} activeOpacity={0.7}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            )}
          </View>
          {boards.length > 0 ? (
            boards.map((board) => (
              <TouchableOpacity
                key={board.id}
                activeOpacity={0.7}
                onPress={() => handleBoardPress(board)}
              >
                <GlassCard style={styles.itemCard}>
                  <View style={styles.itemContent}>
                    <BoardsIcon size={20} focused={false} />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle}>{board.name}</Text>
                      <Text style={styles.itemSubtitle}>
                        {board.columns.length} columns
                      </Text>
                    </View>
                    <ChevronRightIcon size={18} focused={false} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            ))
          ) : (
            <GlassCard style={styles.emptySection}>
              <View style={styles.emptySectionContent}>
                <BoardsIcon size={32} focused={false} />
                <Text style={styles.emptySectionTitle}>No boards yet</Text>
                <TouchableOpacity onPress={handleNewBoard} activeOpacity={0.7}>
                  <Text style={styles.emptySectionAction}>Create Board</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <NotesIcon size={18} focused />
              <Text style={styles.sectionTitle}>Recent Notes</Text>
            </View>
            {notes.length > 0 && (
              <TouchableOpacity onPress={handleNewNote} activeOpacity={0.7}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            )}
          </View>
          {notes.length > 0 ? (
            notes.map((note) => (
              <TouchableOpacity
                key={note.id}
                activeOpacity={0.7}
                onPress={() => handleNotePress(note)}
              >
                <GlassCard style={styles.itemCard}>
                  <View style={styles.itemContent}>
                    <NotesIcon size={20} focused={false} />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle}>{note.title}</Text>
                      <Text style={styles.itemSubtitle} numberOfLines={1}>
                        {note.preview || note.content.substring(0, 100)}
                      </Text>
                    </View>
                    <ChevronRightIcon size={18} focused={false} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            ))
          ) : (
            <GlassCard style={styles.emptySection}>
              <View style={styles.emptySectionContent}>
                <NotesIcon size={32} focused={false} />
                <Text style={styles.emptySectionTitle}>No notes yet</Text>
                <TouchableOpacity onPress={handleNewNote} activeOpacity={0.7}>
                  <Text style={styles.emptySectionAction}>Create Note</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <TimeIcon size={18} focused />
              <Text style={styles.sectionTitle}>Time This Week</Text>
            </View>
          </View>
          <GlassCard style={styles.timeCard} tint="purple">
            <View style={styles.timeContent}>
              <TimeIcon size={32} focused />
              <View style={styles.timeInfo}>
                <Text style={styles.timeValue}>0h 0m</Text>
                <Text style={styles.timeLabel}>tracked this week</Text>
              </View>
            </View>
          </GlassCard>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
            </View>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleNewBoard}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIconContainer,
                  { backgroundColor: theme.accent.primary + "20" },
                ]}
              >
                <BoardsIcon size={24} focused />
              </View>
              <Text style={styles.actionLabel}>New Board</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleNewNote}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIconContainer,
                  { backgroundColor: theme.accent.secondary + "20" },
                ]}
              >
                <NotesIcon size={24} focused />
              </View>
              <Text style={styles.actionLabel}>New Note</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSchedule}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIconContainer,
                  { backgroundColor: theme.accent.warning + "20" },
                ]}
              >
                <AgendaIcon size={24} focused />
              </View>
              <Text style={styles.actionLabel}>Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background.primary,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  loadingText: {
    color: theme.text.secondary,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  errorText: {
    color: theme.accent.error,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  headerCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  colorBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    marginRight: spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: {
    flex: 1,
  },
  projectName: {
    color: theme.text.primary,
    fontSize: 22,
    fontWeight: "700",
  },
  projectDescription: {
    color: theme.text.secondary,
    fontSize: 14,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: spacing.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    color: theme.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  seeAllText: {
    color: theme.accent.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  itemCard: {
    marginBottom: spacing.sm,
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  itemTitle: {
    color: theme.text.primary,
    fontSize: 15,
    fontWeight: "500",
  },
  itemSubtitle: {
    color: theme.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  emptySection: {
    alignItems: "center",
  },
  emptySectionContent: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  emptySectionTitle: {
    color: theme.text.muted,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  emptySectionAction: {
    color: theme.accent.primary,
    fontSize: 14,
    fontWeight: "500",
    marginTop: spacing.sm,
  },
  timeCard: {
    flexDirection: "row",
  },
  timeContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeInfo: {
    marginLeft: spacing.lg,
  },
  timeValue: {
    color: theme.text.primary,
    fontSize: 28,
    fontWeight: "700",
  },
  timeLabel: {
    color: theme.text.secondary,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  actionButton: {
    alignItems: "center",
    padding: spacing.md,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  actionLabel: {
    color: theme.text.secondary,
    fontSize: 12,
    fontWeight: "500",
  },
});
