import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';

const NOTICE_DURATION_MS = 2500;

export function Notice() {
  const notice = useUiStore((s) => s.notice);
  const dismiss = useUiStore((s) => s.dismissNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => dismiss(notice.id), NOTICE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [notice, dismiss]);

  if (!notice) return null;
  return (
    <div className="notice" role="status" data-testid="notice">
      {notice.text}
    </div>
  );
}
