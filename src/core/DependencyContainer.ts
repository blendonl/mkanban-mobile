/**
 * Dependency Injection Container for mobile app
 * Simplified from Python: src/core/dependency_container.py
 * MVP version: No logger, config manager, or daemon services
 */

import { FileSystemManager } from "../infrastructure/storage/FileSystemManager";
import { MarkdownBoardRepository } from "../infrastructure/storage/MarkdownBoardRepository";
import { MarkdownStorageRepository } from "../infrastructure/storage/MarkdownStorageRepository";
import { MarkdownProjectRepository } from "../infrastructure/storage/MarkdownProjectRepository";
import { MarkdownParser } from "../infrastructure/storage/MarkdownParser";
import { TaskStorageMigration } from "../infrastructure/storage/TaskStorageMigration";
import { ValidationService } from "../services/ValidationService";
import { BoardService } from "../services/BoardService";
import { TaskService } from "../services/TaskService";
import { ProjectService } from "../services/ProjectService";
import { AgendaService } from "../services/AgendaService";
import { NoteService } from "../services/NoteService";
import { CachedNoteService } from "../services/CachedNoteService";
import { CachedAgendaService } from "../services/CachedAgendaService";
import { CachedBoardService } from "../services/CachedBoardService";
import { CachedProjectService } from "../services/CachedProjectService";
import { MarkdownNoteRepository } from "../infrastructure/storage/MarkdownNoteRepository";
import { MarkdownAgendaRepository } from "../infrastructure/storage/MarkdownAgendaRepository";
import { MarkdownGoalRepository } from "../infrastructure/storage/MarkdownGoalRepository";
import { TimeTrackingService } from "../services/TimeTrackingService";
import { YamlTimeLogRepository } from "../infrastructure/storage/YamlTimeLogRepository";
import { StorageConfig } from "./StorageConfig";
import { ActionsConfig, getActionsConfig } from "./ActionsConfig";
import { YamlActionRepository } from "../infrastructure/repositories/YamlActionRepository";
import { ActionService } from "../services/ActionService";
import { NotificationService } from "../services/NotificationService";
import { ActionEngine } from "../services/ActionEngine";
import { MissedActionsManager } from "../services/MissedActionsManager";
import { GoogleCalendarRepository } from "../infrastructure/calendar/GoogleCalendarRepository";
import { CalendarSyncService } from "../services/CalendarSyncService";
import { GoalService } from "../services/GoalService";
import { registerBackgroundFileWatcherTask } from "../infrastructure/daemon/BackgroundFileWatcherTask";
import { DaemonRunner } from "../infrastructure/daemon/DaemonRunner";
import { FileChangeDetector } from "../infrastructure/daemon/FileChangeDetector";
import { FileChangeMapper } from "../infrastructure/daemon/FileChangeMapper";
import { AdaptivePollingStrategy, FixedPollingStrategy } from "../infrastructure/daemon/strategies";
import { FileWatcherTask, ActionPollerTask, OrphanCleanerTask, EventListenerTask } from "../infrastructure/daemon/tasks";

type Factory<T> = () => T;

/**
 * Dependency Injection Container
 * Manages service lifecycle with singleton pattern and lazy instantiation
 */
export class DependencyContainer {
  private instances: Map<any, any>;
  private factories: Map<any, Factory<any>>;

  constructor() {
    this.instances = new Map();
    this.factories = new Map();
    this._setupDefaultFactories();
  }

  /**
   * Set up default factories for all services
   */
  private _setupDefaultFactories(): void {
    // File system manager (foundation) - created first without StorageConfig
    this.factories.set(FileSystemManager, () => {
      return new FileSystemManager();
    });

    // Storage config with FileSystemManager dependency
    this.factories.set(StorageConfig, () => {
      const fsManager = this.get<FileSystemManager>(FileSystemManager);
      return new StorageConfig(undefined, fsManager);
    });

    // Repository factories with FileSystemManager dependency
    this.factories.set(
      MarkdownBoardRepository,
      () => new MarkdownBoardRepository(this.get(FileSystemManager)),
    );
    this.factories.set(
      MarkdownStorageRepository,
      () => new MarkdownStorageRepository(this.get(FileSystemManager)),
    );

    // Service factories with dependencies
    this.factories.set(ValidationService, () => new ValidationService());

    this.factories.set(
      BoardService,
      () => {
        const baseService = new BoardService(
          this.get(MarkdownBoardRepository),
          this.get(ValidationService),
          () => this.get(ProjectService),
          () => this.get(FileSystemManager),
        );
        return new CachedBoardService(baseService);
      },
    );

    this.factories.set(
      TaskService,
      () =>
        new TaskService(
          this.get(MarkdownStorageRepository),
          this.get(ValidationService),
        ),
    );

    // Project Repository with FileSystemManager dependency
    this.factories.set(
      MarkdownProjectRepository,
      () => new MarkdownProjectRepository(this.get(FileSystemManager)),
    );

    // Project Service
    this.factories.set(
      ProjectService,
      () => {
        const baseService = new ProjectService(
          this.get(MarkdownProjectRepository),
          this.get(ValidationService),
          () => this.get(BoardService),
        );
        return new CachedProjectService(baseService);
      },
    );

    // Agenda Repository
    this.factories.set(
      MarkdownAgendaRepository,
      () => new MarkdownAgendaRepository(this.get(FileSystemManager)),
    );

    // Agenda Service
    this.factories.set(
      AgendaService,
      () => {
        const baseService = new AgendaService(
          this.get(BoardService),
          this.get(ProjectService),
          this.get(TaskService),
          this.get(MarkdownAgendaRepository),
          this.get(NotificationService),
        );
        return new CachedAgendaService(baseService);
      },
    );

    // Goal Repository
    this.factories.set(
      MarkdownGoalRepository,
      () => new MarkdownGoalRepository(this.get(FileSystemManager)),
    );

    // Goal Service
    this.factories.set(
      GoalService,
      () => new GoalService(
        this.get(MarkdownGoalRepository),
        this.get(BoardService),
        this.get(MarkdownAgendaRepository),
      ),
    );

    // Note Repository
    this.factories.set(
      MarkdownNoteRepository,
      () => new MarkdownNoteRepository(this.get(FileSystemManager)),
    );

    // Note Service
    this.factories.set(
      NoteService,
      () => {
        const baseService = new NoteService(
          this.get(MarkdownNoteRepository),
          this.get(ValidationService),
        );
        return new CachedNoteService(baseService);
      },
    );

    // Time Log Repository
    this.factories.set(
      YamlTimeLogRepository,
      () => new YamlTimeLogRepository(this.get(FileSystemManager)),
    );

    // Time Tracking Service
    this.factories.set(
      TimeTrackingService,
      () => new TimeTrackingService(this.get(YamlTimeLogRepository)),
    );

    // Daemon Runner with all tasks
    this.factories.set(DaemonRunner, () => {
      const runner = new DaemonRunner();

      const fsManager = this.get<FileSystemManager>(FileSystemManager);
      const actionsConfig = this.get<ActionsConfig>(ActionsConfig);

      const fileWatcherTask = new FileWatcherTask(
        fsManager,
        new FileChangeDetector(),
        new AdaptivePollingStrategy(),
        new FileChangeMapper(fsManager),
      );
      runner.registerTask(fileWatcherTask);

      const actionPollerTask = new ActionPollerTask(
        this.get(ActionEngine),
        actionsConfig,
        new FixedPollingStrategy(actionsConfig.getPollingInterval() * 1000),
      );
      runner.registerTask(actionPollerTask);

      const orphanCleanerTask = new OrphanCleanerTask(
        this.get(ActionService),
        actionsConfig,
        new FixedPollingStrategy(actionsConfig.getConfig().orphanCheckInterval * 1000),
      );
      runner.registerTask(orphanCleanerTask);

      const eventListenerTask = new EventListenerTask(
        this.get(ActionEngine),
        actionsConfig,
      );
      runner.registerTask(eventListenerTask);

      return runner;
    });

    // Actions Config (singleton)
    this.factories.set(ActionsConfig, () => getActionsConfig());

    // Action Repository with FileSystemManager dependency
    this.factories.set(YamlActionRepository, () => {
      const repo = new YamlActionRepository(this.get(FileSystemManager));
      // Initialize asynchronously
      repo.initialize().catch((error) => {
        console.error("Failed to initialize ActionRepository:", error);
      });
      return repo;
    });

    // Action Service
    this.factories.set(
      ActionService,
      () =>
        new ActionService(
          this.get(YamlActionRepository),
          this.get(MarkdownBoardRepository),
          this.get(ActionsConfig),
        ),
    );

    // Notification Service
    this.factories.set(NotificationService, () => {
      const service = new NotificationService(this.get(ActionsConfig));
      // Initialize asynchronously
      service.initialize().catch((error) => {
        console.error("Failed to initialize NotificationService:", error);
      });
      return service;
    });

    // Action Engine
    this.factories.set(
      ActionEngine,
      () =>
        new ActionEngine(
          this.get(ActionService),
          this.get(TaskService),
          this.get(BoardService),
          this.get(NotificationService),
        ),
    );

    // Missed Actions Manager
    this.factories.set(
      MissedActionsManager,
      () =>
        new MissedActionsManager(
          this.get(ActionService),
          this.get(ActionsConfig),
        ),
    );


    // Google Calendar Repository
    this.factories.set(
      GoogleCalendarRepository,
      () => new GoogleCalendarRepository(),
    );

    // Calendar Sync Service
    this.factories.set(
      CalendarSyncService,
      () =>
        new CalendarSyncService(
          this.get(GoogleCalendarRepository),
          this.get(MarkdownBoardRepository),
        ),
    );
  }

  /**
   * Register a custom factory for a service type
   */
  registerFactory<T>(serviceType: any, factory: Factory<T>): void {
    this.factories.set(serviceType, factory);
  }

  /**
   * Register a singleton instance for a service type
   */
  registerInstance<T>(serviceType: any, instance: T): void {
    this.instances.set(serviceType, instance);
  }

  /**
   * Get an instance of the requested service type
   * Uses singleton pattern - creates instance once and reuses it
   */
  get<T>(serviceType: any): T {
    // Return existing instance if already created
    if (this.instances.has(serviceType)) {
      return this.instances.get(serviceType);
    }

    // Create instance using factory
    if (this.factories.has(serviceType)) {
      const factory = this.factories.get(serviceType);
      if (!factory) {
        throw new Error(
          `Factory is undefined for ${serviceType.name || serviceType}`,
        );
      }
      const instance = factory();
      this.instances.set(serviceType, instance);
      return instance;
    }

    throw new Error(
      `No factory registered for ${serviceType.name || serviceType}`,
    );
  }

  /**
   * Clear all singleton instances (useful for testing)
   */
  clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Set up container for testing with mock dependencies
   */
  setupForTesting(): void {
    this.clearInstances();
    // Test-specific setup can be added here
  }
}

// Global container instance
let _container: DependencyContainer | null = null;
let _initialized: boolean = false;

/**
 * Get the global dependency container
 */
export function getContainer(): DependencyContainer {
  if (_container === null) {
    _container = new DependencyContainer();
  }
  return _container;
}

export type InitializationProgressCallback = (step: string) => void;

let _progressCallback: InitializationProgressCallback | null = null;

export function setInitializationProgressCallback(callback: InitializationProgressCallback | null): void {
  _progressCallback = callback;
}

async function initializeContainerInternal(): Promise<void> {
  _progressCallback?.('Starting initialization...');
  console.log('[DependencyContainer] Starting initialization...');
  const container = getContainer();

  _progressCallback?.('Initializing file system...');
  console.log('[DependencyContainer] Initializing FileSystemManager...');
  const fsManager = container.get<FileSystemManager>(FileSystemManager);
  await fsManager.initialize();
  console.log('[DependencyContainer] FileSystemManager initialized');

  _progressCallback?.('Loading storage configuration...');
  console.log('[DependencyContainer] Loading storage config...');
  const storageConfig = container.get<StorageConfig>(StorageConfig);
  const boardsDir = await storageConfig.getBoardsDirectory();
  const defaultDir = storageConfig.getDefaultBoardsDirectory();

  if (boardsDir !== defaultDir) {
    console.log("Custom boards directory loaded:", boardsDir);
  }
  console.log('[DependencyContainer] Storage config loaded');

  _progressCallback?.('Loading actions configuration...');
  console.log('[DependencyContainer] Loading actions config...');
  const actionsConfig = container.get<ActionsConfig>(ActionsConfig);
  await actionsConfig.initialize();
  console.log('[DependencyContainer] Actions config loaded');

  _progressCallback?.('Starting daemon runner...');
  console.log('[DependencyContainer] Starting DaemonRunner...');
  const daemonRunner = container.get<DaemonRunner>(DaemonRunner);
  try {
    await daemonRunner.start();
    console.log('[DependencyContainer] DaemonRunner started');
  } catch (error) {
    console.error('[DependencyContainer] DaemonRunner failed to start:', error);
  }

  _progressCallback?.('Registering background tasks...');
  console.log('[DependencyContainer] Registering background task...');
  const fileWatcherTask = daemonRunner.getTask<FileWatcherTask>('FileWatcher');
  registerBackgroundFileWatcherTask(async () => {
    if (fileWatcherTask) {
      await fileWatcherTask.forceCheck();
    }
  })
    .then(() => {
      console.log('[DependencyContainer] Background task registered successfully');
    })
    .catch(error => {
      console.error('[DependencyContainer] Background task registration failed:', error);
    });

  _initialized = true;
  _progressCallback?.('Initialization complete');
  console.log('[DependencyContainer] Initialization complete');
}

/**
 * Initialize the global container asynchronously with timeout protection
 * This should be called during app startup before rendering
 */
export async function initializeContainer(): Promise<void> {
  if (_initialized) {
    console.log('[DependencyContainer] Already initialized');
    return;
  }

  const TIMEOUT_MS = 30000;
  let timeoutId: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Initialization timed out after 30 seconds'));
    }, TIMEOUT_MS);
  });

  try {
    await Promise.race([
      initializeContainerInternal(),
      timeoutPromise,
    ]);
    if (timeoutId) clearTimeout(timeoutId);
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    _initialized = false;
    console.error('[DependencyContainer] Initialization failed:', error);
    throw error;
  }
}

/**
 * Check if the container has been initialized
 */
export function isContainerInitialized(): boolean {
  return _initialized;
}

/**
 * Set the global dependency container (useful for testing)
 */
export function setContainer(container: DependencyContainer): void {
  _container = container;
}

/**
 * Reset the global container (useful for testing)
 */
export function resetContainer(): void {
  _container = null;
  _initialized = false;
}

// Convenience functions for getting services
// These provide backward compatibility and simpler API

/**
 * Get the validation service
 */
export function getValidationService(): ValidationService {
  return getContainer().get(ValidationService);
}

/**
 * Get the board service
 */
export function getBoardService(): BoardService {
  return getContainer().get(BoardService);
}

/**
 * Get the task service
 */
export function getTaskService(): TaskService {
  return getContainer().get(TaskService);
}

/**
 * Get the board repository
 */
export function getBoardRepository(): MarkdownBoardRepository {
  return getContainer().get(MarkdownBoardRepository);
}

/**
 * Get the storage repository
 */
export function getStorageRepository(): MarkdownStorageRepository {
  return getContainer().get(MarkdownStorageRepository);
}

/**
 * Get the daemon runner
 */
export function getDaemonRunner(): DaemonRunner {
  return getContainer().get(DaemonRunner);
}

/**
 * Get the storage config
 */
export function getStorageConfig(): StorageConfig {
  return getContainer().get(StorageConfig);
}

/**
 * Get the file system manager
 */
export function getFileSystemManager(): FileSystemManager {
  return getContainer().get(FileSystemManager);
}

/**
 * Get the actions config
 */
export function getActionsConfigFromContainer(): ActionsConfig {
  return getContainer().get(ActionsConfig);
}

/**
 * Get the action repository
 */
export function getActionRepository(): YamlActionRepository {
  return getContainer().get(YamlActionRepository);
}

/**
 * Get the action service
 */
export function getActionService(): ActionService {
  return getContainer().get(ActionService);
}

/**
 * Get the notification service
 */
export function getNotificationService(): NotificationService {
  return getContainer().get(NotificationService);
}

/**
 * Get the action engine
 */
export function getActionEngine(): ActionEngine {
  return getContainer().get(ActionEngine);
}

/**
 * Get the missed actions manager
 */
export function getMissedActionsManager(): MissedActionsManager {
  return getContainer().get(MissedActionsManager);
}

/**
 * Get the project repository
 */
export function getProjectRepository(): MarkdownProjectRepository {
  return getContainer().get(MarkdownProjectRepository);
}

/**
 * Get the project service
 */
export function getProjectService(): ProjectService {
  return getContainer().get(ProjectService);
}

/**
 * Get the agenda repository
 */
export function getAgendaRepository(): MarkdownAgendaRepository {
  return getContainer().get(MarkdownAgendaRepository);
}

/**
 * Get the agenda service
 */
export function getAgendaService(): AgendaService {
  return getContainer().get(AgendaService);
}

/**
 * Get the goal repository
 */
export function getGoalRepository(): MarkdownGoalRepository {
  return getContainer().get(MarkdownGoalRepository);
}

/**
 * Get the goal service
 */
export function getGoalService(): GoalService {
  return getContainer().get(GoalService);
}

/**
 * Get the note repository
 */
export function getNoteRepository(): MarkdownNoteRepository {
  return getContainer().get(MarkdownNoteRepository);
}

/**
 * Get the note service
 */
export function getNoteService(): NoteService {
  return getContainer().get(NoteService);
}

/**
 * Get the time log repository
 */
export function getTimeLogRepository(): YamlTimeLogRepository {
  return getContainer().get(YamlTimeLogRepository);
}

/**
 * Get the time tracking service
 */
export function getTimeTrackingService(): TimeTrackingService {
  return getContainer().get(TimeTrackingService);
}

/**
 * Get the Google calendar repository
 */
export function getCalendarRepository(): GoogleCalendarRepository {
  return getContainer().get(GoogleCalendarRepository);
}

/**
 * Get the calendar sync service
 */
export function getCalendarSyncService(): CalendarSyncService {
  return getContainer().get(CalendarSyncService);
}
