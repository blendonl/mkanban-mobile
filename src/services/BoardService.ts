/**
 * BoardService handles business logic for board operations
 * Ported from Python: src/services/board_service.py
 */

import { Board } from "../domain/entities/Board";
import { Column } from "../domain/entities/Column";
import { Task } from "../domain/entities/Task";
import { BoardRepository } from "../domain/repositories/BoardRepository";
import { ValidationService } from "./ValidationService";
import { BoardId, ColumnId, ProjectId } from "../core/types";
import { BoardNotFoundError, ValidationError } from "../core/exceptions";
import { getEventBus } from "../core/EventBus";
import { FileSystemManager } from "../infrastructure/storage/FileSystemManager";
import { ProjectService } from "./ProjectService";
import { logger } from "../utils/logger";

export class BoardService {
  private repository: BoardRepository;
  private validator: ValidationService;
  private getProjectService: () => ProjectService;
  private getFileSystemManager: () => FileSystemManager;

  constructor(
    repository: BoardRepository,
    validator: ValidationService,
    getProjectService: () => ProjectService,
    getFileSystemManager: () => FileSystemManager,
  ) {
    this.repository = repository;
    this.validator = validator;
    this.getProjectService = getProjectService;
    this.getFileSystemManager = getFileSystemManager;
  }

  /**
   * Get boards for a specific project
   */
  async getBoardsByProject(projectId: ProjectId): Promise<Board[]> {
    const projectService = this.getProjectService();
    const fileSystemManager = this.getFileSystemManager();

    const project = await projectService.getProjectById(projectId);
    const projectBoardsDir = fileSystemManager.getProjectBoardsDirectory(
      project.slug,
    );

    return await this.repository.loadBoardsFromDirectory(projectBoardsDir);
  }

  /**
   * Get all boards from all projects
   */
  async getAllBoards(): Promise<Board[]> {
    const projectService = this.getProjectService();
    const fileSystemManager = this.getFileSystemManager();

    const projects = await projectService.getAllProjects();
    const allBoards: Board[] = [];

    for (const project of projects) {
      const projectBoardsDir = fileSystemManager.getProjectBoardsDirectory(
        project.slug,
      );
      const boards = await this.repository.loadBoardsFromDirectory(
        projectBoardsDir,
      );
      allBoards.push(...boards);
    }

    return allBoards;
  }

  /**
   * Get a board by its ID
   * @throws {BoardNotFoundError} if board not found
   */
  async getBoardById(boardId: BoardId): Promise<Board> {
    logger.debug(`[BoardService] Loading board by id: ${boardId}`);
    const board = await this.repository.loadBoardById(boardId);

    if (!board) {
      logger.warn(`[BoardService] Board not found: ${boardId}`);
      throw new BoardNotFoundError(`Board with id '${boardId}' not found`);
    }

    logger.info(
      `[BoardService] Successfully loaded board: ${board.name} ugugaga`,
    );

    await getEventBus().publish("board_loaded", {
      boardId: board.id,
      boardName: board.name,
      timestamp: new Date(),
    });

    return board;
  }

  async getBoardsByIds(boardIds: Set<BoardId>): Promise<Map<BoardId, Board>> {
    const boards = new Map<BoardId, Board>();

    const results = await Promise.all(
      Array.from(boardIds).map(async (boardId) => {
        try {
          const board = await this.repository.loadBoardById(boardId);
          return { boardId, board };
        } catch (error) {
          logger.warn(`[BoardService] Failed to load board ${boardId}:`, error);
          return { boardId, board: null };
        }
      })
    );

    results.forEach(({ boardId, board }) => {
      if (board) {
        boards.set(boardId, board);
      }
    });

    return boards;
  }

  /**
   * Create a new board in a project
   * @throws {ValidationError} if name is invalid or board already exists
   */
  async createBoardInProject(
    projectId: ProjectId,
    name: string,
    description: string = "",
  ): Promise<Board> {
    logger.info(
      `[BoardService] Creating new board: ${name} in project: ${projectId}`,
    );
    this.validator.validateBoardName(name);

    const projectService = this.getProjectService();
    const project = await projectService.getProjectById(projectId);

    const existingBoards = await this.getBoardsByProject(projectId);
    const boardExists = existingBoards.some(
      (b) => b.name.toLowerCase() === name.toLowerCase(),
    );

    if (boardExists) {
      logger.warn(`[BoardService] Board already exists: ${name}`);
      throw new ValidationError(
        `Board with name '${name}' already exists in project`,
      );
    }

    const board = new Board({ name, project_id: projectId, description });

    board.addColumn("To Do", 0);
    board.addColumn("In Progress", 1);
    board.addColumn("Done", 2);

    await this.repository.saveBoard(board, project.slug);
    logger.info(`[BoardService] Successfully created board: ${name}`);

    await getEventBus().publish("board_created", {
      boardId: board.id,
      boardName: board.name,
      timestamp: new Date(),
    });

    return board;
  }

  /**
   * Save a board to storage
   * @throws {ValidationError} if board structure is invalid
   */
  async saveBoard(board: Board): Promise<void> {
    logger.debug(`[BoardService] Saving board: ${board.name}`);
    this.validator.validateBoard(board);

    const projectService = this.getProjectService();
    const project = await projectService.getProjectById(board.project_id);

    await this.repository.saveBoard(board, project.slug);
    logger.info(`[BoardService] Successfully saved board: ${board.name}`);

    await getEventBus().publish("board_updated", {
      boardId: board.id,
      boardName: board.name,
      timestamp: new Date(),
    });
  }

  /**
   * Check if a board can be deleted (not the last board in project)
   */
  async canDeleteBoard(boardId: BoardId): Promise<boolean> {
    const board = await this.getBoardById(boardId);
    const projectBoards = await this.getBoardsByProject(board.project_id);
    return projectBoards.length > 1;
  }

  /**
   * Delete a board from storage
   * @throws {ValidationError} if trying to delete the last board in a project
   * @returns true if board was deleted, false if not found
   */
  async deleteBoard(boardId: BoardId): Promise<boolean> {
    const board = await this.getBoardById(boardId);
    const projectBoards = await this.getBoardsByProject(board.project_id);

    if (projectBoards.length <= 1) {
      throw new ValidationError("Cannot delete the last board in a project");
    }

    const deleted = await this.repository.deleteBoard(boardId);

    if (deleted) {
      await getEventBus().publish("board_deleted", {
        boardId,
        boardName: board.name,
        timestamp: new Date(),
      });
    }

    return deleted;
  }

  /**
   * Add a new column to a board
   * @throws {ValidationError} if column name is invalid or already exists
   */
  async addColumnToBoard(
    board: Board,
    columnName: string,
    position?: number | null,
  ): Promise<Column> {
    logger.info(
      `[BoardService] Adding column '${columnName}' to board '${board.name}'`,
    );
    this.validator.validateColumnName(columnName);

    // Check for duplicate column names (case-insensitive)
    for (const existingColumn of board.columns) {
      if (existingColumn.name.toLowerCase() === columnName.toLowerCase()) {
        logger.warn(`[BoardService] Column already exists: ${columnName}`);
        throw new ValidationError(
          `Column '${columnName}' already exists in board`,
        );
      }
    }

    const column = board.addColumn(columnName, position);
    logger.info(
      `[BoardService] Successfully added column '${columnName}' to board '${board.name}'`,
    );

    // Emit column created event
    await getEventBus().publish("column_created", {
      columnId: column.id,
      columnName: column.name,
      boardId: board.id,
      timestamp: new Date(),
    });

    return column;
  }

  /**
   * Remove a column from a board
   * @throws {ValidationError} if column contains items
   * @returns true if column was removed, false if not found
   */
  async removeColumnFromBoard(
    board: Board,
    columnId: ColumnId,
  ): Promise<boolean> {
    const column = board.getColumnById(columnId);
    if (!column) {
      return false;
    }

    if (column.tasks.length > 0) {
      throw new ValidationError("Cannot delete column that contains items");
    }

    return board.removeColumn(columnId);
  }

  /**
   * Update a task in a board
   */
  async updateTask(boardId: BoardId, updatedTask: Task): Promise<void> {
    const board = await this.getBoardById(boardId);

    // Find the task in the board and replace/update it
    for (const column of board.columns) {
      const taskIndex = column.tasks.findIndex(t => t.id === updatedTask.id);
      if (taskIndex !== -1) {
        column.tasks[taskIndex] = updatedTask;
        await this.saveBoard(board);
        return;
      }
    }

    throw new Error(`Task ${updatedTask.id} not found in board ${boardId}`);
  }
}
