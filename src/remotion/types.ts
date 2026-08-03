/**
 * Standalone prop types for the Remotion bundle. Deliberately NOT imported from
 * src/lib/* so the browser bundle never pulls in Node-only modules (ffmpeg,
 * transformers, aws-sdk). The Node render orchestrator builds these as plain
 * JSON and they match structurally.
 */

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
}
export interface ZoomOverlay {
  id: string;
  start: number;
  end: number;
  scale: number;
  focus: 'center' | 'face' | 'left' | 'right' | 'top';
}
export interface CaptionOverlay {
  id: string;
  start: number;
  end: number;
  style: 'word_highlight' | 'bold_pop' | 'karaoke' | 'typewriter';
  words: CaptionWord[];
}
export interface LowerThirdOverlay {
  id: string;
  start: number;
  end: number;
  title: string;
  subtitle?: string;
}
export interface BrollOverlay {
  id: string;
  start: number;
  end: number;
  layout: 'full' | 'pip';
  query: string;
  src?: string;
}
export interface TitleCardOverlay {
  id: string;
  start: number;
  end: number;
  variant: 'intro' | 'cta';
  heading: string;
  sub?: string;
}
export interface StatCalloutOverlay {
  id: string;
  start: number;
  end: number;
  value: string;
  label?: string;
  position: 'center' | 'corner';
}
export interface TransitionOverlay {
  id: string;
  start: number;
  end: number;
  variant: 'glitch' | 'flash' | 'zoom_blur';
}

export type OutputLayout = 'landscape' | 'shorts';

export interface EditProps {
  videoSrc: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  /** 'shorts' fits a landscape source into a 9:16 frame (cover-crop, centered). */
  layout: OutputLayout;
  progressBar: boolean;
  zooms: ZoomOverlay[];
  captions: CaptionOverlay[];
  lowerThirds: LowerThirdOverlay[];
  brolls: BrollOverlay[];
  titleCards: TitleCardOverlay[];
  statCallouts: StatCalloutOverlay[];
  transitions: TransitionOverlay[];
}

export const DEFAULT_EDIT_PROPS: EditProps = {
  // Only used by the Remotion Studio preview / default props; real renders always
  // pass a real cut URL. Empty here renders a placeholder (see ZoomLayer).
  videoSrc: '',
  fps: 30,
  width: 1280,
  height: 720,
  durationInFrames: 30,
  layout: 'landscape',
  progressBar: true,
  zooms: [],
  captions: [],
  lowerThirds: [],
  brolls: [],
  titleCards: [],
  statCallouts: [],
  transitions: [],
};
