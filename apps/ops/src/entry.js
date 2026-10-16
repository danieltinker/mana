// The back office's entry point. It picks v1 or v2 once, at start, from the config's flags (ADR-007), and nothing below
// it checks them again:
// - schema 1 (production, halom.io/mana on halom-studio): the v1 back office, bundled here as it always was;
// - schema 2 (the demo database `mana`, the simulator's stack): the v2 command center, a bundle of its own (v2.js and
//   v2.css), fetched only then, so production downloads and runs exactly the v1 back office.
import { configFlags } from '@mana/contracts';
import { startV1 } from './main.jsx';

const mount = document.getElementById('app');
if (configFlags(window.HALOM_MENUS_CONFIG).schema === 2) {
  import(new URL('v2.js', import.meta.url).href).then(
    (v2) => v2.startV2(mount),
    () => { mount.textContent = 'Could not load the back office. Reload the page.'; },
  );
} else {
  startV1(mount);
}
