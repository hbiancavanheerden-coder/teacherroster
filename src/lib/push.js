// Browser side of free push notifications + "install to home screen".
import { api } from './api.js';

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export const isIOS = () => !/android/i.test(navigator.userAgent) && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushConfigured = () => Boolean(VAPID);

// Android/desktop Chrome offer a native install prompt we can trigger from a button.
let deferredPrompt = null;
const installListeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; installListeners.forEach((fn) => fn(true)); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; installListeners.forEach((fn) => fn(false)); });
}
export const canPromptInstall = () => Boolean(deferredPrompt);
export const onInstallAvailable = (fn) => { installListeners.add(fn); return () => installListeners.delete(fn); };
export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

// Points "Add to Home Screen" at the current page (used by the shared roster link).
export function setStartUrl(path) {
  const link = document.getElementById('manifest-link');
  if (link) link.setAttribute('href', `/api/manifest?start=${encodeURIComponent(path)}`);
}

function keyBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

/** target: { schoolId } for signed-in users, or { token, staffId } for the shared roster link. */
export async function enablePush(target) {
  if (!pushSupported()) throw new Error('This browser can’t show notifications. On iPhone, add Staffboard to your home screen first.');
  if (!VAPID) throw new Error('Notifications are not configured on this site yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them for this site in your phone or browser settings, then try again.');
  const reg = (await navigator.serviceWorker.getRegistration('/')) || (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) });
  await api('push-subscribe', { action: 'subscribe', subscription: sub.toJSON(), ...target }, { authed: !target.token });
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await api('push-subscribe', { action: 'unsubscribe', endpoint: sub.endpoint }, { authed: false }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTestPush() {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Turn notifications on first.');
  await api('push-subscribe', { action: 'test', endpoint: sub.endpoint }, { authed: false });
}
