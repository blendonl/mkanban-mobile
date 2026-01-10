/**
 * BoardRepository interface for board persistence operations
 * Ported from Python: src/domain/repositories/board_repository.py
 */

import { Board } from "../entities/Board";
import { BoardId, ProjectId } from "../../core/types";

export interface BoardRepository {
  /**
   * Load boards from a specific directory (project boards directory)
   */
  loadBoardsFromDirectory(directory: string): Promise<Board[]>;

  /**
   * Load a board by its ID
   */
  loadBoardById(boardId: BoardId): Promise<Board | null>;

  /**
   * Save a board to storage (requires project slug for path resolution)
   */
  saveBoard(board: Board, projectSlug: string): Promise<void>;

  /**
   * Delete a board from storage
   */
  deleteBoard(boardId: BoardId): Promise<boolean>;

  /**
   * Create a sample board with default columns for a project
   */
  createSampleBoard(name: string, projectId: ProjectId): Promise<Board>;
}
