import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StackNavigationProp } from "@react-navigation/stack";
import { Board } from "../../domain/entities/Board";
import { getBoardService } from "../../core/DependencyContainer";
import { useCurrentProject } from "../../core/ProjectContext";
import EmptyState from "../components/EmptyState";
import theme from "../theme";
import alertService from "../../services/AlertService";
import logger from "../../utils/logger";
import { BoardStackParamList } from "../navigation/TabNavigator";

type BoardListScreenNavigationProp = StackNavigationProp<
  BoardStackParamList,
  "BoardList"
>;

interface Props {
  navigation: BoardListScreenNavigationProp;
}

export default function BoardListScreen({ navigation }: Props) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDescription, setNewBoardDescription] = useState("");

  const boardService = getBoardService();
  const { currentProject } = useCurrentProject();

  const loadBoards = useCallback(async () => {
    if (!currentProject) {
      setBoards([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const projectBoards = await boardService.getBoardsByProject(
        currentProject.id,
      );
      setBoards(projectBoards);
    } catch (error) {
      logger.error("Failed to load boards", error);
      alertService.showError("Failed to load boards");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [boardService, currentProject]);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadBoards();
  }, [loadBoards]);

  const handleCreateBoard = async () => {
    if (!currentProject) {
      alertService.showError("Please select a project first");
      return;
    }

    if (!newBoardName.trim()) {
      alertService.showValidationError("Board name is required");
      return;
    }

    try {
      const newBoard = await boardService.createBoardInProject(
        currentProject.id,
        newBoardName.trim(),
        newBoardDescription.trim() || undefined,
      );

      setShowCreateDialog(false);
      setNewBoardName("");
      setNewBoardDescription("");
      await loadBoards();
      navigation.navigate("Board", { boardId: newBoard.id });
    } catch (error) {
      logger.error("Failed to create board", error, { name: newBoardName });
      alertService.showError("Failed to create board");
    }
  };

  const handleBoardPress = (board: Board) => {
    navigation.navigate("Board", { boardId: board.id });
  };

  const getTotalItemCount = (board: Board): number => {
    return board.columns.reduce(
      (total, column) => total + column.tasks.length,
      0,
    );
  };

  const renderBoardCard = ({ item: board }: { item: Board }) => (
    <TouchableOpacity
      style={styles.boardCard}
      onPress={() => handleBoardPress(board)}
      activeOpacity={theme.ui.PRESSED_OPACITY}
    >
      <Text style={styles.boardName}>{board.name}</Text>
      {board.description && (
        <Text style={styles.boardDescription} numberOfLines={2}>
          {board.description}
        </Text>
      )}
      <View style={styles.boardFooter}>
        <Text style={styles.boardStats}>
          {board.columns.length} columns • {getTotalItemCount(board)} items
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (!currentProject) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centerContainer}>
          <EmptyState
            title="No Project Selected"
            message="Please select or create a project first to view boards"
            actionLabel="Go to Projects"
            onAction={() => navigation.navigate("Projects" as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading boards...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showCreateDialog) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.dialogContainer}>
          <Text style={styles.dialogTitle}>Create New Board</Text>

          <TextInput
            style={styles.input}
            placeholder="Board Name *"
            placeholderTextColor={theme.text.muted}
            value={newBoardName}
            onChangeText={setNewBoardName}
            autoFocus
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            placeholderTextColor={theme.text.muted}
            value={newBoardDescription}
            onChangeText={setNewBoardDescription}
            multiline
            numberOfLines={4}
          />

          <View style={styles.dialogButtons}>
            <TouchableOpacity
              style={[styles.dialogButton, styles.cancelButton]}
              onPress={() => {
                setShowCreateDialog(false);
                setNewBoardName("");
                setNewBoardDescription("");
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dialogButton, styles.createButtonStyle]}
              onPress={handleCreateBoard}
            >
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.screenHeader}>
        <View style={styles.headerLeft} />
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate("Settings")}
        >
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      {currentProject && (
        <View style={styles.projectBanner}>
          <View
            style={[
              styles.projectColor,
              { backgroundColor: currentProject.color },
            ]}
          />
          <Text style={styles.projectBannerText}>{currentProject.name}</Text>
        </View>
      )}
      {boards.length === 0 ? (
        <EmptyState
          title="No Boards Yet"
          message={
            currentProject
              ? `Create your first board in ${currentProject.name}`
              : "Create your first board to start organizing your tasks"
          }
          actionLabel="Create Board"
          onAction={() => setShowCreateDialog(true)}
        />
      ) : (
        <FlatList
          data={boards}
          renderItem={renderBoardCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent.primary}
            />
          }
        />
      )}

      {boards.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCreateDialog(true)}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background.primary,
  },
  screenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  headerLeft: {
    width: 40,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.glass.tint.neutral,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  settingsIcon: {
    fontSize: 18,
    color: theme.text.secondary,
  },
  projectBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.background.secondary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.primary,
  },
  projectColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.sm,
  },
  projectBannerText: {
    color: theme.text.secondary,
    fontSize: theme.typography.fontSizes.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.background.primary,
  },
  loadingText: {
    ...theme.typography.textStyles.body,
    color: theme.text.secondary,
  },
  listContent: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  boardCard: {
    backgroundColor: theme.glass.tint.neutral,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  boardName: {
    ...theme.typography.textStyles.h3,
    color: theme.text.primary,
    marginBottom: theme.spacing.xs,
  },
  boardDescription: {
    ...theme.typography.textStyles.body,
    color: theme.text.secondary,
    marginBottom: theme.spacing.md,
  },
  boardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  boardStats: {
    ...theme.typography.textStyles.bodySmall,
    color: theme.text.tertiary,
  },
  fab: {
    position: "absolute",
    right: theme.spacing.xl,
    bottom: 100,
    width: theme.ui.FAB_SIZE,
    height: theme.ui.FAB_SIZE,
    borderRadius: theme.radius.fab,
    backgroundColor: theme.accent.primary,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadows.fab,
  },
  fabText: {
    color: theme.button.primary.text,
    fontSize: theme.typography.fontSizes.display,
    fontWeight: theme.typography.fontWeights.light,
  },
  dialogContainer: {
    flex: 1,
    padding: theme.spacing.xl,
    backgroundColor: theme.modal.background,
  },
  dialogTitle: {
    ...theme.typography.textStyles.h1,
    color: theme.text.primary,
    marginBottom: theme.spacing.xl,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.input.border,
    borderRadius: theme.radius.input,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSizes.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.input.background,
    color: theme.input.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  dialogButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: theme.spacing.xl,
  },
  dialogButton: {
    paddingHorizontal: theme.spacing.buttonPadding.horizontal,
    paddingVertical: theme.spacing.buttonPadding.vertical,
    borderRadius: theme.radius.button,
    marginLeft: theme.spacing.md,
  },
  cancelButton: {
    backgroundColor: theme.button.secondary.background,
  },
  cancelButtonText: {
    color: theme.button.secondary.text,
    ...theme.typography.textStyles.button,
  },
  createButtonStyle: {
    backgroundColor: theme.button.primary.background,
  },
  createButtonText: {
    color: theme.button.primary.text,
    ...theme.typography.textStyles.button,
  },
});
