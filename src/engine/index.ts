export { createGameEngine, type CivilisEngine } from './core/engine';
export type { GameEvent } from './core/events';
export { validateResearch } from './research/research';
export {
  conditionProgress,
  type ConditionProgress,
  currentMilestone,
  isConditionMetToday,
  progressKey,
  requiredDays,
} from './milestones/milestones';
export { targetHappiness } from './population/population';
export { createNewGame, type NewGameOptions } from './core/newGame';
export { validatePlacement } from './core/commands';
export { COMMAND_FAILURE_REASONS, type CommandFailureReason } from './core/commandReasons';
export { loadGameData, GameDataError, type GameData } from './core/definitions';
export * from './core/constants';
export { getTile, isInBounds, tileIndex, footprint } from './world/grid';
export { getStartCenter } from './world/generateWorld';
export {
  analyzeCity,
  type BuildingProblem,
  type BuildingStatus,
  type CityAnalysis,
} from './economy/analysis';
export { demolishRefund, effectiveDefinition, levelName, maxLevel, nextLevel } from './core/levels';
export {
  upgradableBuildings,
  upgradeRequirements,
  validateUpgrade,
  type UpgradeRequirements,
} from './core/upgrade';
