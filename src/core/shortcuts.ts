/** Keyboard shortcut reference for Orbit on Reddit (shown in-app with ? and on the settings page). */
export const SHORTCUTS: [string, [string, string[]][]][] = [
  ['Navigation', [['Next / previous post', ['J', 'K']], ['Open post', ['O']], ['Open in a new tab', ['⇧', 'O']], ['Go back', ['Esc']], ['Home · Popular · All', ['G', 'H/P/A']], ['Saved · Inbox · History', ['G', 'S/I/V']], ['Scroll to top', ['G', 'T']]]],
  ['Highlighted item', [['Upvote', ['A']], ['Downvote', ['Z']], ['Save', ['S']], ['Comments', ['C']], ['View media', ['M']], ['Open link', ['L']], ['Hide post', ['H']]]],
  ['Comments', [['Next / previous thread', ['J', 'K']], ['Next / previous comment', [']', '[']], ['Collapse / expand', ['X']], ['Collapse all', ['⇧', 'X']], ['Expand all', ['⇧', 'E']]]],
  ['Feed', [['Best · Hot · New · Top · Rising', ['⇧', 'B/H/N/T/R']], ['Layouts', ['1', '2', '3', '4']], ['Refresh', ['R']]]],
  ['Interface', [['Quick switcher', ['⌘/Ctrl', 'K']], ['Search', ['/']], ['Toggle sidebar', ['B']], ['Toggle theme', ['T']], ['Switch platform', ['⌥', 'O']], ['Classic Reddit', ['⌥', '⇧', 'O']], ['Shortcuts', ['?']]]],
];


/** Orbit on X adds a few shortcuts of its own; X's native ones (J/K, L, R, T, B, N, G+…) keep working untouched. */
export const X_SHORTCUTS: [string, [string, string[]][]][] = [
  ['Orbit', [['Command palette', ['⌘/Ctrl', 'K']], ['Switch platform', ['⌥', 'O']], ['Toggle sidebar', ['\\']], ['Classic X on this tab', ['⌥', '⇧', 'O']]]],
  ['Reading', [['Read the whole thread', ['⇧', 'R']], ['Open media in the Orbit viewer', ['Click', 'image']], ['Next / previous image', ['←', '→']], ['Close viewer', ['Esc']]]],
  ['Native X (unchanged)', [['Next / previous post', ['J', 'K']], ['Like · Reply · Repost', ['L', 'R', 'T']], ['Bookmark', ['B']], ['New post', ['N']], ['Go home · explore · notifications', ['G', 'H/E/N']]]],
];

/** Orbit on YouTube adds a few shortcuts; YouTube's own player keys (K, J, L, F, T, M, C, <, >) keep working. */
export const YT_SHORTCUTS: [string, [string, string[]][]][] = [
  ['Orbit', [['Command palette', ['⌘/Ctrl', 'K']], ['Switch platform', ['⌥', 'O']], ['Search', ['/']], ['Toggle sidebar', ['\\']], ['Classic YouTube on this tab', ['⌥', '⇧', 'O']]]],
  ['Player (YouTube’s own)', [['Play / pause', ['K']], ['Back / forward 10 s', ['J', 'L']], ['Theater mode', ['T']], ['Full screen', ['F']], ['Mute', ['M']], ['Captions', ['C']], ['Speed down / up', ['<', '>']]]],
  ['Shorts', [['Previous / next short', ['↑', '↓']]]],
];
