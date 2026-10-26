import { PALETTE_KEY, MODE_KEY, parseAppearance, resolveDark } from './preferences.generated.js';
const root = document.documentElement;
const palette = document.getElementById('palette');
const mode = document.getElementById('brightness');
const system = matchMedia('(prefers-color-scheme: dark)');
function update(persist = false) {
  const next = parseAppearance(palette.value, mode.value);
  root.dataset.palette = next.palette;
  root.dataset.appearance = next.mode;
  root.classList.toggle('dark', resolveDark(next.mode, system.matches));
  root.style.colorScheme = resolveDark(next.mode, system.matches) ? 'dark' : 'light';
  if (persist) {
    try { localStorage.setItem(PALETTE_KEY, next.palette); localStorage.setItem(MODE_KEY, next.mode); }
    catch { document.getElementById('appearance-note').textContent = 'Applied for this session; browser storage is unavailable.'; }
  }
}
palette.value = root.dataset.palette;
mode.value = root.dataset.appearance;
palette.addEventListener('change', () => update(true));
mode.addEventListener('change', () => update(true));
system.addEventListener('change', () => update());
