/**
 * colorUtils.ts
 * Deterministic color-name to HEX resolution utility.
 */

const COLOR_MAP: Record<string, string> = {
  aliceblue: '#F0F8FF', antiquewhite: '#FAEBD7', aqua: '#00FFFF',
  aquamarine: '#7FFFD4', azure: '#F0FFFF', beige: '#F5F5DC',
  bisque: '#FFE4C4', black: '#000000', blanchedalmond: '#FFEBCD',
  blue: '#0000FF', blueviolet: '#8A2BE2', brown: '#A52A2A',
  burlywood: '#DEB887', cadetblue: '#5F9EA0', chartreuse: '#7FFF00',
  chocolate: '#D2691E', coral: '#FF7F50', cornflowerblue: '#6495ED',
  cornsilk: '#FFF8DC', crimson: '#DC143C', cyan: '#00FFFF',
  darkblue: '#00008B', darkcyan: '#008B8B', darkgoldenrod: '#B8860B',
  darkgray: '#A9A9A9', darkgrey: '#A9A9A9', darkgreen: '#006400',
  darkkhaki: '#BDB76B', darkmagenta: '#8B008B', darkolivegreen: '#556B2F',
  darkorange: '#FF8C00', darkorchid: '#9932CC', darkred: '#8B0000',
  darksalmon: '#E9967A', darkseagreen: '#8FBC8F', darkslateblue: '#483D8B',
  darkslategray: '#2F4F4F', darkslategrey: '#2F4F4F', darkturquoise: '#00CED1',
  darkviolet: '#9400D3', deeppink: '#FF1493', deepskyblue: '#00BFFF',
  dimgray: '#696969', dimgrey: '#696969', dodgerblue: '#1E90FF',
  firebrick: '#B22222', floralwhite: '#FFFAF0', forestgreen: '#228B22',
  fuchsia: '#FF00FF', gainsboro: '#DCDCDC', ghostwhite: '#F8F8FF',
  gold: '#FFD700', goldenrod: '#DAA520', gray: '#808080', grey: '#808080',
  green: '#008000', greenyellow: '#ADFF2F', honeydew: '#F0FFF0',
  hotpink: '#FF69B4', indianred: '#CD5C5C', indigo: '#4B0082',
  ivory: '#FFFFF0', khaki: '#F0E68C', lavender: '#E6E6FA',
  lavenderblush: '#FFF0F5', lawngreen: '#7CFC00', lemonchiffon: '#FFFACD',
  lightblue: '#ADD8E6', lightcoral: '#F08080', lightcyan: '#E0FFFF',
  lightgoldenrodyellow: '#FAFAD2', lightgray: '#D3D3D3', lightgrey: '#D3D3D3',
  lightgreen: '#90EE90', lightpink: '#FFB6C1', lightsalmon: '#FFA07A',
  lightseagreen: '#20B2AA', lightskyblue: '#87CEFA', lightslategray: '#778899',
  lightslategrey: '#778899', lightsteelblue: '#B0C4DE', lightyellow: '#FFFFE0',
  lime: '#00FF00', limegreen: '#32CD32', linen: '#FAF0E6',
  magenta: '#FF00FF', maroon: '#800000', mediumaquamarine: '#66CDAA',
  mediumblue: '#0000CD', mediumorchid: '#BA55D3', mediumpurple: '#9370DB',
  mediumseagreen: '#3CB371', mediumslateblue: '#7B68EE', mediumspringgreen: '#00FA9A',
  mediumturquoise: '#48D1CC', mediumvioletred: '#C71585', midnightblue: '#191970',
  mintcream: '#F5FFFA', mistyrose: '#FFE4E1', moccasin: '#FFE4B5',
  navajowhite: '#FFDEAD', navy: '#000080', oldlace: '#FDF5E6',
  olive: '#808000', olivedrab: '#6B8E23', orange: '#FFA500',
  orangered: '#FF4500', orchid: '#DA70D6', palegoldenrod: '#EEE8AA',
  palegreen: '#98FB98', paleturquoise: '#AFEEEE', palevioletred: '#DB7093',
  papayawhip: '#FFEFD5', peachpuff: '#FFDAB9', peru: '#CD853F',
  pink: '#FFC0CB', plum: '#DDA0DD', powderblue: '#B0E0E6',
  purple: '#800080', rebeccapurple: '#663399', red: '#FF0000',
  rosybrown: '#BC8F8F', royalblue: '#4169E1', saddlebrown: '#8B4513',
  salmon: '#FA8072', sandybrown: '#F4A460', seagreen: '#2E8B57',
  seashell: '#FFF5EE', sienna: '#A0522D', silver: '#C0C0C0',
  skyblue: '#87CEEB', slateblue: '#6A5ACD', slategray: '#708090',
  slategrey: '#708090', snow: '#FFFAFA', springgreen: '#00FF7F',
  steelblue: '#4682B4', tan: '#D2B48C', teal: '#008080',
  thistle: '#D8BFD8', tomato: '#FF6347', turquoise: '#40E0D0',
  violet: '#EE82EE', wheat: '#F5DEB3', white: '#FFFFFF',
  whitesmoke: '#F5F5F5', yellow: '#FFFF00', yellowgreen: '#9ACD32',
  'navy blue': '#000080', 'sky blue': '#87CEEB', 'dark blue': '#00008B',
  'light blue': '#ADD8E6', 'royal blue': '#4169E1', 'powder blue': '#B0E0E6',
  'midnight blue': '#191970', 'steel blue': '#4682B4', 'cornflower blue': '#6495ED',
  'dodger blue': '#1E90FF', 'deep sky blue': '#00BFFF', 'baby blue': '#89CFF0',
  'ice blue': '#99C5C4', 'cobalt blue': '#0047AB', 'cadet blue': '#5F9EA0',
  'slate blue': '#6A5ACD', 'dark green': '#006400', 'light green': '#90EE90',
  'lime green': '#32CD32', 'sea green': '#2E8B57', 'forest green': '#228B22',
  'olive green': '#6B8E23', 'hunter green': '#355E3B', 'mint green': '#98FF98',
  'sage green': '#B2AC88', 'emerald green': '#50C878', 'spring green': '#00FF7F',
  'neon green': '#39FF14', 'dark red': '#8B0000', 'light red': '#FF6666',
  'brick red': '#CB4154', 'blood red': '#880808', 'burgundy red': '#800020',
  'dark orange': '#FF8C00', 'light orange': '#FFD580', 'burnt orange': '#CC5500',
  'dark yellow': '#9B870C', 'light yellow': '#FFFFE0', 'lemon yellow': '#FFF44F',
  'dark gray': '#A9A9A9', 'dark grey': '#A9A9A9', 'light gray': '#D3D3D3',
  'light grey': '#D3D3D3', 'charcoal gray': '#36454F', 'charcoal grey': '#36454F',
  charcoal: '#36454F', 'slate gray': '#708090', 'slate grey': '#708090',
  'ash gray': '#B2BEB5', 'ash grey': '#B2BEB5', ash: '#B2BEB5',
  'light pink': '#FFB6C1', 'dark pink': '#E75480', 'hot pink': '#FF69B4',
  'deep pink': '#FF1493', 'rose pink': '#FF66CC', 'baby pink': '#F4C2C2',
  mauve: '#E0B0FF', 'dark purple': '#301934', 'light purple': '#B19CD9',
  'dark brown': '#654321', 'light brown': '#C4A265', 'sandy brown': '#F4A460',
  caramel: '#C68642', 'off white': '#F8F8FF', 'off-white': '#F8F8FF',
  cream: '#FFFDD0', 'ivory white': '#FFFFF0', 'pearl white': '#F8F6F0',
  pearl: '#F8F6F0', eggshell: '#F0EAD6', champagne: '#F7E7CE',
  'titanium gray': '#878681', 'titanium grey': '#878681', titanium: '#878681',
  'space gray': '#4C4A48', 'space grey': '#4C4A48', 'space black': '#141414',
  'midnight black': '#0A0A0A', 'jet black': '#343434', 'matte black': '#28282B',
  'rose gold': '#B76E79', copper: '#B87333', bronze: '#CD7F32',
  cobalt: '#0047AB', cerulean: '#007BA7', sapphire: '#0F52BA',
  'tiffany blue': '#81D8D0', burgund: '#800020', burgundy: '#800020',
  wine: '#722F37', 'wine red': '#722F37', rust: '#B7410E',
  amber: '#FFBF00', mustard: '#FFDB58', 'mustard yellow': '#FFDB58',
  'army green': '#4B5320', 'moss green': '#8A9A5B', 'jade green': '#00A36C',
  'teal green': '#00827F', seafoam: '#93E9BE', mint: '#98FF98',
  'pastel pink': '#FFD1DC', 'pastel blue': '#AEC6CF', 'pastel green': '#77DD77',
  'pastel yellow': '#FDFD96', 'pastel purple': '#B39EB5',
  gunmetal: '#2A3439', 'gunmetal gray': '#2A3439', 'gunmetal grey': '#2A3439',
  onyx: '#353839', obsidian: '#1B1B1B', 'storm gray': '#7E848C',
  'storm grey': '#7E848C', taupe: '#483C32', sand: '#C2B280',
  'desert sand': '#EDC9AF', latte: '#C9A97E', mocha: '#967969',
  mahogany: '#C04000', 'alpine white': '#FAF9F6', alpine: '#FAF9F6',
  starlight: '#E8E0D8', neon: '#39FF14', 'neon blue': '#1F51FF',
  'neon pink': '#FF44CC', 'neon orange': '#FF6600', 'electric blue': '#7DF9FF',
};

function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveColorHex(name: string): string | null {
  if (!name || !name.trim()) return null;
  const key = normalise(name);
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  const compact = key.replace(/\s/g, '');
  if (COLOR_MAP[compact]) return COLOR_MAP[compact];
  return null;
}

export function isKnownColor(name: string): boolean {
  return resolveColorHex(name) !== null;
}

export function allColorNames(): string[] {
  return Object.keys(COLOR_MAP);
}
