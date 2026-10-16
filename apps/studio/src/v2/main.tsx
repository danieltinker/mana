// The v2 owner app (the clean schema, ADR-005), booted by ../main.tsx when the config says schema 2.
import { render } from 'preact';
import { PRODUCT } from '../product.ts';
import { applyLang } from './i18n.ts';
import { App } from './app.tsx';
import './v2.css';

applyLang();
document.title = PRODUCT.mark;
render(<App />, document.getElementById('app')!);
