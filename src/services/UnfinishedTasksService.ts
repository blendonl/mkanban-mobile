import { AgendaRepository } from '../domain/repositories/AgendaRepository';
import { logger } from '../utils/logger';
import { getEventBus } from '../core/EventBus';

export class UnfinishedTasksService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000;
  private isRunning = false;

  constructor(private agendaRepository: AgendaRepository) {}

  start(): void {
    if (this.isRunning) {
      logger.warn('[UnfinishedTasksService] Already running');
      return;
    }

    this.isRunning = true;
    logger.info('[UnfinishedTasksService] Starting background worker');

    this.checkExpiredBlocks();

    this.intervalId = setInterval(() => {
      this.checkExpiredBlocks();
    }, this.CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('[UnfinishedTasksService] Stopped background worker');
  }

  private async checkExpiredBlocks(): Promise<void> {
    try {
      logger.debug('[UnfinishedTasksService] Checking for expired time blocks');
      const now = new Date();
      const allItems = await this.agendaRepository.loadAllAgendaItems();

      let markedCount = 0;

      for (const item of allItems) {
        if (item.completed_at || item.is_unfinished) {
          continue;
        }

        if (!item.scheduled_time || !item.duration_minutes) {
          continue;
        }

        const scheduledDateTime = new Date(`${item.scheduled_date}T${item.scheduled_time}`);
        const endTime = new Date(scheduledDateTime.getTime() + item.duration_minutes * 60 * 1000);

        if (now > endTime) {
          item.markAsUnfinished();
          await this.agendaRepository.saveAgendaItem(item);
          markedCount++;
          logger.debug(`[UnfinishedTasksService] Marked item ${item.id} as unfinished`);
        }
      }

      if (markedCount > 0) {
        logger.info(`[UnfinishedTasksService] Marked ${markedCount} items as unfinished`);
        const eventBus = getEventBus();
        eventBus.publishSync('agenda_invalidated', {
          timestamp: new Date(),
          source: 'unfinished_tasks_service',
        });
      }
    } catch (error) {
      logger.error('[UnfinishedTasksService] Error checking expired blocks:', error);
    }
  }

  async checkNow(): Promise<void> {
    await this.checkExpiredBlocks();
  }
}
