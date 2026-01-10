import { AgendaItem } from "../entities/AgendaItem";
import { ProjectId, BoardId, TaskId } from "../../core/types";

export interface AgendaRepository {
  loadAgendaItemsForDate(date: string): Promise<AgendaItem[]>;

  loadAgendaItemsForDateRange(startDate: string, endDate: string): Promise<AgendaItem[]>;

  loadAgendaItemByTask(projectId: ProjectId, boardId: BoardId, taskId: TaskId): Promise<AgendaItem | null>;

  loadAgendaItemById(agendaItemId: string): Promise<AgendaItem | null>;

  loadAllAgendaItems(): Promise<AgendaItem[]>;

  saveAgendaItem(item: AgendaItem): Promise<void>;

  deleteAgendaItem(item: AgendaItem): Promise<boolean>;

  getOrphanedAgendaItems(): Promise<AgendaItem[]>;
}
