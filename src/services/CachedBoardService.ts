import { Board } from '../domain/entities/Board';
import { BoardService } from './BoardService';
import { BoardId, ProjectId } from '../core/types';
import { getCacheManager } from '../infrastructure/cache/CacheManager';
import { EntityCache } from '../infrastructure/cache/EntityCache';
import { getEventBus, EventSubscription, FileChangeEventPayload } from '../core/EventBus';

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

  async getBoard(boardId: BoardId): Promise<Board | null> {
    const cached = this.cache.get(boardId);
    if (cached) {
      return cached;
    }

    const board = await this.baseService.getBoard(boardId);
    if (board) {
      this.cache.set(boardId, board);
    }
    return board;
  }

  async getBoardsInProject(projectId: ProjectId): Promise<Board[]> {
    const cached = this.listCache.get(projectId);
    if (cached) {
      return cached;
    }

    const boards = await this.baseService.getBoardsInProject(projectId);
    this.listCache.set(projectId, boards);
    return boards;
  }

  async createBoard(name: string, projectId: ProjectId, description?: string): Promise<Board> {
    const board = await this.baseService.createBoard(name, projectId, description);
    this.invalidateCache();
    return board;
  }

  async updateBoard(boardId: BoardId, updates: Partial<Board>): Promise<Board | null> {
    const board = await this.baseService.updateBoard(boardId, updates);
    this.invalidateCache();
    return board;
  }

  async deleteBoard(boardId: BoardId): Promise<boolean> {
    const result = await this.baseService.deleteBoard(boardId);
    this.invalidateCache();
    return result;
  }

  async saveBoard(board: Board): Promise<void> {
    await this.baseService.saveBoard(board);
    this.invalidateCache();
  }

  destroy(): void {
    this.eventSubscriptions.forEach((sub) => sub.unsubscribe());
    this.eventSubscriptions = [];
  }
}
