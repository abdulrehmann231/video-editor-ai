import { Easing } from 'remotion';
import type { Easing as IrEasing } from '../../../lib/motion/ir/types';

/** Map an IR easing descriptor to a Remotion easing function (t in [0,1] -> [0,1]). */
export function toRemotionEasing(e?: IrEasing): (t: number) => number {
  switch (e?.type) {
    case 'linear':
      return Easing.linear;
    case 'easeIn':
      return Easing.in(Easing.ease);
    case 'easeOut':
      return Easing.out(Easing.ease);
    case 'easeInOut':
      return Easing.inOut(Easing.ease);
    case 'bezier':
      return Easing.bezier(e.x1, e.y1, e.x2, e.y2);
    case 'back':
      return Easing.back(e.amount);
    case 'elastic':
      return Easing.elastic(e.amplitude);
    default:
      return Easing.linear;
  }
}
