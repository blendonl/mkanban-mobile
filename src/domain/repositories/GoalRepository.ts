import { Goal } from "../entities/Goal";
import { GoalId } from "../../core/types";

export interface GoalRepository {
  loadAllGoals(): Promise<Goal[]>;
  loadGoalById(goalId: GoalId): Promise<Goal | null>;
  saveGoal(goal: Goal): Promise<void>;
  deleteGoal(goalId: GoalId): Promise<boolean>;
}
