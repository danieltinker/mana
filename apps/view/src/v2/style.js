/* The look of what only a v2 menu has: the dish's choices, "goes well with", one suggestion, the basket's lines, the
   filter and the "closed now" line. Injected by the v2 chunk (guest.js), so a v1 menu's app.css stays as it is.
   The same tokens as app.css: cream ink on near-black, the menu's accent, the display face for names. */
export const CSS = `
.app{overflow:clip}
.price small.from{display:inline;margin:0;margin-inline-end:6px;vertical-align:.2em;font-size:.74rem}
.row-price small.from{margin:0 0 1px;font-size:.7rem}
.badge.sold.later{background:rgba(244,237,226,.07);color:var(--ink-soft);border-color:var(--edge-2)}

.v2-groups{display:grid;gap:20px}
.v2-groups:empty{display:none}
.v2-group{margin:0;padding:0;border:0;min-width:0;display:grid;gap:2px}
.v2-group>legend{display:flex;align-items:baseline;justify-content:space-between;gap:12px;width:100%;padding:0 0 7px;margin-bottom:2px;border-bottom:1px solid var(--edge)}
.g-name{font:600 1.1rem/1.25 var(--display)}
.g-hint{flex:none;font-size:.76rem;color:var(--ink-soft);white-space:nowrap}
.v2-group.need>legend .g-hint{color:var(--accent);font-weight:600}
.opt{position:relative;display:grid;grid-template-columns:22px minmax(0,1fr) auto;align-items:center;gap:12px;min-height:48px;padding:4px 2px;border-radius:12px;cursor:pointer}
.opt input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
.o-mark{display:grid;place-items:center;width:22px;height:22px;border:1.5px solid var(--edge-2);border-radius:50%;color:var(--on-accent)}
.opt.multi .o-mark{border-radius:7px}
.o-mark::after{content:"";width:8px;height:8px;border-radius:50%;background:currentColor;opacity:0}
.opt.multi .o-mark::after{width:11px;height:6px;border-radius:0;background:none;border:solid currentColor;border-width:0 0 2px 2px;transform:translateY(-1px) rotate(-45deg)}
.opt input:checked+.o-mark{border-color:var(--accent);background:var(--accent)}
.opt input:checked+.o-mark::after{opacity:1}
.opt input:focus-visible+.o-mark{outline:2px solid var(--accent);outline-offset:3px}
.o-name{min-width:0;font-size:1rem;line-height:1.3}
.o-name small{display:block;font-size:.74rem;color:var(--ink-soft)}
.o-price{font-variant-numeric:tabular-nums;font-size:.92rem;color:var(--ink-soft);white-space:nowrap}
.opt.sold{cursor:default}
.opt.sold .o-name,.opt.sold .o-price{color:var(--ink-faint)}
.opt.sold .o-mark{opacity:.45}
.opt.full:not(.on){cursor:default}
.opt.full:not(.on) .o-name,.opt.full:not(.on) .o-price{color:var(--ink-faint)}
.opt.qty{grid-template-columns:22px minmax(0,1fr) auto auto;cursor:default}
.opt.qty .o-mark{border-radius:7px;font:600 .74rem/1 var(--body);font-variant-numeric:tabular-nums}
.opt.qty .o-mark::after{display:none}
.opt.qty.on .o-mark{border-color:var(--accent);background:var(--accent)}
.opt.qty .stepper button{width:40px;height:40px}
.opt.qty .stepper button:disabled{opacity:.35;cursor:default}
.opt.qty .stepper output{min-width:1.6em;text-align:center;font-variant-numeric:tabular-nums}
.opt.qty.on .o-name{color:var(--ink)}
.v2-nested{display:grid;gap:2px;margin:2px 0 6px;margin-inline-start:11px;padding-inline-start:22px;border-inline-start:1px solid color-mix(in srgb,var(--accent) 40%,transparent)}
.v2-nested .v2-group>legend{border-bottom:0;padding-bottom:2px}
.v2-nested .g-name{font-size:.98rem}
.actions .v2-slot,.actions .v2-need{flex-basis:100%}
.v2-need{font-size:.88rem;color:var(--accent)}
.v2-need.off{color:#f6c4b2}
.card.v2-choices .actions{--pad:calc(20px + env(safe-area-inset-bottom,0px));position:sticky;bottom:calc(var(--pad) * -1);z-index:2;margin:0 calc(var(--gut) * -1) calc(var(--pad) * -1);padding:16px var(--gut) var(--pad);background:linear-gradient(to bottom,rgba(18,14,11,0),rgb(18,14,11) 22px)}
.app.simple .card.v2-choices .actions{background:linear-gradient(to bottom,rgba(17,13,10,0),var(--panel) 22px)}
.actions .primary.added{background:var(--accent-soft);color:var(--ink);box-shadow:inset 0 0 0 1px var(--accent)}

.v2-related{display:grid;gap:8px}
.v2-related h2,.v2-panel h2{font:500 .72rem/1.4 var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft)}
.v2-rel{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;margin-inline:calc(var(--gut) * -1);padding:2px var(--gut) 4px}
.v2-rel::-webkit-scrollbar{display:none}
.v2-rel button{flex:none;display:grid;grid-template-columns:40px auto;align-items:center;gap:10px;min-height:56px;padding:7px 16px 7px 7px;border:1px solid var(--edge-2);border-radius:999px;background:rgba(244,237,226,.03);text-align:start}
.v2-rel button:hover{border-color:var(--ink-soft)}
.v2-rel .thumb{width:40px;height:40px;border-radius:50%;object-fit:cover;display:grid;place-items:center;background:var(--bg-2);font:600 1rem var(--display);color:var(--ink-soft)}
.r-txt{display:grid;gap:1px}
.r-name{font:500 1rem/1.15 var(--display);white-space:nowrap}
.r-price{font-size:.78rem;color:var(--ink-soft);font-variant-numeric:tabular-nums}

.v2-sug{display:grid;gap:10px;padding:14px 16px;border:1px solid color-mix(in srgb,var(--accent) 50%,transparent);border-radius:18px;background:linear-gradient(var(--accent-soft),var(--accent-soft)),rgba(17,13,10,.9);text-shadow:none}
.s-kicker{font:500 .68rem/1.3 var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.s-line{font:600 1.12rem/1.25 var(--display)}
.s-what{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;font-size:.92rem;color:var(--ink-soft)}
.s-what b{font-weight:500;color:var(--ink)}
.s-acts{display:flex;gap:8px}
.s-acts .primary,.s-acts .ghost{flex:1 1 0;min-height:44px;padding:0 16px;background-clip:padding-box}
.s-acts .ghost{background:none}
.actions .v2-sug{grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px 12px;padding:12px 12px 12px 16px}
.actions .s-kicker{display:none}
.actions .s-line{font-size:1.02rem}
.actions .s-what{grid-column:1;font-size:.86rem}
.actions .s-acts{grid-column:2;grid-row:1/span 2;flex-direction:column;gap:6px}
.actions .s-acts .primary,.actions .s-acts .ghost{flex:none;min-height:40px;min-width:104px;padding:0 14px;font-size:.9rem}
.v2-float{position:absolute;z-index:9;inset-inline:var(--gut);bottom:calc(var(--card-h) + 12px);box-shadow:0 12px 40px rgba(0,0,0,.5);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.app.wide .v2-float{inset-inline:16px auto;width:calc(var(--card-w) - 16px)}

.app.simple .sheet.tray{z-index:46}
.app.simple .sheet.tray .sheet-head{display:flex}
.lines li.v2-line{grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:4px 14px;min-height:0;padding:12px 0;border-bottom:1px solid var(--edge)}
.l-main{display:grid;gap:3px;min-width:0}
.v2-line .l-name{font:500 1.08rem/1.2 var(--display)}
.l-choices{font-size:.84rem;line-height:1.35;color:var(--ink-soft)}
.l-why{font-size:.84rem;line-height:1.35;color:#f6c4b2}
.l-why.later{color:var(--ink-soft)}
.v2-line .l-price{font:500 1.06rem/1.2 var(--display);font-variant-numeric:tabular-nums;text-align:end;white-space:nowrap}
.v2-line .l-price small{display:block;font:400 .72rem/1.3 var(--body);color:var(--ink-faint)}
.l-acts{grid-column:1/-1;display:flex;align-items:center;gap:16px;margin-top:4px}
.l-acts .stepper{margin-inline-end:auto}
.l-acts .link{min-height:44px}
.v2-line.off .l-name,.v2-line.off .l-price{color:var(--ink-faint)}
.v2-vat{margin-top:-6px;font-size:.8rem;color:var(--ink-soft)}

.tool.v2-on{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,rgba(17,13,10,.7))}
.app.simple .sheet.list{padding-top:calc(env(safe-area-inset-top,0px) + 64px + var(--v2-notes,0px))}
.v2-notes{display:flex;flex-wrap:wrap;gap:6px;padding:6px var(--gut) 0;text-shadow:none}
.v2-notes:empty{display:none}
.v2-pill{display:inline-flex;align-items:center;gap:4px;min-height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--edge-2);background:rgba(17,13,10,.78);font-size:.84rem;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.v2-pill.on{padding-inline-end:4px;border-color:color-mix(in srgb,var(--accent) 60%,transparent);color:var(--ink)}
.v2-pill.on button{display:grid;place-items:center;width:34px;height:34px;margin:-4px 0;padding:0;border:0;border-radius:50%;background:none;color:var(--ink-soft)}
.v2-pill.closed{color:var(--ink-soft)}
.v2-panel{display:grid;gap:10px;margin:8px var(--gut) 0;padding:14px;border:1px solid var(--edge-2);border-radius:18px;background:rgba(17,13,10,.95);box-shadow:0 18px 50px rgba(0,0,0,.5);text-shadow:none}
.v2-tags{display:flex;flex-wrap:wrap;gap:8px}
.v2-tag{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 14px;border:1px solid var(--edge-2);border-radius:999px;background:none;font-size:.92rem}
.v2-tag small{font-size:.76rem;color:var(--ink-soft)}
.v2-tag[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft)}
.v2-tag:disabled{opacity:.4;cursor:default}
.v2-tag.t-vegan svg,.v2-tag.t-vegetarian svg{color:#a9c98a}
.v2-tag.t-spicy svg{color:#f0a184}
/* a look with a light card (templates: casablanca-white): the same pieces in ink on whitewash */
.app[data-card="light"] .card .g-hint,.app[data-card="light"] .card .o-price,.app[data-card="light"] .card .o-name small,.app[data-card="light"] .card .r-price,.app[data-card="light"] .card .s-what,.app[data-card="light"] .card .v2-related h2{color:var(--look-ink-soft,#4a4541)}
.app[data-card="light"] .card .s-what b,.app[data-card="light"] .card .r-name{color:var(--look-ink,#0f0f0f)}
.app[data-card="light"] .card .v2-group>legend{border-color:rgba(15,15,15,.14)}
.app[data-card="light"] .card .o-mark,.app[data-card="light"] .card .stepper button,.app[data-card="light"] .card .v2-rel button{border-color:rgba(15,15,15,.32)}
.app[data-card="light"] .card .opt.sold .o-name,.app[data-card="light"] .card .opt.full:not(.on) .o-name{color:var(--look-ink-faint,#57514c)}
.app[data-card="light"] .card .v2-need,.app[data-card="light"] .card .s-kicker{color:var(--look-price,#6d5319)}
.app[data-card="light"] .card .v2-nested{border-color:rgba(15,15,15,.18)}
.app[data-card="light"] .card .v2-rel .thumb{background:rgba(15,15,15,.06);color:var(--look-ink-soft,#4a4541)}
.app[data-card="light"] .card .v2-sug{background:linear-gradient(var(--accent-soft),var(--accent-soft)),rgb(252,248,246)}
.app[data-card="light"] .card.v2-choices .actions{background:linear-gradient(to bottom,rgba(252,248,246,0),rgb(252,248,246) 22px)}
@media (forced-colors:active){ .opt input:checked+.o-mark{background:Highlight} .v2-tag[aria-pressed="true"]{border-width:2px} }
`;
