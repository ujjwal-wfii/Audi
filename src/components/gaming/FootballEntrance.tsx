"use client";

import { useEffect, useRef } from "react";

/**
 * FootballEntrance
 * Full-screen overlay packed with realistic footballs. After a short hold the
 * balls drop away (bottom first) and reveal the page underneath.
 * No image files needed: the ball is drawn once on an offscreen canvas.
 */

const SIZE = 256;
const R = SIZE / 2;

// ---- tweak these -----------------------------------------------------------
const HOLD_SECONDS = 0.4; // how long the screen stays full of balls
const SPREAD_SECONDS = 0.5; // how long the drop takes to sweep the screen
const BACKDROP_COLOR = "#02030f"; // dark colour behind the balls
// ---------------------------------------------------------------------------

type Sprites = { body: HTMLCanvasElement; pattern: HTMLCanvasElement; gloss: HTMLCanvasElement };

type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  delay: number;
};

function makeCanvas() {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  return c;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

function buildSprites(): Sprites {
  // 1) white body with soft base shading (does NOT rotate)
  const body = makeCanvas();
  {
    const ctx = body.getContext("2d")!;
    ctx.translate(R, R);
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.6, "#ececec");
    g.addColorStop(1, "#b8b8b8");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R - 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2) black pentagons + seams (this layer rotates)
  const pattern = makeCanvas();
  {
    const ctx = pattern.getContext("2d")!;
    ctx.translate(R, R);
    ctx.beginPath();
    ctx.arc(0, 0, R - 1, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = "#2a2a2a";
    ctx.fillStyle = "#101010";
    ctx.lineWidth = 3.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // centre pentagon
    const cr = R * 0.36;
    const centre: [number, number][] = [];
    for (let j = 0; j < 5; j++) {
      const a = rad(-90 + 72 * j);
      centre.push([Math.cos(a) * cr, Math.sin(a) * cr]);
    }

    // five outer pentagons, squashed along the radius to fake the curvature
    const dist = R * 0.92;
    const pr = R * 0.36;
    const squash = 0.6;
    const outer: { pts: [number, number][]; cx: number; cy: number }[] = [];
    for (let k = 0; k < 5; k++) {
      const ang = rad(-90 + 72 * k);
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const pts: [number, number][] = [];
      for (let j = 0; j < 5; j++) {
        const phi = rad(180 + 72 * j); // vertex 0 faces the centre
        const lx = Math.cos(phi) * pr * squash;
        const ly = Math.sin(phi) * pr;
        pts.push([dist * cos + lx * cos - ly * sin, dist * sin + lx * sin + ly * cos]);
      }
      outer.push({ pts, cx: dist * cos, cy: dist * sin });
    }

    const line = (a: [number, number], b: [number, number]) => {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    };

    // seams: centre vertex -> outer pentagon inner vertex
    for (let k = 0; k < 5; k++) line(centre[k], outer[k].pts[0]);

    // seams: join neighbouring outer pentagons (forms the hexagons)
    for (let k = 0; k < 5; k++) {
      const next = outer[(k + 1) % 5];
      const cur = outer[k];
      const nearest = (p: typeof cur, tx: number, ty: number) =>
        [p.pts[1], p.pts[4]].sort(
          (a, b) => Math.hypot(a[0] - tx, a[1] - ty) - Math.hypot(b[0] - tx, b[1] - ty)
        )[0];
      line(nearest(cur, next.cx, next.cy), nearest(next, cur.cx, cur.cy));
    }

    // short seams leaving the far vertices toward the edge
    for (const o of outer) {
      for (const j of [2, 3]) {
        const [px, py] = o.pts[j];
        const len = Math.hypot(px, py) || 1;
        line([px, py], [px + (px / len) * R * 0.25, py + (py / len) * R * 0.25]);
      }
    }

    // fill patches last so seams tuck underneath
    const fillPoly = (pts: [number, number][]) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    fillPoly(centre);
    outer.forEach((o) => fillPoly(o.pts));
  }

  // 3) glossy lighting on top (does NOT rotate, so light stays fixed)
  const gloss = makeCanvas();
  {
    const ctx = gloss.getContext("2d")!;
    ctx.translate(R, R);
    const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.04, 0, 0, R);
    g.addColorStop(0, "rgba(255,255,255,0.75)");
    g.addColorStop(0.2, "rgba(255,255,255,0.0)");
    g.addColorStop(0.55, "rgba(0,0,0,0)");
    g.addColorStop(0.85, "rgba(0,0,0,0.28)");
    g.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R - 1, 0, Math.PI * 2);
    ctx.fill();
  }

  return { body, pattern, gloss };
}

function buildBalls(w: number, h: number): Ball[] {
  const base = Math.min(80, Math.max(40, w / 14));
  const step = base * 0.72;
  const balls: Ball[] = [];
  let row = 0;
  for (let y = -step; y < h + step * 1.5; y += step, row++) {
    const offset = row % 2 ? step / 2 : 0;
    for (let x = -step + offset; x < w + step * 1.5; x += step) {
      const r = (base / 2) * (0.88 + Math.random() * 0.34);
      const yy = y + (Math.random() - 0.5) * step * 0.5;
      const progress = 1 - Math.min(1, Math.max(0, yy / h)); // bottom balls go first
      balls.push({
        x: x + (Math.random() - 0.5) * step * 0.5,
        y: yy,
        vx: (Math.random() - 0.5) * w * 0.12,
        vy: 0,
        r,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 6,
        delay: HOLD_SECONDS + progress * SPREAD_SECONDS + Math.random() * 0.25,
      });
    }
  }
  // small balls first so bigger ones overlap them
  return balls.sort((a, b) => a.r - b.r);
}

export default function FootballEntrance({ onDone }: { onDone: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onDoneRef.current();
      return;
    }

    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const sprites = buildSprites();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let w = window.innerWidth;
    let h = window.innerHeight;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
    };
    resize();
    window.addEventListener("resize", resize);

    const balls = buildBalls(w, h);
    const gravity = h * 2.4;

    let raf = 0;
    let last = performance.now();
    let t = 0;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      onDoneRef.current();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      let alive = 0;
      for (const b of balls) {
        if (t >= b.delay) {
          b.vy += gravity * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.rot += b.vr * dt;
        }
        if (b.y - b.r > h) continue;
        alive++;
        if (b.x + b.r < 0 || b.x - b.r > w) continue;

        const d = b.r * 2;
        ctx.drawImage(sprites.body, b.x - b.r, b.y - b.r, d, d);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.drawImage(sprites.pattern, -b.r, -b.r, d, d);
        ctx.restore();
        ctx.drawImage(sprites.gloss, b.x - b.r, b.y - b.r, d, d);
      }

      // dark backdrop (seen through the gaps) fades out after the hold
      const fade = Math.min(1, Math.max(0, (t - HOLD_SECONDS) / (SPREAD_SECONDS + 0.4)));
      wrap.style.background = `rgba(2,3,15,${1 - fade})`;

      if (alive === 0) {
        finish();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      onClick={() => onDoneRef.current()} // click anywhere to skip
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: BACKDROP_COLOR,
        cursor: "pointer",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}