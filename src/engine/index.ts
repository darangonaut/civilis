export { createGameEngine } from './core/engine';
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
