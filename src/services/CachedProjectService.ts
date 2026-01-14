import { Project } from '../domain/entities/Project';
import { ProjectService } from './ProjectService';
import { ProjectId } from '../core/types';
import { getCacheManager } from '../infrastructure/cache/CacheManager';
import { EntityCache } from '../infrastructure/cache/EntityCache';
import { getEventBus, EventSubscription, FileChangeEventPayload } from '../core/EventBus';

export class CachedProjectService {
  private cache: EntityCache<Project>;
  private eventSubscriptions: EventSubscription[] = [];

  constructor(private baseService: ProjectService) {
    this.cache = getCacheManager().getCache('projects');
    this.subscribeToInvalidation();
  }

  private subscribeToInvalidation(): void {
    const eventBus = getEventBus();

    const fileChangedSub = eventBus.subscribe('file_changed', (payload: FileChangeEventPayload) => {
      if (payload.entityType === 'project') {
        this.invalidateCache();
      }
    });

    this.eventSubscriptions.push(fileChangedSub);
  }

  private invalidateCache(): void {
    this.cache.clear();
    getEventBus().publishSync('projects_invalidated', { timestamp: new Date() });
  }

  async getAllProjects(): Promise<Project[]> {
    const cached = this.cache.getList();
    if (cached) {
      return cached;
    }

    const projects = await this.baseService.getAllProjects();
    this.cache.setList(projects);
    return projects;
  }

  async getProjectById(projectId: ProjectId): Promise<Project | null> {
    const cached = this.cache.get(projectId);
    if (cached) {
      return cached;
    }

    const project = await this.baseService.getProjectById(projectId);
    if (project) {
      this.cache.set(projectId, project);
    }
    return project;
  }

  async createProject(name: string, description?: string): Promise<Project> {
    const project = await this.baseService.createProject(name, description);
    this.invalidateCache();
    return project;
  }

  async updateProject(projectId: ProjectId, updates: Partial<Project>): Promise<Project | null> {
    const project = await this.baseService.updateProject(projectId, updates);
    this.invalidateCache();
    return project;
  }

  async deleteProject(projectId: ProjectId): Promise<boolean> {
    const result = await this.baseService.deleteProject(projectId);
    this.invalidateCache();
    return result;
  }



  destroy(): void {
    this.eventSubscriptions.forEach((sub) => sub.unsubscribe());
    this.eventSubscriptions = [];
  }
}
