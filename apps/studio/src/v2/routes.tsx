// Every screen of the v2 app inside the shell, by address (#/<path>/…), and the phone navigation built from them.
// Later lanes add their screens here (README.md, "How the next lanes plug in").
import type { VNode } from 'preact';
import { hasChanges } from './data/draft.ts';
import { AddonsScreen } from './screens/addons.tsx';
import { MenuScreen } from './screens/menu.tsx';
import { PublishScreen } from './screens/publish.tsx';

/** A tab of the bottom bar (a rail on a wide screen). `label` is an i18n key; `dot` marks something waiting there. */
export type NavItem = { readonly key: string; readonly icon: string; readonly label: string; readonly order: number; readonly dot?: () => boolean };
/** A screen, found by the first part of the address; it gets the rest (#/menu/d/<id> → ['d', '<id>']). */
export type ScreenDef = { readonly path: string; readonly render: (rest: string[]) => VNode; readonly nav?: NavItem };

export const SCREENS: readonly ScreenDef[] = [
  { path: 'menu', render: (rest) => <MenuScreen rest={rest} />, nav: { key: 'menu', icon: 'menu', label: 'nav.menu', order: 20 } },
  { path: 'addons', render: (rest) => <AddonsScreen rest={rest} />, nav: { key: 'addons', icon: 'layers', label: 'nav2.addons', order: 30 } },
  { path: 'publish', render: () => <PublishScreen />, nav: { key: 'publish', icon: 'send', label: 'pub.title', order: 90, dot: () => hasChanges.value } },
];

/** Where a place opens, and where an address that leads nowhere goes. */
export const landing = (): string => 'menu';

export const screenAt = (path: string): ScreenDef | undefined => SCREENS.find((s) => s.path === path);

/** The tabs in order. A phone shows five at most: past that, the fifth is "More", which lists the rest. */
export const NAV: readonly (NavItem & { path: string })[] = SCREENS.flatMap((s) => (s.nav ? [{ ...s.nav, path: s.path }] : [])).sort((a, b) => a.order - b.order);
export const PHONE_TABS = 5;
