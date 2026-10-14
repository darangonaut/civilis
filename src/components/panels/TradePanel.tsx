import { formatAmount, formatCompact, formatPrice } from '@/app/format';
import { controller } from '@/app/game';
import { commandReasonLabel, resourceLabel, t } from '@/app/i18n';
import { resourceVisible } from '@/app/eras';
import { useGameState } from '@/app/useGameState';
import { gameData } from '@/data';
import {
  buyPrice,
  currentEraIndex,
  isTradable,
  sellFactor,
  sellPrice,
  tradeAvailable,
  validateTrade,
} from '@/engine';
import { useUiStore } from '@/stores/uiStore';
import { RESOURCE_IDS, type ResourceId } from '@/types';
import { ResourceIcon } from '../ResourceIcon';
import { PanelFrame } from './PanelFrame';

const AMOUNTS = [10, 100] as const;

/** Predaj a nákup surovín, automatický predaj prebytkov. */
export function TradePanel() {
  const available = useGameState((s) => tradeAvailable(s, gameData));
  const factor = useGameState((s) => sellFactor(s, gameData));
  const earned = useGameState((s) => s.trade.earned);
  const autoSell = useGameState((s) => s.trade.autoSell);
  const economy = useGameState((s) => s.city.economy);
  const eraIndex = useGameState((s) => currentEraIndex(s, gameData));
  const showNotice = useUiStore((s) => s.showNotice);
  const { autoSellAbove, autoSellTo } = gameData.balance.trade;

  const resources = RESOURCE_IDS.filter(
    (id) => isTradable(gameData, id) && resourceVisible(id, eraIndex, economy.resources[id]),
  );

  const trade = (resource: ResourceId, amount: number) => {
    const state = controller.state;
    const money =
      amount > 0
        ? amount * buyPrice(gameData, resource)
        : -amount * sellPrice(state, gameData, resource);
    const result = controller.execute({ type: 'TRADE', resource, amount });
    if (!result.success) {
      showNotice(commandReasonLabel(result.reason));
      return;
    }
    const params = {
      amount: Math.abs(amount),
      resource: resourceLabel(resource).toLowerCase(),
      money: formatAmount(money),
    };
    showNotice(t(amount > 0 ? 'trade.bought' : 'trade.sold', params), 'success');
  };
  const can = (resource: ResourceId, amount: number) =>
    amount !== 0 && validateTrade(controller.state, gameData, resource, amount).success;

  return (
    <PanelFrame title={t('trade.title')} testId="trade-panel">
      {!available ? (
        <p className="trade-unavailable" data-testid="trade-unavailable">
          {t('trade.unavailable')}
        </p>
      ) : (
        <>
          <div className="trade-summary">
            <span className="res-chip money">
              <ResourceIcon kind="money" />
              <span className="res-value">{formatCompact(economy.money)}</span>
            </span>
            <span>{t('trade.factor', { percent: Math.round(factor * 100) })}</span>
            <span className="muted">
              {t('trade.earned')}: {formatCompact(earned)}
            </span>
          </div>
          <table className="trade-table">
            <thead>
              <tr>
                <th>{t('trade.resource')}</th>
                <th>{t('trade.stock')}</th>
                <th colSpan={2}>{t('trade.sell')}</th>
                <th colSpan={2}>{t('trade.buy')}</th>
                <th title={t('trade.autoTitle')}>{t('trade.auto')}</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((id) => {
                const stock = Math.floor(economy.resources[id]);
                return (
                  <tr key={id} data-resource={id}>
                    <td>
                      <span className="trade-name">
                        <ResourceIcon kind={id} />
                        {resourceLabel(id)}
                      </span>
                    </td>
                    <td className="num">
                      {formatCompact(stock)}
                      <span className="muted"> / {formatCompact(economy.storageCapacity)}</span>
                    </td>
                    <td className="num trade-price">
                      {formatPrice(sellPrice(controller.state, gameData, id))}
                    </td>
                    <td>
                      <span className="trade-buttons">
                        {AMOUNTS.map((n) => (
                          <button
                            key={n}
                            className="btn small"
                            disabled={!can(id, -n)}
                            onClick={() => trade(id, -n)}
                          >
                            {n}
                          </button>
                        ))}
                        <button
                          className="btn small"
                          disabled={!can(id, -stock)}
                          onClick={() => trade(id, -stock)}
                          data-testid={`sell-all-${id}`}
                        >
                          {t('trade.all')}
                        </button>
                      </span>
                    </td>
                    <td className="num trade-price">{formatPrice(buyPrice(gameData, id))}</td>
                    <td>
                      <span className="trade-buttons">
                        {AMOUNTS.map((n) => (
                          <button
                            key={n}
                            className="btn small"
                            disabled={!can(id, n)}
                            onClick={() => trade(id, n)}
                            data-testid={n === 10 ? `buy-10-${id}` : undefined}
                          >
                            {n}
                          </button>
                        ))}
                      </span>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={autoSell.includes(id)}
                        aria-label={`${t('trade.autoTitle')}: ${resourceLabel(id)}`}
                        onChange={(e) =>
                          controller.execute({
                            type: 'SET_AUTO_SELL',
                            resource: id,
                            enabled: e.target.checked,
                          })
                        }
                        data-testid={`auto-sell-${id}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted hint">
            {t('trade.autoHint', {
              above: Math.round(autoSellAbove * 100),
              to: Math.round(autoSellTo * 100),
            })}{' '}
            {t('trade.bonusHint')}
          </p>
        </>
      )}
    </PanelFrame>
  );
}
