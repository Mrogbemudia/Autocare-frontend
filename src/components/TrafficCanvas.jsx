import { useEffect, useRef } from 'react';

const TYPES = {
  danfo: { w: 62, h: 24, kind: 'danfo' },
  hilux: { w: 50, h: 22, kind: 'hilux' },
  sedan: { w: 44, h: 20, kind: 'sedan' },
};
const COLORS = ['#2563EB', '#DC2626', '#475569', '#059669', '#7C3AED'];
const POINTER_RADIUS = 88;
const SAFE_GAP = 44;
const BRAKE_RATE = 64;

function rnd(min, max) {
  return min + Math.random() * (max - min);
}

function drawVehicle(ctx, vehicle) {
  const { w, h, kind } = vehicle.type;
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  if (vehicle.direction < 0) ctx.scale(-1, 1);

  ctx.fillStyle = kind === 'danfo' ? '#FACC15' : kind === 'hilux' ? '#F8FAFC' : vehicle.color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 5);
  ctx.fill();

  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(w * 0.12, -h / 2 + 4, w * 0.22, h - 8, 2);
  ctx.fill();
  ctx.fillRect(-w / 2 - 1, -h / 2 + 4, 3, 5);
  ctx.fillRect(-w / 2 - 1, h / 2 - 9, 3, 5);

  if (vehicle.braking) {
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(-w / 2 - 2, -h / 2 + 3, 4, 5);
  }
  ctx.restore();
}

export default function TrafficCanvas({ paused = false, variant = 'hero', className = '' }) {
  const canvasRef = useRef(null);
  const pausedRef = useRef(paused);
  const controlsRef = useRef({ start: () => {}, stop: () => {} });

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas.parentElement;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: -Infinity, y: -Infinity };
    let reduced = media.matches;
    let width = 0;
    let height = 0;
    let frameId = 0;
    let lastTime = 0;
    let vehicles = [];
    let lanes = [];
    let colors = {};

    const readTheme = () => {
      const style = getComputedStyle(document.documentElement);
      colors = {
        road: style.getPropertyValue('--k-road').trim() || '#E2E8F0',
        line: style.getPropertyValue('--k-line').trim() || '#64748B',
      };
    };

    const vehicleNames = variant === 'how'
      ? ['sedan', 'danfo', 'hilux', 'sedan']
      : variant === 'pipeline'
        ? ['hilux', 'sedan', 'danfo', 'hilux', 'sedan']
        : ['danfo', 'sedan', 'hilux', 'danfo', 'sedan'];

    const build = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(bounds.width, 1);
      height = Math.max(bounds.height, 1);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const laneCount = Math.max(1, Math.min(2, Math.floor(height / 44)));
      const laneHeight = height / laneCount;
      const count = Math.max(2, Math.min(6, Math.floor(width / 170)));
      lanes = Array.from({ length: laneCount }, (_, index) => ({
        y: laneHeight * (index + 0.5),
        direction: index % 2 === 0 ? 1 : -1,
      }));

      vehicles = lanes.flatMap((lane, laneIndex) =>
        Array.from({ length: count }, (_, index) => {
          const type = TYPES[vehicleNames[(laneIndex * count + index) % vehicleNames.length]];
          return {
            type,
            lane: laneIndex,
            direction: lane.direction,
            x: width * (index / count),
            y: lane.y,
            speed: rnd(24, 34),
            maximum: rnd(32, 42),
            braking: false,
            color: COLORS[(laneIndex * count + index) % COLORS.length],
          };
        }),
      );
      readTheme();
      render();
    };

    const render = () => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = colors.road || '#E2E8F0';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = colors.line || '#64748B';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, 1);
      context.lineTo(width, 1);
      context.moveTo(0, height - 1);
      context.lineTo(width, height - 1);
      context.stroke();

      if (lanes.length > 1) {
        context.setLineDash([14, 10]);
        context.beginPath();
        context.moveTo(0, height / 2);
        context.lineTo(width, height / 2);
        context.stroke();
        context.setLineDash([]);
      }
      vehicles.forEach((vehicle) => drawVehicle(context, vehicle));
    };

    const step = (delta) => {
      const bounds = host.getBoundingClientRect();
      const pointerX = pointer.x - bounds.left;
      const pointerY = pointer.y - bounds.top;
      vehicles.forEach((vehicle) => {
        let target = vehicle.maximum;
        const pointerInside = pointerX >= 0 && pointerX <= width && pointerY >= 0 && pointerY <= height;
        const rawPointerDx = Math.abs(pointerX - vehicle.x);
        const pointerDx = Math.min(rawPointerDx, width - rawPointerDx);
        const pointerDistance = pointerInside
          ? Math.hypot(pointerDx, pointerY - vehicle.y)
          : Infinity;

        if (pointerDistance < POINTER_RADIUS) {
          target = Math.min(
            target,
            vehicle.maximum * Math.max(0, (pointerDistance - 20) / (POINTER_RADIUS - 20)),
          );
        }

        let nearestGap = Infinity;
        let leader = null;
        for (const other of vehicles) {
          if (other === vehicle || other.lane !== vehicle.lane) continue;
          const distance = vehicle.direction > 0
            ? (other.x - vehicle.x + width) % width
            : (vehicle.x - other.x + width) % width;
          const gap = distance - (vehicle.type.w + other.type.w) / 2;
          if (gap >= 0 && gap < nearestGap) {
            nearestGap = gap;
            leader = other;
          }
        }

        if (leader && nearestGap < SAFE_GAP * 2) {
          const gapSpeed = leader.speed * Math.max(0, (nearestGap - 8) / (SAFE_GAP - 8));
          target = Math.min(target, leader.speed, gapSpeed);
        } else if (leader && nearestGap < SAFE_GAP * 3) {
          target = Math.min(target, leader.speed);
        }

        vehicle.braking = target < vehicle.speed;
        const acceleration = vehicle.braking ? BRAKE_RATE : 14;
        vehicle.speed += Math.sign(target - vehicle.speed) * Math.min(
          Math.abs(target - vehicle.speed),
          acceleration * delta,
        );
        vehicle.x = (vehicle.x + vehicle.direction * vehicle.speed * delta + width) % width;
      });
    };

    const frame = (time) => {
      frameId = requestAnimationFrame(frame);
      const delta = Math.min((time - lastTime) / 1000 || 0, 0.05);
      lastTime = time;
      if (!pausedRef.current && !reduced) {
        step(delta);
        render();
      }
    };

    const start = () => {
      if (!frameId && !reduced && !pausedRef.current) {
        lastTime = performance.now();
        frameId = requestAnimationFrame(frame);
      }
    };
    const stop = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      render();
    };
    const updateReduced = (event) => {
      reduced = event.matches;
      if (reduced || pausedRef.current) stop();
      else start();
    };
    const onPointerMove = (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };
    const clearPointer = () => {
      pointer.x = -Infinity;
      pointer.y = -Infinity;
    };
    const themeObserver = new MutationObserver(() => {
      readTheme();
      render();
    });

    build();
    controlsRef.current = { start, stop };
    if (reduced || pausedRef.current) render();
    else start();

    const resizeObserver = new ResizeObserver(build);
    resizeObserver.observe(host);
    if (media.addEventListener) media.addEventListener('change', updateReduced);
    else media.addListener(updateReduced);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('blur', clearPointer);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    return () => {
      stop();
      controlsRef.current = { start: () => {}, stop: () => {} };
      resizeObserver.disconnect();
      if (media.removeEventListener) media.removeEventListener('change', updateReduced);
      else media.removeListener(updateReduced);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('blur', clearPointer);
      themeObserver.disconnect();
    };
  }, [variant]);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) controlsRef.current.stop();
    else controlsRef.current.start();
  }, [paused]);

  return (
    <div className={`relative isolate min-h-16 overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}
