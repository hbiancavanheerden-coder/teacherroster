// Small, dependency-free motion helpers. All respect prefers-reduced-motion via CSS.
import { useEffect, useRef, useState } from 'react';

// Adds `.in` to every `.reveal` element inside the returned ref when it scrolls into view.
export function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const els = root.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return undefined; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return ref;
}

// Headline that blurs in word by word. Children: a string, optionally with *emphasis*.
export function Words({ text, delay = 0, step = 70 }) {
  const parts = text.split(/(\*[^*]+\*)/).filter(Boolean);
  let i = 0;
  return (
    <span className="words" aria-label={text.replace(/\*/g, '')}>
      {parts.map((p, pi) => {
        const em = p.startsWith('*');
        const words = (em ? p.slice(1, -1) : p).split(/(\s+)/);
        const nodes = words.map((w, wi) => (/^\s+$/.test(w) ? w : (
          <span key={wi} aria-hidden="true" style={{ animationDelay: `${delay + step * i++}ms` }}>{w}</span>
        )));
        return em ? <em key={pi}>{nodes}</em> : <span key={pi} style={{ display: 'contents' }}>{nodes}</span>;
      })}
    </span>
  );
}

// Number that counts up when it scrolls into view.
export function CountUp({ to, prefix = '', suffix = '', duration = 1400, decimals = 0 }) {
  const ref = useRef(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setV(to); return undefined; }
    let raf;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        setV(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration]);
  return <span ref={ref}>{prefix}{v.toLocaleString('en-ZA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

// Mouse-follow spotlight: sets --x/--y on the element.
export function spotlight(e) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`);
}
