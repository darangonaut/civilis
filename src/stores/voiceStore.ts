import { create } from 'zustand';

/** Príspevok „Hlasu ulice“. Text sa skladá až pri zobrazení (kvôli jazyku). */
export interface VoicePost {
  id: number;
  day: number;
  eraIndex: number;
  topic: string;
  variant: number;
  authorSeed: number;
  mood: 'angry' | 'happy' | 'neutral';
  params: {
    buildingId?: string;
    level?: number;
    resource?: string;
    techId?: string;
    milestoneId?: string;
    eraId?: string;
  };
  /** Budova, na ktorú klik presunie kameru. */
  target?: string;
}

const MAX_POSTS = 30;
let seq = 0;

export const useVoiceStore = create<{
  posts: VoicePost[];
  add: (post: Omit<VoicePost, 'id'>) => void;
  clear: () => void;
}>()((set) => ({
  posts: [],
  add: (post) => set((s) => ({ posts: [{ ...post, id: ++seq }, ...s.posts].slice(0, MAX_POSTS) })),
  clear: () => set({ posts: [] }),
}));
