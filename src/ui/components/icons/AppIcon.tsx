import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import theme from '../../theme/colors';

export type AppIconName =
  | 'calendar'
  | 'task'
  | 'meeting'
  | 'milestone'
  | 'stack'
  | 'epic'
  | 'story'
  | 'bug'
  | 'subtask'
  | 'file'
  | 'note'
  | 'search'
  | 'settings'
  | 'tag'
  | 'list'
  | 'folder'
  | 'folder-open'
  | 'board'
  | 'box'
  | 'device'
  | 'alert'
  | 'close'
  | 'info'
  | 'arrow-left'
  | 'arrow-right'
  | 'clock'
  | 'terminal'
  | 'inbox'
  | 'pin'
  | 'users'
  | 'trash'
  | 'export'
  | 'shuffle'
  | 'edit'
  | 'eye'
  | 'check'
  | 'more';

interface AppIconProps {
  name: AppIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const viewBox = '0 0 24 24';

export default function AppIcon({ name, size = 20, color, strokeWidth = 1.8 }: AppIconProps) {
  const stroke = color || theme.text.primary;
  const common = {
    stroke,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  switch (name) {
    case 'calendar':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Rect x="3" y="5" width="18" height="16" rx="3" {...common} />
          <Path d="M3 9H21" {...common} />
          <Path d="M8 3V7" {...common} />
          <Path d="M16 3V7" {...common} />
        </Svg>
      );
    case 'task':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Rect x="4" y="4" width="16" height="18" rx="3" {...common} />
          <Path d="M8 9H16" {...common} />
          <Path d="M8 13H16" {...common} />
          <Path d="M8 17H13" {...common} />
          <Path d="M7.5 12.5L9 14L11.5 11.5" {...common} />
        </Svg>
      );
    case 'meeting':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Circle cx="8" cy="8" r="3" {...common} />
          <Circle cx="16" cy="8.5" r="2.5" {...common} />
          <Path d="M3 20C3 16.5 5.5 14 9 14C12.5 14 15 16.5 15 20" {...common} />
          <Path d="M14.5 20C14.5 17.6 16.2 16 18.5 16C20.8 16 22 17.3 22 20" {...common} />
        </Svg>
      );
    case 'milestone':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M6 4V20" {...common} />
          <Path d="M6 5H18L16 9L18 13H6" {...common} />
          <Circle cx="6" cy="20" r="1.5" {...common} />
        </Svg>
      );
    case 'stack':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Rect x="4" y="6" width="14" height="12" rx="2.5" {...common} />
          <Rect x="6" y="4" width="14" height="12" rx="2.5" {...common} />
        </Svg>
      );
    case 'epic':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Rect x="4" y="5" width="13" height="13" rx="2.5" {...common} />
          <Rect x="7" y="8" width="13" height="13" rx="2.5" {...common} />
        </Svg>
      );
    case 'story':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M6 4H16C18.2 4 20 5.8 20 8V18C18.6 17 17 16.5 15.5 16.5H6" {...common} />
          <Path d="M6 4C4.3 4 3 5.3 3 7V18C4.4 17 6 16.5 7.5 16.5H18" {...common} />
          <Path d="M8 8H14" {...common} />
          <Path d="M8 11H14" {...common} />
        </Svg>
      );
    case 'bug':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Circle cx="12" cy="10" r="4" {...common} />
          <Path d="M8 14V18" {...common} />
          <Path d="M16 14V18" {...common} />
          <Path d="M5 9H8" {...common} />
          <Path d="M16 9H19" {...common} />
          <Path d="M7 6L9 8" {...common} />
          <Path d="M17 6L15 8" {...common} />
          <Path d="M12 14V20" {...common} />
        </Svg>
      );
    case 'subtask':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Rect x="4" y="4" width="16" height="16" rx="3" {...common} />
          <Path d="M8 12L11 15L16 9" {...common} />
        </Svg>
      );
    case 'file':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M14 3H7C5.3 3 4 4.3 4 6V18C4 19.7 5.3 21 7 21H17C18.7 21 20 19.7 20 18V9L14 3Z" {...common} />
          <Path d="M14 3V9H20" {...common} />
        </Svg>
      );
    case 'note':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M14 3H7C5.3 3 4 4.3 4 6V18C4 19.7 5.3 21 7 21H17C18.7 21 20 19.7 20 18V9L14 3Z" {...common} />
          <Path d="M14 3V9H20" {...common} />
          <Path d="M8 13H16" {...common} />
          <Path d="M8 16H14" {...common} />
        </Svg>
      );
    case 'search':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Circle cx="11" cy="11" r="6.5" {...common} />
          <Path d="M16.5 16.5L21 21" {...common} />
        </Svg>
      );
    case 'settings':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Circle cx="12" cy="12" r="3.5" {...common} />
          <Path d="M12 2.5V5" {...common} />
          <Path d="M12 19V21.5" {...common} />
          <Path d="M4.5 12H2" {...common} />
          <Path d="M22 12H19.5" {...common} />
          <Path d="M5.4 5.4L7.2 7.2" {...common} />
          <Path d="M18.6 18.6L16.8 16.8" {...common} />
          <Path d="M18.6 5.4L16.8 7.2" {...common} />
          <Path d="M5.4 18.6L7.2 16.8" {...common} />
        </Svg>
      );
    case 'tag':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M4 7V4H7L19 16L16 19L4 7Z" {...common} />
          <Circle cx="7.5" cy="7.5" r="1.5" {...common} />
        </Svg>
      );
    case 'list':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M8 6H20" {...common} />
          <Path d="M8 12H20" {...common} />
          <Path d="M8 18H20" {...common} />
          <Circle cx="5" cy="6" r="1" {...common} />
          <Circle cx="5" cy="12" r="1" {...common} />
          <Circle cx="5" cy="18" r="1" {...common} />
        </Svg>
      );
    case 'folder':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M3 7C3 5.9 3.9 5 5 5H10L12 7H19C20.1 7 21 7.9 21 9V18C21 19.1 20.1 20 19 20H5C3.9 20 3 19.1 3 18V7Z" {...common} />
        </Svg>
      );
    case 'folder-open':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M3 8C3 6.9 3.9 6 5 6H10L12 8H19C20.1 8 21 8.9 21 10" {...common} />
          <Path d="M3 10H21L19 20H5L3 10Z" {...common} />
        </Svg>
      );
    case 'board':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Rect x="4" y="5" width="4" height="14" rx="1.5" {...common} />
          <Rect x="10" y="5" width="4" height="14" rx="1.5" {...common} />
          <Rect x="16" y="5" width="4" height="14" rx="1.5" {...common} />
        </Svg>
      );
    case 'box':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M4 7L12 3L20 7L12 11L4 7Z" {...common} />
          <Path d="M4 7V17L12 21L20 17V7" {...common} />
          <Path d="M12 11V21" {...common} />
        </Svg>
      );
    case 'device':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Rect x="7" y="2" width="10" height="20" rx="2.5" {...common} />
          <Circle cx="12" cy="18" r="1" {...common} />
        </Svg>
      );
    case 'alert':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M12 3L22 20H2L12 3Z" {...common} />
          <Path d="M12 9V13" {...common} />
          <Circle cx="12" cy="17" r="1" {...common} />
        </Svg>
      );
    case 'close':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M6 6L18 18" {...common} />
          <Path d="M18 6L6 18" {...common} />
        </Svg>
      );
    case 'info':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Circle cx="12" cy="12" r="9" {...common} />
          <Path d="M12 10V16" {...common} />
          <Circle cx="12" cy="7" r="1" {...common} />
        </Svg>
      );
    case 'arrow-left':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M5 12H19" {...common} />
          <Path d="M9 8L5 12L9 16" {...common} />
        </Svg>
      );
    case 'arrow-right':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M5 12H19" {...common} />
          <Path d="M15 8L19 12L15 16" {...common} />
        </Svg>
      );
    case 'clock':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Circle cx="12" cy="12" r="8" {...common} />
          <Path d="M12 7V12L15.5 14" {...common} />
        </Svg>
      );
    case 'terminal':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Rect x="3" y="5" width="18" height="14" rx="2.5" {...common} />
          <Path d="M7 9L10 12L7 15" {...common} />
          <Path d="M12 15H16" {...common} />
        </Svg>
      );
    case 'inbox':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M4 5H20L22 13V19C22 20.1 21.1 21 20 21H4C2.9 21 2 20.1 2 19V13L4 5Z" {...common} />
          <Path d="M2 13H7L9 16H15L17 13H22" {...common} />
        </Svg>
      );
    case 'pin':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M12 22C12 22 18 16 18 11C18 7.7 15.3 5 12 5C8.7 5 6 7.7 6 11C6 16 12 22 12 22Z" {...common} />
          <Circle cx="12" cy="11" r="2.5" {...common} />
        </Svg>
      );
    case 'users':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Circle cx="8" cy="8" r="3" {...common} />
          <Circle cx="16" cy="9" r="2.5" {...common} />
          <Path d="M3 20C3 16.7 5.7 14 9 14C12.3 14 15 16.7 15 20" {...common} />
          <Path d="M14.5 20C14.5 17.9 16.2 16.5 18.4 16.5C20.6 16.5 22 17.6 22 20" {...common} />
        </Svg>
      );
    case 'trash':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M5 7H19" {...common} />
          <Path d="M10 7V5H14V7" {...common} />
          <Path d="M7 7L8 20H16L17 7" {...common} />
          <Path d="M10 11V17" {...common} />
          <Path d="M14 11V17" {...common} />
        </Svg>
      );
    case 'export':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M12 3V14" {...common} />
          <Path d="M8 7L12 3L16 7" {...common} />
          <Rect x="4" y="14" width="16" height="7" rx="2" {...common} />
        </Svg>
      );
    case 'shuffle':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M3 7H7L17 17H21" {...common} />
          <Path d="M21 7H17L7 17H3" {...common} />
          <Path d="M17 7H21V11" {...common} />
          <Path d="M17 17H21V13" {...common} />
        </Svg>
      );
    case 'edit':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M4 20L5 15L15.5 4.5L19.5 8.5L9 19L4 20Z" {...common} />
          <Path d="M13.5 6.5L17.5 10.5" {...common} />
        </Svg>
      );
    case 'eye':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M2 12C4.5 7 7.7 5 12 5C16.3 5 19.5 7 22 12C19.5 17 16.3 19 12 19C7.7 19 4.5 17 2 12Z" {...common} />
          <Circle cx="12" cy="12" r="3" {...common} />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Path d="M5 12L10 17L19 7" {...common} />
        </Svg>
      );
    case 'more':
      return (
        <Svg width={size} height={size} viewBox={viewBox}>
          <Circle cx="12" cy="5" r="1.5" {...common} />
          <Circle cx="12" cy="12" r="1.5" {...common} />
          <Circle cx="12" cy="19" r="1.5" {...common} />
        </Svg>
      );
    default:
      return null;
  }
}
