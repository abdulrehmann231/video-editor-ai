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
  style: 'word_highlight' | 'bold_pop' | 'karaoke';
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

export interface EditProps {
  videoSrc: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  zooms: ZoomOverlay[];
  captions: CaptionOverlay[];
  lowerThirds: LowerThirdOverlay[];
  brolls: BrollOverlay[];
}

export const DEFAULT_EDIT_PROPS: EditProps = {
  videoSrc: '',
  fps: 30,
  width: 1280,
  height: 720,
  durationInFrames: 30,
  zooms: [],
  captions: [],
  lowerThirds: [],
  brolls: [],
};
