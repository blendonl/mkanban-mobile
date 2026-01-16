import { Board } from '../domain/entities/Board';
import { BoardService } from './BoardService';
import { BoardId, ProjectId, ColumnId } from '../core/types';
import { getCacheManager } from '../infrastructure/cache/CacheManager';
import { EntityCache } from '../infrastructure/cache/EntityCache';
import { getEventBus, EventSubscription, FileChangeEventPayload } from '../core/EventBus';
import { Column } from '../domain/entities/Column';
import { Task } from '../domain/entities/Task';

export class CachedBoardService {
  private cache: EntityCache<Board>;
  private listCache: Map<ProjectId, Board[]> = new Map();
  private eventSubscriptions: EventSubscription[] = [];

  constructor(private baseService: BoardService) {
    this.cache = getCacheManager().getCache('boards');
    this.subscribeToInvalidation();
  }

  private subscribeToInvalidation(): void {
    const eventBus = getEventBus();

    const fileChangedSub = eventBus.subscribe('file_changed', (payload: FileChangeEventPayload) => {
      if (payload.entityType === 'board') {
        this.invalidateCache();
      }
    });

    this.eventSubscriptions.push(fileChangedSub);
  }

  private invalidateCache(): void {
    this.cache.clear();
    this.listCache.clear();
    getEventBus().publishSync('boards_invalidated', { timestamp: new Date() });
  }

  async getBoardById(boardId: BoardId): Promise<Board> {
    const cached = this.cache.get(boardId);
    if (cached) {
      return cached;
    }

    const board = await this.baseService.getBoardById(boardId);
    if (board) {
      this.cache.set(boardId, board);
    }
    return board;
  }

  async getBoardsByProject(projectId: ProjectId): Promise<Board[]> {
    const cached = this.listCache.get(projectId);
    if (cached) {
      return cached;
    }

    const boards = await this.baseService.getBoardsByProject(projectId);
    this.listCache.set(projectId, boards);
    return boards;
  }

  async getAllBoards(): Promise<Board[]> {
    // We don't cache all boards list for now as it's rarely used
    // or we could cache it with a special key if needed
    return await this.baseService.getAllBoards();
  }

  async createBoardInProject(projectId: ProjectId, name: string, description?: string): Promise<Board> {
    const board = await this.baseService.createBoardInProject(projectId, name, description);
    this.listCache.delete(projectId);
    return board;
  }

  async saveBoard(board: Board): Promise<void> {
    await this.baseService.saveBoard(board);
    this.cache.invalidate(board.id);
    this.listCache.delete(board.project_id);
  }

  async canDeleteBoard(boardId: BoardId): Promise<boolean> {
    return await this.baseService.canDeleteBoard(boardId);
  }

  async deleteBoard(boardId: BoardId): Promise<boolean> {
    const board = await this.baseService.getBoardById(boardId);
    const result = await this.baseService.deleteBoard(boardId);
    this.cache.invalidate(boardId);
    if (board) {
      this.listCache.delete(board.project_id);
    }
    return result;
  }

  async addColumnToBoard(board: Board, columnName: string, position?: number | null): Promise<Column> {
    const column = await this.baseService.addColumnToBoard(board, columnName, position);
    this.cache.invalidate(board.id);
    this.listCache.delete(board.project_id);
    return column;
  }

  async removeColumnFromBoard(board: Board, columnId: ColumnId): Promise<boolean> {
    const result = await this.baseService.removeColumnFromBoard(board, columnId);
    this.cache.invalidate(board.id);
    this.listCache.delete(board.project_id);
    return result;
  }

  async getBoardsByIds(boardIds: Set<BoardId>): Promise<Map<BoardId, Board>> {
    const boards = new Map<BoardId, Board>();
    const uncachedIds = new Set<BoardId>();

    for (const boardId of boardIds) {
      const cached = this.cache.get(boardId);
      if (cached) {
        boards.set(boardId, cached);
      } else {
        uncachedIds.add(boardId);
      }
    }

    if (uncachedIds.size > 0) {
      const fetchedBoards = await this.baseService.getBoardsByIds(uncachedIds);
      for (const [boardId, board] of fetchedBoards) {
        this.cache.set(boardId, board);
        boards.set(boardId, board);
      }
    }

    return boards;
  }

  async updateTask(boardId: BoardId, updatedTask: Task): Promise<void> {
    await this.baseService.updateTask(boardId, updatedTask);
    this.cache.invalidate(boardId);
    const board = await this.baseService.getBoardById(boardId);
    if (board) {
      this.listCache.delete(board.project_id);
    }
  }

  destroy(): void {
    this.eventSubscriptions.forEach((sub) => sub.unsubscribe());
    this.eventSubscriptions = [];
  }
}
