import { Board } from '../domain/entities/Board';
import { BoardService } from './BoardService';
import { BoardId, ProjectId, ColumnId } from '../core/types';
import { getCacheManager } from '../infrastructure/cache/CacheManager';
import { EntityCache } from '../infrastructure/cache/EntityCache';
import { getEventBus, EventSubscription, FileChangeEventPayload } from '../core/EventBus';
import { Column } from '../domain/entities/Column';

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
    this.invalidateCache();
    return board;
  }

  async saveBoard(board: Board): Promise<void> {
    await this.baseService.saveBoard(board);
    this.invalidateCache();
  }

  async canDeleteBoard(boardId: BoardId): Promise<boolean> {
    return await this.baseService.canDeleteBoard(boardId);
  }

  async deleteBoard(boardId: BoardId): Promise<boolean> {
    const result = await this.baseService.deleteBoard(boardId);
    this.invalidateCache();
    return result;
  }

  async addColumnToBoard(board: Board, columnName: string, position?: number | null): Promise<Column> {
    const column = await this.baseService.addColumnToBoard(board, columnName, position);
    this.invalidateCache();
    return column;
  }

  async removeColumnFromBoard(board: Board, columnId: ColumnId): Promise<boolean> {
    const result = await this.baseService.removeColumnFromBoard(board, columnId);
    this.invalidateCache();
    return result;
  }

  destroy(): void {
    this.eventSubscriptions.forEach((sub) => sub.unsubscribe());
    this.eventSubscriptions = [];
  }
}
