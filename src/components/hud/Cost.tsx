import { formatAmount, formatCompact } from '@/app/format';
import { resourceLabel } from '@/app/i18n';
import { RESOURCE_IDS, type Resources } from '@/types';
import { ResourceIcon } from '../ResourceIcon';

/** Cena ako ikony surovín s počtom; chýbajúce suroviny červeno. */
export function Cost({
  cost,
  stock,
  limit = RESOURCE_IDS.length,
}: {
  cost: Partial<Resources>;
  stock?: Resources;
  limit?: number;
}) {
  const ids = RESOURCE_IDS.filter((id) => (cost[id] ?? 0) > 0).slice(0, limit);
  return (
    <span className="cost">
      {ids.map((id) => (
        <span
          key={id}
          className={stock && cost[id]! > stock[id] ? 'cost-item missing' : 'cost-item'}
          title={resourceLabel(id)}
        >
          <ResourceIcon kind={id} />
          {cost[id]! >= 10_000 ? formatCompact(cost[id]!) : formatAmount(cost[id]!)}
        </span>
      ))}
    </span>
  );
}
