// 16 z 17 presetow z pliku 01, sekcja 4 (docs). Pominiety "Forensic": jego ramp jest "stala wewnetrzna", nie znamy go.
// Kolejnosc: ramp[0] = najgestszy znak; ostatnia spacja = pusta komorka.
export const CHARSETS: Record<string, { name: string; group: string; ramp: string }> = {
  standard: { name: 'Standard', group: 'Classic', ramp: '@#S08Xx+=-;:. ' },
  classic: { name: 'Classic ASCII', group: 'Classic', ramp: '@%#*+=-:. ' },
  ink: { name: 'Ink', group: 'Classic', ramp: '@&$%#?*+~:. ' },
  minimal: { name: 'Minimal', group: 'Classic', ramp: '█▄▀ ' },
  blocks: { name: 'Blocks', group: 'Blocks', ramp: '█▓▒░ ' },
  bars: { name: 'Bars', group: 'Blocks', ramp: '█▇▆▅▄▃▂▁ ' },
  quadrants: { name: 'Quadrants', group: 'Blocks', ramp: '█▛▙▟▜▚▞▘▝ ' },
  braille: { name: 'Braille', group: 'Blocks', ramp: '⣿⣷⣦⣤⣠⣄⡄⠆⠄⠂ ' },
  numeric: { name: 'Numeric', group: 'Coded', ramp: '8069453271. ' },
  binary: { name: 'Binary', group: 'Coded', ramp: '10 ' },
  hacker: { name: 'Hacker', group: 'Coded', ramp: '@#10Xx*+-. ' },
  alpha: { name: 'Alpha', group: 'Coded', ramp: 'WMBHAXKOQwvcr:. ' },
  dots: { name: 'Dots', group: 'Glyphs', ramp: '●◕◑◔○∙·. ' },
  geometric: { name: 'Geometric', group: 'Glyphs', ramp: '█◆◼▲▼◇△▽·. ' },
  math: { name: 'Math', group: 'Glyphs', ramp: '#ΣΔΨΩ×÷+·. ' },
  katakana: { name: 'Katakana', group: 'Glyphs', ramp: 'ﾊﾐﾋﾂｳｼﾅﾓﾆｻﾜｵﾘｱﾎﾃﾏｹﾒｰ･ ' },
};
