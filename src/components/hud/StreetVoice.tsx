import { useState } from 'react';
import { centerOnTile } from '@/app/camera';
import { controller } from '@/app/game';
import { t } from '@/app/i18n';
import { buildingSize } from '@/app/problems';
import { useCompact } from '@/app/useCompact';
import { useGameState } from '@/app/useGameState';
import { mediumFor, postAuthor, postText, voiceTexts } from '@/app/voice/streetVoice';
import { gameData } from '@/data';
import { currentEraIndex } from '@/engine';
import { useLanguageStore } from '@/stores/languageStore';
import { useUiStore } from '@/stores/uiStore';
import { useVoiceStore, type VoicePost } from '@/stores/voiceStore';

const SKIN = ['#f2c6a0', '#e0a77a', '#c68642', '#8d5524', '#f7d9c4'];
const HAIR = ['#3a2a1e', '#7a4a1e', '#d9b25b', '#b5441f', '#262b44', '#c0cbdc'];
const SHIRT = ['#e43b44', '#0099db', '#63c74d', '#feae34', '#b55088', '#3a4466'];
const avatars = new Map<number, string>();

/** Pixelová tvár 8 × 8 podľa seedu autora (cache). */
function avatar(seed: number): string {
  let url = avatars.get(seed);
  if (url) return url;
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const skin = SKIN[seed % SKIN.length]!;
  const hair = HAIR[(seed >> 2) % HAIR.length]!;
  px(0, 6, 8, 2, SHIRT[(seed >> 4) % SHIRT.length]!);
  px(2, 1, 4, 5, skin);
  px(2, 0, 4, 2, hair);
  if (seed % 2 === 1) {
    // Dlhé vlasy.
    px(1, 1, 1, 5, hair);
    px(6, 1, 1, 5, hair);
  } else if ((seed >> 6) % 2) {
    // Fúzy.
    px(2, 5, 4, 1, hair);
  }
  px(3, 3, 1, 1, '#181425');
  px(5, 3, 1, 1, '#181425');
  url = canvas.toDataURL();
  avatars.set(seed, url);
  return url;
}

/** „Hlas ulice“ — vtipné komentáre obyvateľov; médium sa mení s érou. */
export function StreetVoice() {
  const posts = useVoiceStore((s) => s.posts);
  useLanguageStore((s) => s.language);
  const eraIndex = useGameState((s) => currentEraIndex(s, gameData));
  const compact = useCompact();
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const isCollapsed = collapsed ?? compact;
  const medium = mediumFor(eraIndex);
  const visible = posts.slice(0, isCollapsed ? 1 : 3);
  // Mobil: zbalený Hlas ulice je jeden riadok s posledným príspevkom (prázdny sa neukazuje).
  if (compact && isCollapsed && visible.length === 0) return null;

  return (
    <section
      className={`hud-panel street-voice medium-${medium}${isCollapsed ? ' collapsed' : ''}`}
      data-testid="street-voice"
      onClick={compact && isCollapsed ? () => setCollapsed(false) : undefined}
    >
      <button
        className="voice-head"
        onClick={() => setCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
      >
        <span className="hud-caption">
          <span aria-hidden>{isCollapsed ? '▸' : '▾'}</span> {t('voice.title')}
        </span>
        <span className="voice-medium">{voiceTexts().media[medium]}</span>
      </button>
      {visible.length === 0 ? (
        <p className="muted hint">{t('voice.empty')}</p>
      ) : (
        <ul>
          {visible.map((post) => (
            <VoiceItem key={post.id} post={post} />
          ))}
        </ul>
      )}
    </section>
  );
}

function VoiceItem({ post }: { post: VoicePost }) {
  const selectInstance = useUiStore((s) => s.selectInstance);
  const author = postAuthor(post.authorSeed);
  const network = post.eraIndex >= 6;
  const show = () => {
    const building = post.target
      ? controller.state.city.buildings.find((b) => b.id === post.target)
      : undefined;
    if (!building) return;
    selectInstance(building.id);
    centerOnTile(building.position, buildingSize(building.definitionId));
  };
  const content = (
    <>
      <img className="voice-avatar" src={avatar(post.authorSeed)} alt="" width={24} height={24} />
      <span className="voice-body">
        <span className="voice-author">
          <strong>{network ? author.handle : author.name}</strong>
          {!network && <span className="muted"> · {author.occupation}</span>}
          <span className="muted"> · {t('voice.day', { day: post.day })}</span>
        </span>
        <span className={`voice-text ${post.mood}`}>{postText(post)}</span>
      </span>
    </>
  );
  return (
    <li data-topic={post.topic}>
      {post.target ? (
        <button className="voice-item linked" onClick={show} title={t('voice.show')}>
          {content}
        </button>
      ) : (
        <div className="voice-item">{content}</div>
      )}
    </li>
  );
}
