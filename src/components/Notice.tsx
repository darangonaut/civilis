import { useEffect } from 'react';
import { useUiStore, type Notice as NoticeData } from '@/stores/uiStore';

const NOTICE_DURATION_MS = { info: 2500, warning: 4000, success: 6000 } as const;

export function Notice() {
  const notices = useUiStore((s) => s.notices);
  if (notices.length === 0) return null;
  return (
    <div className="notice-stack">
      {notices.map((notice) => (
        <NoticeItem key={notice.id} notice={notice} />
      ))}
    </div>
  );
}

function NoticeItem({ notice }: { notice: NoticeData }) {
  const dismiss = useUiStore((s) => s.dismissNotice);
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(notice.id), NOTICE_DURATION_MS[notice.kind]);
    return () => window.clearTimeout(timer);
  }, [notice, dismiss]);

  return (
    <div className={`notice ${notice.kind}`} role="status" data-testid="notice">
      {notice.text}
    </div>
  );
}
