import { useEffect, useRef, useState } from 'react';
import { t } from '@/app/i18n';
import {
  deleteSlot,
  exportCurrentGame,
  importGameFile,
  loadFromSlot,
  saveToSlot,
  slotLabel,
} from '@/app/saving';
import { saveService } from '@/app/game';
import { AUTOSAVE_SLOT_ID, MANUAL_SLOT_IDS, type SlotId } from '@/persistence/db';
import type { SlotInfo } from '@/persistence/saveService';
import { useUiStore } from '@/stores/uiStore';
import { PanelFrame } from './PanelFrame';

const dateFormat = new Intl.DateTimeFormat('sk-SK', { dateStyle: 'short', timeStyle: 'short' });

export function SavesPanel() {
  const revision = useUiStore((s) => s.savesRevision);
  const [slots, setSlots] = useState<Map<SlotId, SlotInfo> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void saveService.list().then((list) => {
      if (!cancelled) setSlots(new Map(list.map((slot) => [slot.id, slot])));
    });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const onImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file && window.confirm(t('save.confirmLoad'))) void importGameFile(file);
  };

  return (
    <PanelFrame title={t('save.title')} testId="saves-panel">
      <ul className="slot-list">
        {MANUAL_SLOT_IDS.map((id) => (
          <SlotRow key={id} id={id} info={slots?.get(id)} />
        ))}
        <SlotRow id={AUTOSAVE_SLOT_ID} info={slots?.get(AUTOSAVE_SLOT_ID)} />
      </ul>
      <div className="save-actions">
        <button onClick={exportCurrentGame} data-testid="export">
          {t('save.export')}
        </button>
        <button onClick={() => fileInput.current?.click()}>{t('save.import')}</button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={onImport}
          data-testid="import-input"
        />
      </div>
      <p className="muted hint">{t('save.autosaveInfo')}</p>
    </PanelFrame>
  );
}

function SlotRow({ id, info }: { id: SlotId; info: SlotInfo | undefined }) {
  const manual = id !== AUTOSAVE_SLOT_ID;

  const save = () => {
    if (!info || window.confirm(t('save.confirmOverwrite'))) void saveToSlot(id);
  };
  const load = () => {
    if (window.confirm(t('save.confirmLoad'))) void loadFromSlot(id);
  };
  const remove = () => {
    if (window.confirm(t('save.confirmDelete'))) void deleteSlot(id);
  };

  return (
    <li className="slot" data-slot-id={id}>
      <div className="slot-info">
        <strong>{slotLabel(id)}</strong>
        {info ? (
          <span className="muted">
            {dateFormat.format(new Date(info.savedAt))} ·{' '}
            {t('save.meta', { day: info.day, population: info.population })}
          </span>
        ) : (
          <span className="muted">{t('save.empty')}</span>
        )}
      </div>
      <div className="slot-buttons">
        {manual && (
          <button onClick={save} data-testid="slot-save">
            {t('save.save')}
          </button>
        )}
        <button onClick={load} disabled={!info} data-testid="slot-load">
          {t('save.load')}
        </button>
        {manual && (
          <button onClick={remove} disabled={!info} className="danger">
            {t('save.delete')}
          </button>
        )}
      </div>
    </li>
  );
}
