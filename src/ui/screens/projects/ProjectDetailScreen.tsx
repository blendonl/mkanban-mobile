import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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

const normalizeHexColor = (color: string) => {
  if (!color.startsWith("#")) {
    return null;
  }

  if (color.length === 4) {
    const [r, g, b] = color.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  if (color.length === 7) {
    return color;
  }

  return null;
};

const withOpacity = (color: string, opacityHex: string) => {
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    return color;
  }

  return `${normalized}${opacityHex}`;
};

const isLightColor = (color: string) => {
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    return false;
  }

  const hex = normalized.slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.64;
};

export default function ProjectDetailScreen() {
  const route = useRoute<ProjectDetailRouteProp>();
  const navigation = useNavigation<ProjectDetailNavProp>();
  const { projectId } = route.params;
  const insets = useSafeAreaInsets();

  const [project, setProject] = useState<Project | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [boardCount, setBoardCount] = useState(0);
  const [noteCount, setNoteCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const projectService = getProjectService();
      const loadedProject = await projectService.getProjectById(projectId);
      setProject(loadedProject);

      const boardService = getBoardService();
      const projectBoards = await boardService.getBoardsByProject(projectId);
      setBoardCount(projectBoards.length);
      setBoards(projectBoards.slice(0, 3));

      const noteService = getNoteService();
      const projectNotes = await noteService.getNotesByProject(projectId);
      const sortedNotes = projectNotes.sort(
        (a, b) => b.updated_at.getTime() - a.updated_at.getTime(),
      );
      setNoteCount(sortedNotes.length);
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
      case "completed":
        return theme.accent.info;
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
  const updatedLabel = project.updated_at
    ? project.updated_at.toLocaleDateString()
    : "Unknown";
  const projectColor = project.color || theme.accent.primary;
  const statusBarStyle = isLightColor(projectColor)
    ? "dark-content"
    : "light-content";
  const heroBackground = theme.background.primary;
  const heroPaddingTop = Math.max(spacing.md, insets.top);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background.primary }]}
      edges={["top"]}
    >
      <StatusBar
        backgroundColor={theme.background.primary}
        barStyle={statusBarStyle}
      />
      <View style={styles.body}>
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
          <View
            style={[
              styles.hero,
              {
                backgroundColor: heroBackground,
                paddingTop: heroPaddingTop,
              },
            ]}
          >
            <GlassCard style={styles.headerCard} tint="neutral" intensity={26}>
              <View style={styles.headerContent}>
                <View
                  style={[styles.colorBadge, { backgroundColor: projectColor }]}
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
                  <View style={styles.metaRow}>
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
                    <Text style={styles.updatedText}>
                      Updated {updatedLabel}
                    </Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{boardCount}</Text>
              <Text style={styles.statLabel}>Boards</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{noteCount}</Text>
              <Text style={styles.statLabel}>Notes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>0h</Text>
              <Text style={styles.statLabel}>This week</Text>
            </View>
          </View>

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
                <View style={styles.itemIcon}>
                  <BoardsIcon size={20} focused={false} />
                </View>
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
            <GlassCard style={[styles.itemCard, styles.emptySection]}>
              <View style={styles.emptySectionContent}>
                <View style={styles.emptyIcon}>
                  <BoardsIcon size={28} focused={false} />
                </View>
                <Text style={styles.emptySectionTitle}>No boards yet</Text>
                <Text style={styles.emptySectionSubtitle}>
                  Start with a lightweight board to map work.
                </Text>
                <TouchableOpacity onPress={handleNewBoard} activeOpacity={0.7}>
                  <Text style={styles.emptySectionAction}>Create Board</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}
        </View>

        <View style={[styles.section, styles.notesSection]}>
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
                <View style={styles.itemIcon}>
                  <NotesIcon size={20} focused={false} />
                </View>
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
                <View style={styles.emptyIcon}>
                  <NotesIcon size={28} focused={false} />
                </View>
                <Text style={styles.emptySectionTitle}>No notes yet</Text>
                <Text style={styles.emptySectionSubtitle}>
                  Capture decisions, links, and quick updates here.
                </Text>
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
              <View style={styles.itemIcon}>
                <TimeIcon size={26} focused />
              </View>
              <View style={styles.timeInfo}>
                <Text style={styles.timeValue}>0h 0m</Text>
                <Text style={styles.timeLabel}>tracked this week</Text>
              </View>
              <View style={styles.timeSpacer} />
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.timeAction}>Log time</Text>
              </TouchableOpacity>
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
              style={styles.actionCard}
              onPress={handleNewBoard}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIconContainer,
                  { backgroundColor: theme.accent.primary + "20" },
                ]}
              >
                <BoardsIcon size={22} focused />
              </View>
              <Text style={styles.actionTitle}>New Board</Text>
              <Text style={styles.actionSubtitle}>Plan workflow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={handleNewNote}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIconContainer,
                  { backgroundColor: theme.accent.secondary + "20" },
                ]}
              >
                <NotesIcon size={22} focused />
              </View>
              <Text style={styles.actionTitle}>New Note</Text>
              <Text style={styles.actionSubtitle}>Capture ideas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={handleSchedule}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.actionIconContainer,
                  { backgroundColor: theme.accent.warning + "20" },
                ]}
              >
                <AgendaIcon size={22} focused />
              </View>
              <Text style={styles.actionTitle}>Schedule</Text>
              <Text style={styles.actionSubtitle}>Block time</Text>
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    backgroundColor: theme.background.primary,
  },
  contentContainer: {
    paddingBottom: 120,
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
  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    borderWidth: 0,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerCard: {
    marginTop: spacing.sm,
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
    fontSize: 24,
    fontWeight: "700",
  },
  projectDescription: {
    color: theme.text.secondary,
    fontSize: 14,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  updatedText: {
    color: theme.text.tertiary,
    fontSize: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.background.elevated,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border.secondary,
  },
  statValue: {
    color: theme.text.primary,
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    color: theme.text.tertiary,
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  notesSection: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    paddingHorizontal: 0,
    paddingVertical: spacing.lg,
    borderRadius: 24,
    borderWidth: 0,
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
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    justifyContent: "center",
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
    width: "100%",
    alignSelf: "stretch",
  },
  emptySectionContent: {
    alignItems: "center",
    paddingVertical: spacing.md,
    width: "100%",
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.background.elevated,
    borderWidth: 1,
    borderColor: theme.border.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  emptySectionTitle: {
    color: theme.text.muted,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  emptySectionSubtitle: {
    color: theme.text.tertiary,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
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
    width: "100%",
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
  timeSpacer: {
    flex: 1,
  },
  timeAction: {
    color: theme.accent.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: theme.background.elevated,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border.secondary,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  actionTitle: {
    color: theme.text.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  actionSubtitle: {
    color: theme.text.tertiary,
    fontSize: 11,
    marginTop: 2,
  },
});
