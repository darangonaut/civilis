import { loadGameData } from '@/engine/core/definitions';
import balance from '@/data/balance.json';
import buildings from '@/data/buildings.json';
import milestones from '@/data/milestones.json';
import technologies from '@/data/technologies.json';

export const testData = loadGameData({ buildings, technologies, milestones, balance });
