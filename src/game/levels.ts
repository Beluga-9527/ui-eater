import type { LevelConfig } from './types';

export const WIDTH = 1100;
export const HEIGHT = 620;
export const MONSTER_RADIUS = 23;
export const BAIT_WIDTH = 108;
export const BAIT_HEIGHT = 42;
export const TRAP = { x: 865, y: 385, w: 188, h: 154 };

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: '贪吃的按钮',
    subtitle: 'THE FIRST BITE',
    description: '你的桌面里，似乎住进了一位不速之客。',
    objectives: ['拖动黄色诱饵，吸引怪物', '把它引入右下方的捕获区域', '怪物进入后，关闭笼门'],
    hint: '把诱饵拖进笼子。怪物跟进去后，按空格或点击「关闭笼门」。',
    speed: 82,
    spawn: { x: 292, y: 340 },
    windows: [
      { id: 'welcome', title: 'welcome.exe', x: 380, y: 100, w: 330, h: 230, kind: 'welcome', movable: false },
    ],
    objects: [
      { id: 'start', windowId: 'welcome', label: '开始工作', x: 406, y: 208, w: 134, h: 42, kind: 'button', eaten: false },
      { id: 'settings', windowId: 'welcome', label: '偏好设置', x: 550, y: 208, w: 134, h: 42, kind: 'button', eaten: false },
      { id: 'close', windowId: 'welcome', label: '关闭窗口', x: 406, y: 262, w: 278, h: 38, kind: 'button', eaten: false },
    ],
  },
  {
    id: 2,
    name: '消失的控制台',
    subtitle: 'HANDLE WITH CARE',
    description: '窗口可以移动，控制台里的捕获电源却只有一个。',
    objectives: ['移动窗口，改变怪物的路线', '保护控制台里的捕获电源', '用诱饵把怪物引入捕获区域'],
    hint: '拖动标题栏移动窗口；紫色窗口会挡住怪物。黄色诱饵能把它从电源旁引开。',
    speed: 91,
    spawn: { x: 292, y: 340 },
    windows: [
      { id: 'console', title: 'capture_console.exe', x: 390, y: 88, w: 330, h: 240, kind: 'console', movable: true },
      { id: 'shield-a', title: 'shield.sys', x: 650, y: 342, w: 150, h: 154, kind: 'shield', movable: true },
    ],
    objects: [
      { id: 'diagnostics', windowId: 'console', label: '运行诊断', x: 416, y: 194, w: 132, h: 40, kind: 'button', eaten: false },
      { id: 'logs', windowId: 'console', label: '清理缓存', x: 558, y: 194, w: 136, h: 40, kind: 'button', eaten: false },
      { id: 'power', windowId: 'console', label: '捕获电源 · 请保护', x: 416, y: 250, w: 278, h: 46, kind: 'critical', eaten: false },
    ],
  },
  {
    id: 3,
    name: '怪物学聪明了',
    subtitle: 'A LITTLE TOO SMART',
    description: '它开始躲开你的光标。别急，诱饵依然是它的软肋。',
    objectives: ['避开怪物，保持诱饵的吸引力', '保护捕获电源，合理移动障碍窗口', '在 3 次关门机会内完成捕获'],
    hint: '光标靠近会吓跑它。把诱饵放进笼子后移开光标，再等绿色「已进入」提示。',
    speed: 103,
    spawn: { x: 345, y: 378 },
    windows: [
      { id: 'console', title: 'capture_console.exe', x: 390, y: 88, w: 330, h: 240, kind: 'console', movable: true },
      { id: 'shield-a', title: 'shield.sys', x: 650, y: 342, w: 150, h: 154, kind: 'shield', movable: true },
      { id: 'shield-b', title: 'firewall.sys', x: 140, y: 310, w: 150, h: 138, kind: 'shield', movable: true },
    ],
    objects: [
      { id: 'diagnostics', windowId: 'console', label: '运行诊断', x: 416, y: 194, w: 132, h: 40, kind: 'button', eaten: false },
      { id: 'logs', windowId: 'console', label: '查看日志', x: 558, y: 194, w: 136, h: 40, kind: 'button', eaten: false },
      { id: 'power', windowId: 'console', label: '捕获电源 · 请保护', x: 416, y: 250, w: 278, h: 46, kind: 'critical', eaten: false },
    ],
  },
];

export function getLevel(id: 1 | 2 | 3): LevelConfig {
  return LEVELS[id - 1]!;
}
