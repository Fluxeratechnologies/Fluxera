const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const scenes = JSON.parse(fs.readFileSync(path.join(root, 'timed-scenes.json'), 'utf8'));
if (scenes.length !== 12) throw new Error(`Expected 12 narrated scenes, found ${scenes.length}`);
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const n = value => Number(value).toFixed(3);
const stamp = value => {
  const [h, m, s] = value.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
};
const cues = [...fs.readFileSync(path.join(root, 'walkthrough.vtt'), 'utf8').matchAll(/(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})\n([^\n]+)/g)]
  .map(([, start, end, text]) => ({ start: stamp(start), end: stamp(end), text }));
let at = 0;
const shotMarkup = [];
const audioMarkup = [];
const animation = [];
for (let i = 0; i < scenes.length; i++) {
  const scene = scenes[i];
  const closing = i === scenes.length - 1;
  const duration = closing ? Math.max(scene.duration, 13) : scene.duration;
  scene.start = at;
  scene.duration = duration;
  const shotDuration = closing ? Math.min(4.9, duration - 4) : duration + .38;
  shotMarkup.push(`<section id="shot-${i}" class="clip shot" data-start="${n(at)}" data-duration="${n(shotDuration)}" data-track-index="0" aria-label="${esc(scene.title)}">
    <div class="screen-wrap"${scene.id === 'approval' ? ' data-layout-allow-overflow="true"' : ''}><img src="${esc(scene.image)}" alt="Illustrative synthetic Fluxera dashboard: ${esc(scene.title)}"></div>
    <div class="chapter"><span class="chapter-number">${String(i + 1).padStart(2, '0')} / 12</span><span class="chapter-bar"></span><span>${esc(scene.title)}</span></div>
  </section>`);
  if (scene.id === 'approval') {
    const cursorAt = at + 2;
    shotMarkup.push(`<div id="approval-cursor" class="clip demo-cursor" data-start="${n(cursorAt)}" data-duration="${n(Math.min(5.8, duration - 2.2))}" data-track-index="4" aria-hidden="true"><svg viewBox="0 0 36 44"><path d="M4 3v32l9-9 7 15 7-4-7-15h13Z" fill="#D9541E" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg><i></i></div>`);
    animation.push(`tl.fromTo('#approval-cursor', {x:1260,y:570,opacity:0}, {x:1260,y:570,opacity:1,duration:.18}, ${n(cursorAt)});`);
    animation.push(`tl.to('#approval-cursor', {x:1654,y:348,duration:1.18,ease:'power2.inOut'}, ${n(cursorAt + .3)});`);
    animation.push(`tl.fromTo('#approval-cursor i', {scale:.2,opacity:.7}, {scale:2.2,opacity:0,duration:.55,ease:'power2.out'}, ${n(cursorAt + 1.63)});`);
  }
  const sceneCues = cues.filter(cue => cue.start >= at - 0.01 && cue.start < at + scene.audioDuration + 0.4);
  sceneCues.forEach((cue, part) => {
    const capStart = cue.start;
    const capDuration = cue.end - cue.start;
    const caption = cue.text;
    shotMarkup.push(`<div id="caption-${i}-${part}" class="clip caption" data-start="${n(capStart)}" data-duration="${n(capDuration)}" data-track-index="2" data-layout-allow-caption-zone="true"><span>${esc(caption)}</span></div>`);
    animation.push(`tl.fromTo('#caption-${i}-${part}', {opacity:0, y:18}, {opacity:1, y:0, duration:.28, ease:'power2.out'}, ${n(capStart)});`);
  });
  audioMarkup.push(`<audio id="voice-${i}" src="${esc(scene.audio)}" data-start="${n(at)}" data-duration="${n(scene.audioDuration)}" data-track-index="3" data-volume="1"></audio>`);
  animation.push(`tl.fromTo('#shot-${i}', {opacity:0}, {opacity:1, duration:.34, ease:'power2.out'}, ${n(at)});`);
  if (scene.id === 'approval') animation.push(`tl.fromTo('#shot-${i} .screen-wrap', {scale:1}, {scale:1.12, duration:${n(Math.max(2.4, shotDuration - 2))}, ease:'power1.inOut'}, ${n(at + .65)});`);
  else animation.push(`tl.fromTo('#shot-${i} .screen-wrap', {scale:1.015}, {scale:1, duration:${n(shotDuration)}, ease:'none'}, ${n(at)});`);
  if (closing) {
    const powerOff = at + shotDuration - .65;
    const logoAt = at + shotDuration;
    shotMarkup.push(`<section id="end-card" class="clip end-card" data-start="${n(logoAt)}" data-duration="${n(duration - shotDuration)}" data-track-index="1">
      <div class="end-mark"><svg viewBox="0 0 36 36" role="img" aria-label="Fluxera mark"><rect x="1" y="1" width="34" height="34" rx="7" fill="#E7DFD1"/><path d="M8 7h19v6H14v5h9v6h-9v5H8Z" fill="#111111"/><rect x="23" y="18" width="6" height="6" fill="#D9541E"/></svg></div>
      <div class="end-name">Fluxera<span class="end-period">.</span></div>
      <div class="end-line">Observe. Approve. Recover. Verify.</div>
      <div class="end-url">getfluxera.com</div>
    </section>`);
    shotMarkup.push(`<div id="power-line" class="clip power-line" data-start="${n(powerOff)}" data-duration="1.1" data-track-index="4" aria-hidden="true"><i></i></div>`);
    animation.push(`tl.to('#shot-${i} .screen-wrap', {scaleY:.008, filter:'brightness(4)', duration:.26, ease:'power3.in'}, ${n(powerOff)});`);
    animation.push(`tl.to('#shot-${i} .screen-wrap', {scaleX:0, opacity:0, duration:.2, ease:'power3.in'}, ${n(powerOff + .27)});`);
    animation.push(`tl.fromTo('#power-line i', {scaleX:1, opacity:1}, {scaleX:0, opacity:0, duration:.42, ease:'power3.in'}, ${n(powerOff + .22)});`);
    animation.push(`tl.fromTo('#end-card', {opacity:0}, {opacity:1, duration:.38, ease:'power2.out'}, ${n(logoAt)});`);
    animation.push(`tl.fromTo('#end-card .end-mark', {scale:.88, opacity:0}, {scale:1, opacity:1, duration:.48, ease:'power3.out'}, ${n(logoAt + .12)});`);
    animation.push(`tl.fromTo('#end-card .end-name', {y:25, opacity:0}, {y:0, opacity:1, duration:.46, ease:'power3.out'}, ${n(logoAt + .32)});`);
    animation.push(`tl.fromTo('#end-card .end-url', {opacity:0}, {opacity:1, duration:.5, ease:'power2.out'}, ${n(logoAt + 1.15)});`);
  }
  at += duration;
}
const total = n(at);
const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=1920,height=1080"><title>Fluxera — Dashboard walkthrough</title>
<script src="assets/gsap.min.js"></script>
<style>
*{box-sizing:border-box}html,body{width:1920px;height:1080px;margin:0;background:#111;color:#f3eee3;overflow:hidden;font-family:Inter,Arial,Helvetica,sans-serif}
#root{position:relative;width:100%;height:100%;overflow:hidden;background:radial-gradient(circle at 50% 35%,#252421 0,#111 69%)}
.clip{position:absolute}.shot{inset:0;overflow:hidden}.screen-wrap{position:absolute;left:132px;top:74px;width:1656px;height:932px;border:1px solid #494744;border-radius:20px;overflow:hidden;transform-origin:50% 50%;box-shadow:0 36px 90px #0009;background:#f3eee3}.screen-wrap img{display:block;width:100%;height:100%;object-fit:cover}
#shot-4 .screen-wrap{transform-origin:50% 25%}
.chapter{position:absolute;left:178px;top:108px;display:flex;align-items:center;gap:18px;padding:15px 22px;border-radius:12px;background:#111;color:#fff;font-size:31px;line-height:1.2;letter-spacing:-.035em;font-weight:650;box-shadow:0 10px 25px #0008}.chapter-number{font:600 28px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;color:#ffad86}.chapter-bar{width:37px;height:2px;background:#d9541e}
.caption{left:255px;right:255px;bottom:127px;display:flex;justify-content:center;text-align:center;z-index:9;pointer-events:none}.caption span{display:inline-block;max-width:1430px;padding:20px 30px 22px;border-radius:14px;color:#fff;font-size:36px;line-height:1.26;font-weight:560;letter-spacing:-.02em;background:#111e;box-shadow:0 16px 45px #0007;text-shadow:0 2px 5px #0005}
.synthetic{position:absolute;left:178px;bottom:10px;color:#d8d1c6;font:600 28px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.03em;z-index:10}.brand-rail{position:absolute;right:179px;bottom:15px;color:#d9541e;font-size:28px;font-weight:720;letter-spacing:-.035em;z-index:10}
.end-card{inset:0;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.end-mark svg{width:115px;height:115px}.end-name{font-size:122px;line-height:1.05;font-weight:730;letter-spacing:-.07em;margin-top:30px}.end-period{color:#d9541e}.end-line{font-size:27px;color:#d7d1c7;letter-spacing:-.01em;margin-top:17px}.end-url{font:600 32px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e36b39;margin-top:80px;letter-spacing:.025em}
.demo-cursor{left:0;top:0;width:42px;height:48px;z-index:15;pointer-events:none;filter:drop-shadow(0 3px 5px #0008)}.demo-cursor svg{width:36px;height:44px}.demo-cursor i{display:block;position:absolute;left:-13px;top:-13px;width:70px;height:70px;border:3px solid #d9541e;border-radius:50%;opacity:0}
.power-line{inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}.power-line i{width:1540px;height:3px;background:#f3eee3;box-shadow:0 0 14px 7px #f3eee3a0,0 0 55px 20px #d9541e88;display:block}
</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1920" data-height="1080">
${shotMarkup.join('\n')}
<div class="synthetic">ILLUSTRATIVE SYNTHETIC DATA · NO CUSTOMER SYSTEMS</div><div class="brand-rail">F<span style="color:#f3eee3">LUXERA</span></div>
${audioMarkup.join('\n')}
</div><script>
const tl=gsap.timeline({paused:true});
${animation.join('\n')}
window.__timelines['main']=tl;
tl.seek(0);
</script></body></html>`;
fs.writeFileSync(path.join(root, 'index.html'), html.replaceAll('ui-monospace,SFMono-Regular,Menlo,monospace', 'monospace'));
fs.writeFileSync(path.join(root, 'render-manifest.json'), JSON.stringify({ totalDuration: at, scenes: scenes.map(({ id, start, duration, audioDuration, title }) => ({ id, start, duration, audioDuration, title })) }, null, 2));
console.log(`Built ${scenes.length} shots, ${total} seconds`);
