/* Photo viewer shared by every page.
 *
 * Any photo on the site opens full screen here: scroll or pinch to zoom, drag
 * to pan, arrow keys to move through the set it belongs to. Photos are grouped
 * by the block they sit in, so the arrows stay within one house's set.
 */
(function () {
  'use strict';

  // Blocks whose images belong together, in the order the arrows should follow.
  var GROUPS = ['.shots', '.forsale-grid', '.projects-featured', '.projects-row',
                '.fontana-grid', '.gallery-grid', '.hero-gallery-grid'];

  var css = [
    '.zoomable{cursor:zoom-in}',
    '.pv{position:fixed;inset:0;background:rgba(8,8,10,0.94);display:none;z-index:4000;',
    '  opacity:0;transition:opacity 0.18s ease;touch-action:none;}',
    '.pv.on{display:block}',
    '.pv.shown{opacity:1}',
    '.pv-stage{position:absolute;inset:0;overflow:hidden;display:flex;align-items:center;justify-content:center}',
    '.pv-img{max-width:92vw;max-height:86vh;object-fit:contain;user-select:none;-webkit-user-drag:none;',
    '  transform-origin:center center;transition:transform 0.18s ease;will-change:transform;cursor:zoom-in}',
    '.pv-img.zoomed{cursor:grab;transition:none}',
    '.pv-img.dragging{cursor:grabbing;transition:none}',
    '.pv-btn{position:absolute;background:rgba(255,255,255,0.14);color:#fff;border:none;cursor:pointer;',
    '  font-family:inherit;line-height:1;border-radius:4px;padding:13px 17px;font-size:20px;',
    '  transition:background 0.15s;z-index:2}',
    '.pv-btn:hover{background:rgba(255,255,255,0.28)}',
    '.pv-close{top:18px;right:18px;font-size:16px;padding:11px 14px}',
    '.pv-prev{left:18px;top:50%;transform:translateY(-50%)}',
    '.pv-next{right:18px;top:50%;transform:translateY(-50%)}',
    '.pv-bar{position:absolute;left:0;right:0;bottom:18px;text-align:center;color:rgba(255,255,255,0.8);',
    '  font-size:12px;letter-spacing:0.06em;pointer-events:none;padding:0 90px;z-index:2}',
    '.pv-count{display:block;color:rgba(255,255,255,0.45);font-size:11px;margin-top:5px}',
    '.pv-hint{position:absolute;top:22px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.45);',
    '  font-size:11px;letter-spacing:0.08em;text-transform:uppercase;pointer-events:none;z-index:2}',
    '@media (max-width:700px){.pv-btn{padding:10px 13px;font-size:17px}.pv-bar{padding:0 60px}.pv-hint{display:none}}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var box = document.createElement('div');
  box.className = 'pv';
  box.innerHTML =
    '<div class="pv-stage"><img class="pv-img" alt=""></div>' +
    '<div class="pv-hint">Scroll to zoom</div>' +
    '<button class="pv-btn pv-close" aria-label="Close">&#10005;</button>' +
    '<button class="pv-btn pv-prev" aria-label="Previous">&#8249;</button>' +
    '<button class="pv-btn pv-next" aria-label="Next">&#8250;</button>' +
    '<div class="pv-bar"><span class="pv-cap"></span><span class="pv-count"></span></div>';
  document.body.appendChild(box);

  var stage = box.querySelector('.pv-stage');
  var img = box.querySelector('.pv-img');
  var cap = box.querySelector('.pv-cap');
  var count = box.querySelector('.pv-count');
  var prevBtn = box.querySelector('.pv-prev');
  var nextBtn = box.querySelector('.pv-next');

  var set = [];        // the photos the arrows move through
  var at = 0;
  var scale = 1, tx = 0, ty = 0;
  var MIN = 1, MAX = 5;

  function apply() {
    img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    img.classList.toggle('zoomed', scale > 1);
  }

  function reset() { scale = 1; tx = 0; ty = 0; apply(); }

  function show() {
    var el = set[at];
    img.src = el.currentSrc || el.src;
    img.alt = el.alt || '';
    cap.textContent = el.dataset.caption || el.alt || '';
    count.textContent = set.length > 1 ? (at + 1) + ' of ' + set.length : '';
    prevBtn.hidden = nextBtn.hidden = set.length < 2;
    reset();
  }

  function open(el) {
    var group = null;
    for (var i = 0; i < GROUPS.length && !group; i++) group = el.closest(GROUPS[i]);
    set = group ? [].slice.call(group.querySelectorAll('img.zoomable')) : [el];
    at = Math.max(0, set.indexOf(el));
    show();
    box.classList.add('on');
    requestAnimationFrame(function () { box.classList.add('shown'); });
    document.body.style.overflow = 'hidden';
  }

  function close() {
    box.classList.remove('shown');
    document.body.style.overflow = '';
    setTimeout(function () { box.classList.remove('on'); img.removeAttribute('src'); }, 180);
  }

  function step(n) { at = (at + n + set.length) % set.length; show(); }

  // Zoom toward the pointer so the spot under the cursor stays put.
  function zoomAt(factor, cx, cy) {
    var next = Math.min(MAX, Math.max(MIN, scale * factor));
    if (next === scale) return;
    var r = img.getBoundingClientRect();
    var ox = cx - (r.left + r.width / 2);
    var oy = cy - (r.top + r.height / 2);
    var ratio = next / scale;
    tx = tx - ox * (ratio - 1);
    ty = ty - oy * (ratio - 1);
    scale = next;
    if (scale === MIN) { tx = 0; ty = 0; }
    apply();
  }

  stage.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX, e.clientY);
  }, { passive: false });

  img.addEventListener('dblclick', function (e) {
    e.preventDefault();
    if (scale > 1) reset(); else zoomAt(2.2, e.clientX, e.clientY);
  });

  // Drag to pan once zoomed in.
  var dragging = false, sx = 0, sy = 0;
  img.addEventListener('pointerdown', function (e) {
    if (scale <= 1) return;
    dragging = true; sx = e.clientX - tx; sy = e.clientY - ty;
    img.classList.add('dragging');
    img.setPointerCapture(e.pointerId);
  });
  img.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    tx = e.clientX - sx; ty = e.clientY - sy; apply();
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    img.addEventListener(ev, function () { dragging = false; img.classList.remove('dragging'); });
  });

  // Pinch to zoom on touch.
  var pinch = 0;
  stage.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) pinch = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  stage.addEventListener('touchmove', function (e) {
    if (e.touches.length !== 2 || !pinch) return;
    e.preventDefault();
    var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                       e.touches[0].clientY - e.touches[1].clientY);
    zoomAt(d / pinch, (e.touches[0].clientX + e.touches[1].clientX) / 2,
                      (e.touches[0].clientY + e.touches[1].clientY) / 2);
    pinch = d;
  }, { passive: false });
  stage.addEventListener('touchend', function () { pinch = 0; }, { passive: true });

  // Clicking the backdrop closes; clicking the photo at 1x does nothing.
  stage.addEventListener('click', function (e) { if (e.target === stage) close(); });
  box.querySelector('.pv-close').addEventListener('click', close);
  prevBtn.addEventListener('click', function () { step(-1); });
  nextBtn.addEventListener('click', function () { step(1); });

  document.addEventListener('keydown', function (e) {
    if (!box.classList.contains('on')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === '+' || e.key === '=') zoomAt(1.3, innerWidth / 2, innerHeight / 2);
    else if (e.key === '-') zoomAt(1 / 1.3, innerWidth / 2, innerHeight / 2);
    else if (e.key === '0') reset();
  });

  // Every photo on the page opens the viewer. The nav logo is text, and the
  // viewer's own image must not re-trigger it.
  function arm() {
    var imgs = document.querySelectorAll('img:not(.pv-img):not(.zoomable)');
    [].forEach.call(imgs, function (el) {
      el.classList.add('zoomable');
      var hit = el.closest('.project-card') || el;   // cards have text over the photo
      hit.style.cursor = 'zoom-in';
      hit.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;           // let real links win
        e.preventDefault();
        open(el);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arm);
  else arm();
})();
