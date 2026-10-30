import { html, raw } from 'hono/html';
import { CLOUD, notice, page } from './design';
import { tokenTemplateUrl } from './views';

/**
 * The public front page and the only way in: sign in with Cloudflare or an API token.
 * The control plane's CSP allows no scripts, so every demo below moves with CSS alone, and each one
 * is drawn in its finished state first so reduced motion shows the same picture standing still.
 */
const STYLES = `
.banner{display:grid;gap:8px;padding-top:20px}.banner a{font-size:14px}
.glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(600px 420px at 78% 8%,color-mix(in srgb,var(--accent) 24%,transparent),transparent 70%),radial-gradient(520px 380px at 8% 40%,rgba(124,196,255,.07),transparent 70%)}
.grain{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(var(--soft2) 1px,transparent 1px);background-size:3px 3px}
header.hero{position:relative;padding:72px 0 48px;overflow:hidden}
.hero .wrap{position:relative;display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}
@media (max-width:940px){.hero .wrap{grid-template-columns:minmax(0,1fr)}header.hero{padding-top:44px}}
.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;font-size:13px;color:var(--muted);background:var(--soft)}
.eyebrow b{color:var(--mint);font-weight:600}.eyebrow .dot{color:var(--mint)}
.hero-title{font-size:clamp(42px,6.4vw,76px);line-height:1.02;margin:22px 0 20px}
.lede{font-size:19px;color:var(--muted);max-width:34em;margin:0 0 30px}
.cta{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.fine{font-size:13px;color:var(--dim);margin-top:16px}

.window{margin:0;min-width:0;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,var(--panel2),var(--panel));color:var(--ink);box-shadow:0 40px 80px -30px rgba(0,0,0,.6);overflow:hidden}
.window .bar{display:flex;align-items:center;gap:7px;padding:12px 14px;border-bottom:1px solid var(--line);font-size:12px;color:var(--dim)}
.window .bar i{width:11px;height:11px;border-radius:50%}.window .bar i:nth-child(1){background:#ff6b5e}.window .bar i:nth-child(2){background:#f5bf4f}.window .bar i:nth-child(3){background:#5fd06a}
.window .bar span{margin-left:8px}
.console{padding:18px 18px 20px;font:13.5px/1.9 var(--mono);color:var(--muted)}
.console .ln{display:flex;gap:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;animation:type 450ms var(--ease-out) backwards;animation-delay:calc(var(--i) * 550ms + 300ms)}
.console .ln>*{overflow:hidden;text-overflow:ellipsis}
@keyframes type{from{opacity:0;transform:translateY(6px)}}
.console .ok{color:var(--mint)}.console .cmd{color:var(--ink)}.console .k{color:var(--ink);min-width:118px;flex:none}.console .v{color:var(--dim)}.console .url{color:var(--accent2)}
@media (max-width:560px){.console{font-size:12px;padding:14px}.console .k{min-width:96px}}
.progress{height:3px;background:var(--soft)}.progress b{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--mint));transform-origin:left;animation:grow 3400ms var(--ease-in-out) 300ms backwards}
@keyframes grow{from{transform:scaleX(0)}}
.setup{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:14px;padding:12px 14px;border:1px dashed color-mix(in srgb,var(--accent) 45%,transparent);border-radius:12px;background:color-mix(in srgb,var(--accent) 6%,transparent);font-family:system-ui,sans-serif;color:var(--ink);animation:type 500ms var(--ease-out) 3700ms backwards}
.setup small{display:block;color:var(--dim);font-size:12px}

.marquee{border-block:1px solid var(--line);background:var(--bg2);overflow:hidden;padding:14px 0;mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}
.marquee .belt{display:flex;gap:40px;width:max-content;animation:slide 40s linear infinite;color:var(--muted);font-size:15px}
.marquee span{display:inline-flex;align-items:center;gap:10px;white-space:nowrap}.marquee span::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--accent)}
@keyframes slide{to{transform:translateX(-50%)}}

section.band{padding:96px 0;position:relative;scroll-margin-top:-8px}
#start{scroll-margin-top:64px}
.title{font-size:clamp(32px,4.2vw,50px);line-height:1.08;margin:12px 0 14px;max-width:18em}
.sub{color:var(--muted);font-size:18px;max-width:38em;margin:0 0 44px}
@media (max-width:720px){section.band{padding:64px 0;scroll-margin-top:24px}#start{scroll-margin-top:64px}}

.bento{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px}
.tile{position:relative;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,var(--panel2),var(--panel));padding:22px;overflow:hidden;transition:border-color 200ms ease,transform 200ms var(--ease-out)}
.tile h3{margin:0 0 4px;font-size:17px;letter-spacing:-.01em}.tile p.d{margin:0 0 18px;color:var(--muted);font-size:14.5px}
.span2{grid-column:span 2}.span3{grid-column:span 3}.span4{grid-column:span 4}.row2{grid-row:span 2}
@media (max-width:980px){.bento{grid-template-columns:repeat(2,minmax(0,1fr))}.span2,.span3,.span4{grid-column:span 2}.row2{grid-row:auto}}

/* An iPhone: titanium frame and side buttons, Dynamic Island, status bar and home indicator. */
.phone{position:relative;width:min(100%,290px);margin:0 auto;border-radius:52px;padding:11px;background:linear-gradient(145deg,#5d5a57,#2c2a28 30%,#1b1a19 60%,#4a4744);box-shadow:inset 0 0 0 1.5px #77736f,inset 0 0 0 4px #121110,0 30px 60px -20px rgba(0,0,0,.6)}
.phone::before,.phone::after{content:"";position:absolute;width:3px;border-radius:2px;background:linear-gradient(90deg,#3a3836,#6b6763)}
.phone::before{left:-3px;top:112px;height:56px;box-shadow:0 -40px 0 -0.5px #4a4744,0 70px 0 #4a4744}
.phone::after{right:-3px;top:150px;height:80px}
.screen{border-radius:41px;background:#fbf5ec;color:#2a1d12;overflow:hidden;position:relative;height:500px}
.island{position:absolute;z-index:2;top:10px;left:50%;width:84px;height:24px;margin-left:-42px;border-radius:999px;background:#000}
.status{display:flex;justify-content:space-between;align-items:center;height:44px;padding:0 12px 0 22px;font:600 13px/1 system-ui,-apple-system,sans-serif;letter-spacing:-.01em}
.status .sys{display:flex;gap:5px;align-items:center}.status svg{height:11px;width:auto;fill:currentColor}
.menu-hero{padding:0 0 12px;background:linear-gradient(160deg,#3b2414,#7a4a26);color:#fff4e6}
.menu-hero b{font-family:var(--serif);font-size:22px;display:block;padding:6px 16px 0}.menu-hero small{display:block;padding:0 16px;opacity:.75;font-size:12px}
.home{position:absolute;z-index:2;bottom:7px;left:50%;width:110px;height:4px;margin-left:-55px;border-radius:999px;background:#2a1d12}
.chips{display:flex;gap:6px;padding:12px 14px 6px;overflow:hidden}
.chip{font-size:12px;font-weight:600;padding:5px 11px;border-radius:999px;background:#efe4d5;color:#6b4e35;white-space:nowrap}.chip.on{background:#2a1d12;color:#fbf5ec}
.item{display:flex;align-items:center;gap:9px;padding:10px 14px;border-bottom:1px solid #eee2d2}
.thumb{width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;color:#6b4e35}.thumb svg{width:22px;height:22px}
.item div{flex:1;min-width:0}.item b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.item small{display:block;color:#8a7560;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.price{font-weight:700;font-size:13.5px}
.add{width:26px;height:26px;border-radius:50%;background:#2a1d12;color:#fff;display:grid;place-items:center;font-weight:700;font-size:16px;flex:none}
.item.tap .add{animation:tap 3200ms var(--ease-in-out) infinite}
@keyframes tap{0%,60%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(231,169,107,0)}66%{transform:scale(.82)}74%{transform:scale(1.06);box-shadow:0 0 0 8px rgba(231,169,107,.35)}84%{box-shadow:0 0 0 14px rgba(231,169,107,0)}}
.cart{position:absolute;left:12px;right:12px;bottom:20px;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-radius:16px;background:#2a1d12;color:#fbf5ec;font-size:14px;font-weight:600;box-shadow:0 10px 24px -8px rgba(42,29,18,.6);animation:bump 3200ms var(--ease-in-out) infinite}
@keyframes bump{0%,72%,100%{transform:none}78%{transform:translateY(-4px) scale(1.02)}}
.cart .n{display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:999px;background:#e7a96b;color:#2a1d12;font-size:12px;margin-right:8px}

.board{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;min-height:180px}
.col{border-radius:14px;background:var(--soft);border:1px solid var(--line);padding:10px;min-width:0}
.col h4{height:18px;line-height:18px;margin:0 0 8px;font:600 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dim);display:flex;justify-content:space-between}
.ticket{border-radius:10px;background:var(--panel2);border:1px solid var(--line2);padding:8px 10px;font-size:12.5px;margin-bottom:8px;min-width:0}
.ticket b{display:flex;justify-content:space-between;gap:6px;font-size:13px}.ticket>span{display:block;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ticket.ghost{visibility:hidden}
/* Moves one column (its own width plus the column padding and gap) at a time. */
.ticket.mover{position:absolute;z-index:1;top:36px;left:10px;width:calc((100% - 20px) / 3 - 20px);margin:0;border-color:var(--accent);box-shadow:0 10px 24px -10px color-mix(in srgb,var(--accent) 70%,transparent);animation:flow 7s var(--ease-in-out) infinite}
@keyframes flow{0%,22%{transform:none;opacity:1}36%,58%{transform:translateX(calc(100% + 30px))}72%,92%{transform:translateX(calc(200% + 60px));opacity:1}100%{transform:translateX(calc(200% + 60px));opacity:0}}
@media (max-width:560px){.board{gap:6px;min-height:0}.col{padding:8px 6px}.ticket{padding:6px 7px;font-size:11px}.ticket b{font-size:11.5px}.ticket b span{display:none}.ticket.mover{left:6px;top:34px;width:calc((100% - 12px) / 3 - 12px)}
  @keyframes flow{0%,22%{transform:none;opacity:1}36%,58%{transform:translateX(calc(100% + 18px))}72%,92%{transform:translateX(calc(200% + 36px));opacity:1}100%{transform:translateX(calc(200% + 36px));opacity:0}}}

.meter{margin:0 0 14px}.meter .top{display:flex;justify-content:space-between;align-items:center;font-size:13.5px;margin-bottom:6px}.meter .top span{color:var(--muted)}
.meter-bar{height:8px;border-radius:999px;background:var(--soft2);overflow:hidden}
.meter-bar b{display:block;height:100%;width:var(--w);border-radius:inherit;background:linear-gradient(90deg,var(--accent),var(--accent2));transform-origin:left;animation:grow 1600ms var(--ease-out) backwards;animation-delay:calc(var(--i) * 150ms + 200ms)}
.meter-bar b.low{background:linear-gradient(90deg,#ff5a4a,var(--red));animation:grow 1600ms var(--ease-out) 500ms backwards,blink 1600ms ease-in-out 2200ms infinite}
@keyframes blink{50%{opacity:.45}}

.chart .num{font-family:var(--serif);font-size:38px;font-weight:600;letter-spacing:-.02em;line-height:1;margin-top:6px}
.chart .delta{color:var(--mint);font-size:13px;font-weight:600}
.chart svg{display:block;width:100%;height:150px;margin-top:14px;overflow:visible}
.chart .line{fill:none;stroke:var(--accent);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:0;animation:draw 2600ms var(--ease-in-out) 300ms backwards}
.chart .area{animation:fade 1200ms ease 1600ms backwards}
.chart .bar{fill:var(--soft2)}
.chart .end{fill:var(--accent);animation:fade 400ms ease 2700ms backwards}.chart .halo{fill:color-mix(in srgb,var(--accent) 30%,transparent);transform-box:fill-box;transform-origin:center;animation:fade 400ms ease 2700ms backwards,halo 2s ease-out 3s infinite}
@keyframes draw{from{stroke-dashoffset:1}}@keyframes fade{from{opacity:0}}@keyframes halo{from{transform:scale(.4);opacity:1}to{transform:scale(2.2);opacity:0}}
.axis{display:flex;justify-content:space-between;font:11px var(--mono);color:var(--dim);margin-top:6px}

.chat{display:grid;gap:10px}
.bubble{display:grid;grid-template-columns:18px minmax(0,1fr);gap:9px;align-items:start;max-width:94%;padding:10px 13px;border-radius:16px 16px 16px 4px;background:var(--chat);border:1px solid var(--chat-line);font-size:13.5px;line-height:1.45;animation:pop 500ms var(--spring) backwards;animation-delay:calc(var(--i) * 700ms + 400ms)}
.bubble .bi{width:18px;height:18px;margin-top:1px;color:#37aee2}.bubble .bi.warn{color:#f5a524}
.bubble small{display:block;color:var(--chat-meta);font-size:11px;margin-top:3px}
.bot{display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:13px;color:var(--muted)}.bot i{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#37aee2,#1e96c8);display:grid;place-items:center}.bot svg{width:17px;height:17px;margin-left:-2px}
@keyframes pop{from{opacity:0;transform:translateY(10px) scale(.94)}}

.plan{display:grid;grid-template-columns:1.3fr 1fr;gap:18px}
@media (max-width:560px){.plan{grid-template-columns:minmax(0,1fr)}}
.shifts{display:grid;grid-template-columns:44px 1fr;gap:8px 10px;align-items:center;font-size:12.5px}
.shifts .who{color:var(--muted)}
.lane{position:relative;height:22px;border-radius:7px;background:var(--soft)}
.lane b{position:absolute;top:3px;bottom:3px;left:var(--s);width:var(--w);border-radius:5px;background:var(--c);transform-origin:left;animation:grow 900ms var(--ease-out) backwards;animation-delay:calc(var(--i) * 100ms + 200ms)}
.hours{grid-column:2;display:flex;justify-content:space-between;font:10.5px var(--mono);color:var(--dim)}
.now{position:absolute;top:-4px;bottom:-4px;left:58%;width:2px;background:var(--red);border-radius:2px}
.now::before{content:"";position:absolute;top:-3px;left:-3px;width:8px;height:8px;border-radius:50%;background:var(--red)}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;font-size:12px;text-align:center}
.cal span{color:var(--dim);font:10.5px var(--mono)}
.cal i{font-style:normal;aspect-ratio:1;border-radius:9px;display:grid;place-items:center;background:var(--soft);color:var(--muted)}
.cal i.ev{background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent2);font-weight:700;position:relative}
.cal i.ev::after{content:"";position:absolute;bottom:4px;width:4px;height:4px;border-radius:50%;background:var(--accent)}
.cal i.today{outline:2px solid var(--accent);outline-offset:-2px;color:var(--ink)}
.event{margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;background:var(--soft);border:1px solid var(--line);font-size:13px}
.seats{display:flex;gap:3px}.seats i{width:8px;height:8px;border-radius:2px;background:var(--accent)}.seats i.free{background:var(--soft2)}

.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;counter-reset:step}
@media (max-width:860px){.steps{grid-template-columns:minmax(0,1fr)}}
.step{position:relative;padding:26px;border-radius:20px;border:1px solid var(--line);background:var(--bg);transition:border-color 200ms ease,transform 200ms var(--ease-out)}
.step::before{counter-increment:step;content:counter(step,decimal-leading-zero);font:600 13px var(--mono);color:var(--accent);display:block;margin-bottom:28px}
.step h3{margin:0 0 6px;font-size:19px}.step p{margin:0;color:var(--muted);font-size:15px}
.step .chipline{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}.step .chipline span{font:12px var(--mono);padding:4px 9px;border-radius:7px;border:1px solid var(--line);color:var(--muted)}

.flow{display:grid;grid-template-columns:1fr auto 1fr auto 1.3fr;align-items:center;gap:14px;margin-top:8px}
@media (max-width:860px){.flow{grid-template-columns:minmax(0,1fr)}.flow .wire{transform:rotate(90deg);justify-self:center;width:40px;margin:14px 0}}
.node{border:1px solid var(--line);border-radius:18px;background:var(--panel);padding:18px}
.node small{font:600 11px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.node b{display:block;font-size:17px;margin:4px 0}.node p{margin:0;color:var(--muted);font-size:13.5px}
.node.yours{border-color:rgba(243,128,32,.55);background:linear-gradient(180deg,rgba(243,128,32,.10),var(--panel));box-shadow:0 0 60px -20px rgba(243,128,32,.45)}
.res{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.res span{text-align:center;font:12px var(--mono);padding:8px 4px;border-radius:10px;background:var(--soft);border:1px solid var(--line)}
.wire{width:80px;height:2px;background:repeating-linear-gradient(90deg,var(--accent) 0 8px,transparent 8px 16px);background-size:32px 2px;animation:wire 1s linear infinite;opacity:.8}
@keyframes wire{to{background-position:32px 0}}
.promises{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:40px}
@media (max-width:860px){.promises{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:480px){.promises{grid-template-columns:minmax(0,1fr)}}
.promise b{display:block;margin-bottom:4px}.promise p{margin:0;color:var(--muted);font-size:14.5px}
.promise svg{width:22px;height:22px;color:var(--accent);margin-bottom:10px}

.signin{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:40px;align-items:start;padding:40px;border-radius:28px;border:1px solid var(--line);background:radial-gradient(500px 300px at 100% 0%,rgba(243,128,32,.12),transparent 70%),var(--bg2)}
@media (max-width:860px){.signin{grid-template-columns:minmax(0,1fr);padding:24px;gap:24px}}
.signin .title{font-size:clamp(30px,3.6vw,42px)}
.auth{display:grid;gap:14px}
.or{display:flex;align-items:center;gap:12px;color:var(--dim);font-size:13px}.or::before,.or::after{content:"";flex:1;height:1px;background:var(--line)}
.auth form{display:grid;gap:12px}
.auth .btn{width:100%}
.tokensteps{margin:0;padding-left:20px;color:var(--muted);font-size:14.5px}.tokensteps li{margin:6px 0}
details.more summary{color:var(--muted);font-size:14px}
details.more .field{margin-top:10px}

.faq{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}
@media (max-width:860px){.faq{grid-template-columns:minmax(0,1fr)}}
.faq details{border:1px solid var(--line);border-radius:16px;padding:18px 20px;background:var(--bg2);transition:border-color 200ms ease}
.faq details[open]{border-color:var(--line2)}
.faq summary{font-weight:650;list-style:none;display:flex;justify-content:space-between;gap:12px}.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--accent);font-size:20px;line-height:1;transition:transform 200ms var(--ease-out)}.faq details[open] summary::after{transform:rotate(45deg)}
.faq p{margin:10px 0 0;color:var(--muted);font-size:15px}

@media (hover:hover) and (pointer:fine){
  .tile:hover,.step:hover{border-color:var(--line2);transform:translateY(-2px)}
  .faq details:hover{border-color:var(--line2)}
}
@media (prefers-reduced-motion:reduce){.ticket.mover{display:none}.tile:hover,.step:hover{transform:none}}
`;

const icon = (path: string) => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`);

const FEATURES = ['Public menu & QR ordering', 'Order board', 'Stock & recipes', 'Discounts', 'Staff shifts', 'Events & bookings', 'Telegram alerts', 'Finances', 'Backups', 'Your own domain'];

export function landing(params: { oauth: boolean; error?: string; message?: string }) {
  const signInHref = params.oauth ? '/connect/oauth' : '#start';
  return page(html`
${params.error || params.message ? html`<div class="wrap banner">${notice(params.error)}${notice(params.message, 'ok')}${params.error ? html`<a href="#start">Try again ↓</a>` : ''}</div>` : ''}
<header class="hero">
  <div class="glow"></div><div class="grain"></div>
  <div class="wrap">
    <div>
      <span class="eyebrow"><i class="dot ping"></i><b>Open source</b> · runs on the Cloudflare free plan</span>
      <h1 class="display hero-title">Your café, running on <em>your own</em> Cloudflare.</h1>
      <p class="lede">Menu, QR orders, stock, shifts, bookings and the books, in one app. Deploy it to your Cloudflare account in about a minute. You keep the data and the bill. We only keep a way to send you updates.</p>
      <div class="cta">
        <a class="btn cf" href="${signInHref}">${CLOUD} Sign in with Cloudflare</a>
        <a class="btn ghost" href="#demo">See it working ↓</a>
      </div>
      <p class="fine">No new account or password. You sign in with Cloudflare or an API token, and sign out whenever you like.</p>
    </div>

    <figure class="window force-dark" aria-label="Example: deploying a café called Corner Beans">
      <div class="bar"><i></i><i></i><i></i><span>cloud.chth.cafe · deploy</span></div>
      <div class="progress"><b></b></div>
      <div class="console">
        <div class="ln" style="--i:0"><span class="cmd">▸ Deploying “Corner Beans” to Corner Beans Ltd</span></div>
        <div class="ln" style="--i:1"><span class="ok">✓</span><span class="k">D1 database</span><span class="v">cafe-corner-beans-db</span></div>
        <div class="ln" style="--i:2"><span class="ok">✓</span><span class="k">KV namespace</span><span class="v">cafe-corner-beans-kv</span></div>
        <div class="ln" style="--i:3"><span class="ok">✓</span><span class="k">Demo menu</span><span class="v">24 items · 6 staff</span></div>
        <div class="ln" style="--i:4"><span class="ok">✓</span><span class="k">Assets</span><span class="v">uploaded 2 of 6, 4 already there</span></div>
        <div class="ln" style="--i:5"><span class="ok">✓</span><span class="k">Worker</span><span class="v">hourly cron · workers.dev</span></div>
        <div class="ln" style="--i:6"><span class="ok">●</span><span class="url">https://cafe-corner-beans.you.workers.dev</span></div>
        <div class="setup">
          <div>Choose your passwords<small>One-time setup link, never stored by us</small></div>
          <span class="pill live"><i class="dot ping"></i>Live</span>
        </div>
      </div>
    </figure>
  </div>
</header>

<div class="marquee" aria-hidden="true"><div class="belt">${[...FEATURES, ...FEATURES].map(f => html`<span>${f}</span>`)}</div></div>

<section class="band" id="demo">
  <div class="wrap">
    <div class="kicker">The product</div>
    <h2 class="display title">Everything behind the counter, in one place.</h2>
    <p class="sub">Every café gets the whole app: the menu guests order from, the board the bar works from, and the numbers you close the day with.</p>

    <div class="bento">
      <article class="tile span2 row2">
        <h3>A menu guests order from</h3>
        <p class="d">Guests scan the QR code at the table and order from their phone. Light and dark themes are built in.</p>
        <div class="phone" aria-hidden="true">
          <div class="screen">
            <i class="island"></i><div class="menu-hero"><div class="status"><span>9:41</span><span class="sys"><svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 16 12"><path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.3-1.4A10.6 10.6 0 0 0 8 .7 10.6 10.6 0 0 0 .7 3.6L2 5c1.6-1.5 3.7-2.4 6-2.4Zm0 3.7c1.3 0 2.5.5 3.4 1.3l1.3-1.4A6.8 6.8 0 0 0 8 4.4c-1.8 0-3.4.7-4.7 1.8l1.3 1.4c.9-.8 2.1-1.3 3.4-1.3Zm0 3.6c-.5 0-1 .2-1.4.5L8 11.9l1.4-1.5c-.4-.3-.9-.5-1.4-.5Z"/></svg><svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="2"/><path d="M24.5 4v4c.8-.3 1.5-1 1.5-2s-.7-1.7-1.5-2Z" opacity=".45"/></svg></span></div><b>Corner Beans</b><small>Table 4 · open until 19:00</small></div>
            <div class="chips"><span class="chip on">Coffee</span><span class="chip">Tea</span><span class="chip">Bakery</span><span class="chip">Cold</span></div>
            <div class="item"><span class="thumb" style="background:#f1dcc4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3v2M12 3v2"/></svg></span><div><b>Flat white</b><small>Double ristretto</small></div><span class="price">€3.80</span><span class="add">+</span></div>
            <div class="item tap"><span class="thumb" style="background:#e9e2cf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10l-1.5 15a2 2 0 0 1-2 1.8h-3a2 2 0 0 1-2-1.8L7 4Z"/><path d="M7.6 10h8.8"/></svg></span><div><b>Cortado</b><small>With oat milk</small></div><span class="price">€3.60</span><span class="add">+</span></div>
            <div class="item"><span class="thumb" style="background:#f6e0c8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15a8 6.5 0 0 1 16 0v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V15Z"/><path d="M9 11l.8 1.6M12.5 10.5l.3 1.8M16 11.5l-.6 1.6"/></svg></span><div><b>Cardamom bun</b><small>Baked today</small></div><span class="price">€3.20</span><span class="add">+</span></div>
            <div class="item"><span class="thumb" style="background:#dcebd9"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14Z"/><path d="M5 19l8-8"/></svg></span><div><b>Matcha</b><small>Whisked to order</small></div><span class="price">€4.40</span><span class="add">+</span></div>
            <div class="cart"><span><span class="n">3</span>View order</span><span>€10.60</span></div><i class="home"></i>
          </div>
        </div>
      </article>

      <article class="tile span4">
        <h3>An order board for the bar</h3>
        <p class="d">Orders from the tables, the counter and the panel show up together, and move along as you make them.</p>
        <div class="board" aria-hidden="true">
          <div class="col"><h4>New <span>2</span></h4><div class="ticket ghost"><b>#128 <span>T4</span></b><span>Flat white ×2</span></div><div class="ticket"><b>#131 <span>Counter</span></b><span>Matcha</span></div></div>
          <div class="col"><h4>Brewing <span>1</span></h4><div class="ticket ghost"><b>#128 <span>T4</span></b><span>Flat white ×2</span></div><div class="ticket"><b>#127 <span>T2</span></b><span>Cortado ×2</span></div></div>
          <div class="col"><h4>Ready <span>1</span></h4><div class="ticket ghost"><b>#128 <span>T4</span></b><span>Flat white ×2</span></div><div class="ticket"><b>#126 <span>T7</span></b><span>Flat white</span></div></div>
          <div class="ticket mover"><b>#128 <span>T4</span></b><span>Flat white ×2</span></div>
        </div>
      </article>

      <article class="tile span2 chart">
        <h3>Today’s sales</h3>
        <div class="num">€1,284.60</div><span class="delta">▲ 18% on last Friday</span>
        <svg viewBox="0 0 400 150" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.35"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
          ${raw([18, 30, 52, 80, 62, 96, 70, 44, 58, 90, 120, 100].map((h, i) => `<rect class="bar" x="${i * 33 + 6}" y="${150 - h}" width="22" height="${h}" rx="4"/>`).join(''))}
          <path class="area" d="M0 132 L40 120 L80 112 L120 86 L160 96 L200 64 L240 74 L280 58 L320 44 L360 36 L388 22 L388 150 L0 150 Z" fill="url(#g)"/>
          <path class="line" pathLength="1" d="M0 132 L40 120 L80 112 L120 86 L160 96 L200 64 L240 74 L280 58 L320 44 L360 36 L388 22"/>
          <circle class="halo" cx="388" cy="22" r="8"/><circle class="end" cx="388" cy="22" r="4.5"/>
        </svg>
        <div class="axis"><span>08:00</span><span>12:00</span><span>16:00</span><span>now</span></div>
      </article>

      <article class="tile span2">
        <h3>Stock that counts itself down</h3>
        <p class="d">Recipes take out what each drink uses, and the app tells you before something runs out.</p>
        <div aria-hidden="true">
          <div class="meter"><div class="top">Espresso beans <span>4.1 kg</span></div><div class="meter-bar"><b style="--w:72%;--i:0"></b></div></div>
          <div class="meter"><div class="top">Oat milk <span>9 L</span></div><div class="meter-bar"><b style="--w:46%;--i:1"></b></div></div>
          <div class="meter"><div class="top">Cardamom buns <span class="pill red">3 left · reorder</span></div><div class="meter-bar"><b class="low" style="--w:11%"></b></div></div>
        </div>
      </article>

      <article class="tile span3">
        <h3>The café texts you on Telegram</h3>
        <p class="d">New orders, low stock and new bookings arrive in your pocket, so you can step away from the screen.</p>
        <div class="chat" aria-hidden="true">
          <div class="bot"><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.5 3.5 2.8 10.7c-.9.4-.9 1.6.1 1.9l4.6 1.5 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.5 4.8 3.5c.6.4 1.4.1 1.6-.6l3.2-15.6c.2-.9-.7-1.6-1.6-1.4Z" fill="#fff"/><path d="m9.3 14 8.2-6.6" stroke="#1e96c8" stroke-width="1.4" stroke-linecap="round"/></svg></i> Corner Beans bot</div>
          <div class="bubble" style="--i:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="bi"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></svg><div><b>New order #128</b> · Table 4<br>2× Flat white, 1× Cardamom bun · €10.80<small>09:41</small></div></div>
          <div class="bubble" style="--i:1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="bi warn"><path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4M12 17h.01"/></svg><div><b>Cardamom buns</b> are running low: 3 left<small>09:42</small></div></div>
          <div class="bubble" style="--i:2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="bi"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg><div><b>Booking</b>: Latte art class, Sat 10:00 · 2 seats<small>09:45</small></div></div>
        </div>
      </article>

      <article class="tile span3">
        <h3>Shifts, events and bookings</h3>
        <p class="d">Plan who works when, run tastings and classes, and let guests book a seat.</p>
        <div class="plan" aria-hidden="true">
          <div class="shifts">
            <span class="who">Ana</span><div class="lane"><b style="--s:0%;--w:55%;--c:#e7a96b;--i:0"></b><i class="now"></i></div>
            <span class="who">Sam</span><div class="lane"><b style="--s:30%;--w:50%;--c:#7cc4ff;--i:1"></b></div>
            <span class="who">Rui</span><div class="lane"><b style="--s:50%;--w:50%;--c:#5fd3a0;--i:2"></b></div>
            <span class="who">Lea</span><div class="lane"><b style="--s:8%;--w:34%;--c:#c99bff;--i:3"></b></div>
            <div class="hours"><span>07</span><span>11</span><span>15</span><span>19</span></div>
          </div>
          <div>
            <div class="cal">${raw(['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span>${d}</span>`).join(''))}${raw(Array.from({ length: 14 }, (_, i) => `<i class="${i === 4 ? 'today' : [5, 9, 12].includes(i) ? 'ev' : ''}">${i + 3}</i>`).join(''))}</div>
            <div class="event"><span>Latte art · Sat</span><span class="seats"><i></i><i></i><i></i><i></i><i class="free"></i><i class="free"></i></span></div>
          </div>
        </div>
      </article>
    </div>
  </div>
</section>

<section class="band" id="how" style="background:var(--bg2);border-block:1px solid var(--line)">
  <div class="wrap">
    <div class="kicker">How it works</div>
    <h2 class="display title">From sign-in to the first order in three steps.</h2>
    <p class="sub">You don’t need a terminal, git or wrangler. If you can sign in to Cloudflare, you can run this.</p>
    <div class="steps">
      <div class="step"><h3>Sign in with Cloudflare</h3><p>Approve on Cloudflare’s own consent screen, or paste an API token made from our prefilled template. That one step is your whole sign-up.</p><div class="chipline"><span>Workers</span><span>D1</span><span>KV</span></div></div>
      <div class="step"><h3>Name your café and deploy</h3><p>We create the Worker, database and storage in your account. Use workers.dev, or your own domain with admin. and panel. subdomains.</p><div class="chipline"><span>~1 min</span><span>demo menu optional</span></div></div>
      <div class="step"><h3>Choose your passwords</h3><p>Open the one-time setup link and choose the admin and staff passwords. We never see them, and from there the café runs on its own.</p><div class="chipline"><span>one-click updates</span></div></div>
    </div>
  </div>
</section>

<section class="band" id="ownership">
  <div class="wrap">
    <div class="kicker">Ownership</div>
    <h2 class="display title">We deploy it. It lives in your account.</h2>
    <p class="sub">The café is a regular Worker in your Cloudflare account. If this site disappeared tomorrow, your café would keep serving.</p>
    <div class="flow">
      <div class="node"><small>You</small><b>Sign in</b><p>OAuth or an API token, that you can revoke at any time</p></div>
      <div class="wire" aria-hidden="true"></div>
      <div class="node"><small>Café Cloud</small><b>Deploys &amp; updates</b><p>Keeps your account name, encrypted access and your café list</p></div>
      <div class="wire" aria-hidden="true"></div>
      <div class="node yours"><small>Your Cloudflare account</small><b>Your café</b><p>Orders, menu, staff and money all stay here</p><div class="res"><span>Worker</span><span>D1</span><span>KV</span></div></div>
    </div>
    <div class="promises">
      <div class="promise">${icon('<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>')}<b>Encrypted access</b><p>Your Cloudflare access is stored AES-GCM encrypted and bound to your account.</p></div>
      <div class="promise">${icon('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><path d="M3 3l18 18"/>')}<b>Blind to passwords</b><p>You set the café’s passwords through a one-time link, and we keep no copy of it.</p></div>
      <div class="promise">${icon('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>')}<b>Updates in one click</b><p>New releases show up on your dashboard. Your data and secrets stay as they are.</p></div>
      <div class="promise">${icon('<path d="M9 18l6-6-6-6"/><path d="M4 12h11"/><path d="M20 4v16"/>')}<b>Leave anytime</b><p>Disconnect and the café keeps running. Or delete it and everything in it.</p></div>
    </div>
  </div>
</section>

<section class="band" id="start" style="padding-top:24px">
  <div class="wrap">
    <div class="signin">
      <div>
        <div class="kicker">Get started</div>
        <h2 class="display title">Sign in with the account your café will live in.</h2>
        <p class="sub" style="margin-bottom:0">There’s no separate sign-up. The Cloudflare account you sign in with is your account here, and anyone who can reach that account sees its cafés.</p>
      </div>
      <div class="auth">
        ${notice(params.error)}${notice(params.message, 'ok')}
        ${params.oauth ? html`<a class="btn cf" href="/connect/oauth">${CLOUD} Continue with Cloudflare</a><div class="or">or use an API token</div>` : ''}
        <ol class="tokensteps">
          <li><a href="${tokenTemplateUrl(false)}" target="_blank" rel="noopener">Create a token on Cloudflare</a>. The permissions come filled in: Workers Scripts, Workers KV Storage and D1 set to Edit, Account Settings set to Read.</li>
          <li>For your own domain, <a href="${tokenTemplateUrl(true)}" target="_blank" rel="noopener">use this template instead</a>. It adds Zone: Read and Workers Routes: Edit.</li>
        </ol>
        <form method="post" action="/connect/token">
          <label class="field">API token<input type="password" name="token" autocomplete="off" required maxlength="200" placeholder="Paste your token"></label>
          <details class="more"><summary>The token reaches more than one account?</summary>
            <label class="field">Account ID <span class="hint">32 hex characters, from the dashboard URL</span><input type="text" name="accountId" autocomplete="off" maxlength="64" pattern="[0-9a-f]{32}"></label>
          </details>
          <button class="btn ${params.oauth ? 'ghost' : 'cf'}" type="submit">Sign in with token</button>
        </form>
      </div>
    </div>
  </div>
</section>

<section class="band" id="faq" style="padding-top:40px">
  <div class="wrap">
    <div class="kicker">Questions</div>
    <h2 class="display title">Good to know</h2>
    <div class="faq">
      <details><summary>What does it cost?</summary><p>The software is free and open source. The café runs on your Cloudflare account, and the free plan is enough for one café. Whatever Cloudflare bills, it bills to you directly.</p></details>
      <details><summary>What can you see in my account?</summary><p>We can see what your token or consent allows: Workers, D1 and KV, and Zone and Routes if you add your own domain. We use that only to deploy, update or delete cafés when you ask. Every action goes in an audit log.</p></details>
      <details><summary>Why sign in with Cloudflare and not an email?</summary><p>Your café lives in your Cloudflare account anyway, so that account is your identity here. There’s no extra password for us to store or for you to lose.</p></details>
      <details><summary>What happens if I disconnect?</summary><p>We forget your access and sign you out everywhere. Your cafés keep running with all their data. Sign in again whenever you want one-click updates back.</p></details>
      <details><summary>Can I use my own domain?</summary><p>Yes. Give us a domain on a zone in your account, and the menu opens at the domain, the admin at admin. and the staff panel at panel.</p></details>
      <details><summary>Can I host it myself, without this site?</summary><p>Yes. Everything is on GitHub, and <code>wrangler deploy</code> gives you the same café.</p></details>
    </div>
  </div>
</section>
`, {
    title: 'Your café, on your own Cloudflare',
    description: 'Menu, orders, stock, staff and finances for your café, deployed in one click to your own Cloudflare account.',
    styles: STYLES,
    signInHref,
    links: html`<a href="#demo">Product</a><a href="#how">How it works</a><a href="#ownership">Ownership</a><a href="#faq">FAQ</a>`
  });
}
