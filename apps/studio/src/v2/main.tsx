// The v2 owner app (the clean schema, ADR-005), booted by ../main.tsx when the config says schema 2.
import { render } from 'preact';
import { PRODUCT } from '../product.ts';
import { returnFocusOnClose } from '../ui.tsx';
import { applyLang } from './i18n.ts';
import { App } from './app.tsx';
import './v2.css';

// every dialog and sheet of the v2 app gives the focus back to what opened it (the v1 app's do not: unchanged)
returnFocusOnClose();
applyLang();
document.title = PRODUCT.mark;
document.documentElement.dataset.app = 'v2';
render(<App />, document.getElementById('app')!);
