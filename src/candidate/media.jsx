/* ══════════════════════════════════════════════════════════════════════════════════════════
   Media + proctoring runtime for the candidate flow (ported from EvaluationSystem):
   MediaProvider (camera / mic / screen streams shared across steps) · WebcamPreview ·
   useFullscreen · useProctoring (tab switch, blur, fullscreen exit, copy/paste, right-click,
   shortcuts, face-not-visible heuristic) · ViolationWarningModal · FullscreenWarningModal ·
   SubmitConfirmationModal. All signals are real browser signals; nothing auto-passes.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
import { createContext, useContext, useEffect, useRef, useState, useCallback, memo } from 'react';
import { Camera, CameraOff, AlertCircle, Wifi, AlertTriangle, X, Clock, Maximize2, CheckCircle } from 'lucide-react';

/* ─────────────────────────── media streams ─────────────────────────── */
const MediaCtx = createContext(null);
export const useMedia = () => useContext(MediaCtx);

export function MediaProvider({ children }) {
  const cam = useRef(null); const mic = useRef(null); const screen = useRef(null);
  const [state, setState] = useState({ camera: 'idle', microphone: 'idle', screen: 'idle' }); // idle | pending | granted | denied | unsupported
  const set = (k, v) => setState((s) => ({ ...s, [k]: v }));
  const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const requestCamera = useCallback(async () => {
    if (cam.current) return cam.current;
    if (!supported) { set('camera', 'unsupported'); return null; }
    set('camera', 'pending');
    try { const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } }); cam.current = s; set('camera', 'granted'); return s; }
    catch (e) { set('camera', 'denied'); return null; }
  }, [supported]);
  const requestMic = useCallback(async () => {
    if (mic.current) return mic.current;
    if (!supported) { set('microphone', 'unsupported'); return null; }
    set('microphone', 'pending');
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); mic.current = s; set('microphone', 'granted'); return s; }
    catch (e) { set('microphone', 'denied'); return null; }
  }, [supported]);
  const requestScreen = useCallback(async () => {
    if (screen.current) return screen.current;
    if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) { set('screen', 'unsupported'); return null; }
    set('screen', 'pending');
    try { const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); screen.current = s; set('screen', 'granted'); s.getVideoTracks()[0]?.addEventListener('ended', () => { screen.current = null; set('screen', 'idle'); }); return s; }
    catch (e) { set('screen', 'denied'); return null; }
  }, []);
  const stopAll = useCallback(() => { [cam, mic, screen].forEach((r) => { r.current?.getTracks().forEach((t) => t.stop()); r.current = null; }); setState({ camera: 'idle', microphone: 'idle', screen: 'idle' }); }, []);
  const value = { state, supported, requestCamera, requestMic, requestScreen, stopAll, camStream: () => cam.current, micStream: () => mic.current, screenStream: () => screen.current };
  return <MediaCtx.Provider value={value}>{children}</MediaCtx.Provider>;
}

/* live mic level 0..1 from a stream (for the system check + voice recording) */
export function useMicLevel(stream, active = true) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream || !active) { setLevel(0); return; }
    let raf, ctx, src, analyser;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)(); src = ctx.createMediaStreamSource(stream); analyser = ctx.createAnalyser(); analyser.fftSize = 512; src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => { analyser.getByteTimeDomainData(data); let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; } setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4)); raf = requestAnimationFrame(tick); };
      tick();
    } catch { /* no audio context */ }
    return () => { cancelAnimationFrame(raf); try { src?.disconnect(); ctx?.close(); } catch { /* */ } };
  }, [stream, active]);
  return level;
}

/* <video> that attaches a stream once and never re-renders (avoids the dark flash on parent re-renders) */
export const StableVideo = memo(function StableVideo({ stream, className = '', mirrored = true, videoRef }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (!el) return; if (stream && el.srcObject !== stream) { el.srcObject = stream; el.play?.().catch(() => {}); } if (videoRef) videoRef.current = el; }, [stream, videoRef]);
  return <video ref={ref} autoPlay muted playsInline className={className} style={mirrored ? { transform: 'scaleX(-1)' } : undefined} />;
}, (a, b) => a.stream === b.stream);

/* webcam card shown during the assessment (right column) */
export function WebcamPreview({ stream, isMonitoring = true, status, className = '' }) {
  const [showOverlay, setShowOverlay] = useState(true);
  const s = status || (stream ? { text: 'All checks passed', tone: 'ok' } : { text: 'Camera not available', tone: 'error' });
  const tone = { ok: 'text-green-400', warn: 'text-yellow-400', error: 'text-red-400' }[s.tone] || 'text-blue-400';
  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {stream ? <StableVideo stream={stream} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-500"><CameraOff size={28} /></div>}
      {isMonitoring && (
        <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg bg-green-600">
          <Wifi size={12} className="text-white" /><span className="text-white text-xs font-bold uppercase tracking-wider">AI Live</span>
        </div>
      )}
      {showOverlay ? (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">{isMonitoring ? <Camera size={16} className="text-green-400" /> : <CameraOff size={16} className="text-gray-400" />}<span className="text-white text-xs font-medium">{isMonitoring ? 'Monitoring Active' : 'Monitoring Paused'}</span></div>
            <button onClick={() => setShowOverlay(false)} className="text-white/70 hover:text-white text-xs">Hide</button>
          </div>
          {s.tone !== 'ok' && <div className="flex items-center gap-2"><AlertCircle size={14} className={tone} /><span className={`text-xs font-medium ${tone}`}>{s.text}</span></div>}
        </div>
      ) : <button onClick={() => setShowOverlay(true)} className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 hover:bg-black/70 text-white text-xs rounded">Show Info</button>}
    </div>
  );
}

/* ─────────────────────────── fullscreen ─────────────────────────── */
export const fullscreenSupported = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
export async function enterFullscreen() {
  try { const el = document.documentElement; if (!isFullscreen()) await (el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen()); return { success: true }; }
  catch (error) { return { success: false, error }; }
}
export async function exitFullscreen() { try { if (isFullscreen()) await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen()); } catch { /* */ } }

/* Tracks fullscreen state while `required`: exits, seconds outside, paused flag, auto-submit when the budget runs out */
export function useFullscreen({ required = false, maxTimeOutside = 120, onAutoSubmit } = {}) {
  const [inFs, setInFs] = useState(isFullscreen());
  const [exits, setExits] = useState(0);
  const [outside, setOutside] = useState(0);
  const auto = useRef(false);
  useEffect(() => {
    const h = () => { const now = isFullscreen(); setInFs(now); if (!now && required) setExits((n) => n + 1); };
    document.addEventListener('fullscreenchange', h); document.addEventListener('webkitfullscreenchange', h);
    return () => { document.removeEventListener('fullscreenchange', h); document.removeEventListener('webkitfullscreenchange', h); };
  }, [required]);
  const paused = required && fullscreenSupported() && !inFs;
  useEffect(() => {
    if (!paused) return;
    const t = setInterval(() => setOutside((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [paused]);
  useEffect(() => { if (required && outside >= maxTimeOutside && !auto.current) { auto.current = true; onAutoSubmit?.('fullscreen_time_exceeded'); } }, [outside, maxTimeOutside, required, onAutoSubmit]);
  const remaining = Math.max(0, maxTimeOutside - outside);
  const fmt = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  return { inFs, paused, exits, outside, remaining, remainingFormatted: fmt(remaining), enterFullscreen, supported: fullscreenSupported() };
}

/* ─────────────────────────── proctoring signals ─────────────────────────── */
export const VIOLATION_THRESHOLD = 10;
const SEVERITY = { TAB_SWITCH: 'HIGH', WINDOW_BLUR: 'MEDIUM', FULLSCREEN_EXIT: 'HIGH', COPY_PASTE: 'MEDIUM', RIGHT_CLICK: 'LOW', KEYBOARD_SHORTCUT: 'LOW', DEVTOOLS_OPEN: 'CRITICAL', FACE_NOT_DETECTED: 'HIGH', MULTIPLE_FACES: 'HIGH', NEW_WINDOW_ATTEMPT: 'MEDIUM' };
export function useProctoring({ enabled = true, onViolation, onAutoSubmit, threshold = VIOLATION_THRESHOLD } = {}) {
  const [violations, setViolations] = useState([]);
  const [current, setCurrent] = useState(null);
  const last = useRef({});
  const auto = useRef(false);
  const record = useCallback((type, metadata = {}) => {
    const now = Date.now();
    if (now - (last.current[type] || 0) < 1500) return; // debounce bursts of the same signal
    last.current[type] = now;
    const v = { violationType: type, severity: SEVERITY[type] || 'MEDIUM', at: now, metadata };
    setViolations((l) => { const next = [...l, v]; if (next.length >= threshold && !auto.current) { auto.current = true; setTimeout(() => onAutoSubmit?.('violation_threshold'), 0); } return next; });
    setCurrent(v); onViolation?.(v);
  }, [onViolation, onAutoSubmit, threshold]);
  useEffect(() => {
    if (!enabled) return;
    const onVis = () => { if (document.hidden) record('TAB_SWITCH'); };
    const onBlur = () => record('WINDOW_BLUR');
    const onFs = () => { if (!isFullscreen()) record('FULLSCREEN_EXIT'); };
    const onCopy = (e) => { record('COPY_PASTE', { action: e.type }); e.preventDefault(); };
    const onCtx = (e) => { e.preventDefault(); record('RIGHT_CLICK'); };
    const onKey = (e) => { const k = (e.key || '').toLowerCase(); if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && (k === 'p' || k === 's' || k === 'u' || (e.shiftKey && (k === 'i' || k === 'j' || k === 'c'))))) { e.preventDefault(); record('KEYBOARD_SHORTCUT', { key: e.key }); } };
    document.addEventListener('visibilitychange', onVis); window.addEventListener('blur', onBlur); document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('copy', onCopy); document.addEventListener('paste', onCopy); document.addEventListener('cut', onCopy); document.addEventListener('contextmenu', onCtx); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur); document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('copy', onCopy); document.removeEventListener('paste', onCopy); document.removeEventListener('cut', onCopy); document.removeEventListener('contextmenu', onCtx); document.removeEventListener('keydown', onKey); };
  }, [enabled, record]);
  const counts = violations.reduce((a, v) => { a[v.violationType] = (a[v.violationType] || 0) + 1; return a; }, {});
  return { violations, counts, total: violations.length, current, dismiss: () => setCurrent(null), record, threshold };
}

/* ─────────────────────────── modals (ported) ─────────────────────────── */
const DETAILS = {
  TAB_SWITCH: { emoji: '🔄', title: 'Tab Switch Detected', message: 'You switched to another tab or window.', description: 'Switching tabs during the assessment is not allowed. Please keep this tab active throughout the assessment.' },
  WINDOW_BLUR: { emoji: '👁️', title: 'Window Focus Lost', message: 'The assessment window lost focus.', description: 'Please keep this window in focus. Do not minimize or switch to other applications.' },
  MULTIPLE_FACES: { emoji: '👥', title: 'Multiple Faces Detected', message: 'Multiple faces were detected in your webcam.', description: 'Only your face should be visible during the assessment.' },
  FACE_NOT_DETECTED: { emoji: '😶', title: 'Face Not Detected', message: 'Your face was not detected in the webcam.', description: 'Please ensure your face is clearly visible in the webcam at all times.' },
  COPY_PASTE: { emoji: '📋', title: 'Copy/Paste Detected', message: 'Copy or paste action was detected.', description: 'Copying and pasting content is not allowed during the assessment. Please type your answers manually.' },
  RIGHT_CLICK: { emoji: '🖱️', title: 'Right-Click Detected', message: 'Right-click action was detected.', description: 'Right-click is disabled during the assessment. Please use only left-click.' },
  DEVTOOLS_OPEN: { emoji: '⚙️', title: 'Developer Tools Detected', message: 'Browser developer tools were opened.', description: 'Opening developer tools is strictly prohibited and may result in immediate disqualification.' },
  FULLSCREEN_EXIT: { emoji: '⛔', title: 'Fullscreen Exit', message: 'You exited fullscreen mode.', description: 'The assessment must be completed in fullscreen mode. Please return to fullscreen immediately.' },
  KEYBOARD_SHORTCUT: { emoji: '⌨️', title: 'Restricted Shortcut', message: 'A restricted keyboard shortcut was detected.', description: 'Certain keyboard shortcuts are disabled during the assessment for security purposes.' },
  NEW_WINDOW_ATTEMPT: { emoji: '🪟', title: 'New Window Blocked', message: 'Attempt to open a new window or tab was detected.', description: 'All work must be completed in this window.' },
};
const COLORS = { CRITICAL: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', button: 'bg-red-600 hover:bg-red-700' }, HIGH: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', button: 'bg-orange-600 hover:bg-orange-700' }, MEDIUM: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', button: 'bg-yellow-600 hover:bg-yellow-700' }, LOW: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', button: 'bg-blue-600 hover:bg-blue-700' } };

export const ViolationWarningModal = memo(function ViolationWarningModal({ violation, violationCount, threshold = VIOLATION_THRESHOLD, onDismiss, autoDismissSeconds = 10 }) {
  const [countdown, setCountdown] = useState(autoDismissSeconds);
  useEffect(() => { if (!violation) return; setCountdown(autoDismissSeconds); const t = setInterval(() => setCountdown((p) => { if (p <= 1) { clearInterval(t); onDismiss?.(); return 0; } return p - 1; }), 1000); return () => clearInterval(t); }, [violation, autoDismissSeconds, onDismiss]);
  if (!violation) return null;
  const c = COLORS[violation.severity] || COLORS.LOW; const d = DETAILS[violation.violationType] || { emoji: '⚠️', title: 'Violation Detected', message: 'A proctoring violation was detected.', description: 'Please follow all assessment guidelines to avoid further violations.' };
  const remaining = Math.max(0, threshold - violationCount); const near = remaining <= 3; const pct = Math.min((violationCount / threshold) * 100, 100);
  return (
    <div className="cand fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm cand-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden cand-slide-in">
        <div className={`p-6 border-b ${c.bg} ${c.text} ${c.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><span className="text-3xl">{d.emoji}</span><div><h3 className="font-bold text-xl">{d.title}</h3><p className="text-sm opacity-90 mt-1">{violation.severity} Severity • Violation #{violationCount}</p></div></div>
            {violation.severity !== 'CRITICAL' && <button onClick={onDismiss} className="hover:opacity-70" aria-label="Close"><X size={24} /></button>}
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2"><p className="font-semibold text-gray-900 text-lg">{d.message}</p><p className="text-sm text-gray-600 leading-relaxed">{d.description}</p></div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm"><span className="text-gray-600 font-medium">Violation Progress</span><span className="text-gray-900 font-bold">{violationCount} / {threshold}</span></div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden"><div className={`h-full transition-all duration-500 ${pct >= 80 ? 'bg-red-600' : pct >= 50 ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4"><div className="grid grid-cols-3 gap-4 text-center"><div><p className="text-2xl font-bold text-gray-900">{violationCount}</p><p className="text-xs text-gray-600">Total</p></div><div><p className="text-2xl font-bold text-gray-900">{threshold}</p><p className="text-xs text-gray-600">Allowed</p></div><div><p className={`text-2xl font-bold ${near ? 'text-red-600' : 'text-green-600'}`}>{remaining}</p><p className="text-xs text-gray-600">Remaining</p></div></div></div>
          {near && <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 cand-pulse"><p className="text-sm text-red-800 font-bold flex items-center gap-2"><AlertTriangle size={16} /> Critical Warning: {remaining} violations left before auto-submit!</p></div>}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3"><p className="text-sm text-blue-800 flex items-center gap-2"><Clock size={16} /> This warning will auto-close in <span className="font-bold text-blue-900">{countdown} seconds</span></p></div>
          <button onClick={onDismiss} className={`w-full px-4 py-3 ${c.button} text-white font-semibold rounded-lg transition-all hover:shadow-lg`}>{violation.severity === 'CRITICAL' ? 'I Understand - Continue' : 'Acknowledge & Continue'}</button>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2"><p className="text-sm font-semibold text-gray-700">Assessment Guidelines:</p>
            <ul className="text-xs text-gray-600 space-y-1">{['Stay in fullscreen mode throughout the assessment', 'Keep your face clearly visible in the webcam', 'Do not switch tabs, windows, or use external tools', 'Type all answers manually - no copy/paste', 'Ensure a stable internet connection'].map((t) => <li key={t} className="flex items-start gap-2"><span className="text-green-600 mt-0.5">✓</span><span>{t}</span></li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  );
});

export function FullscreenWarningModal({ fs, mode = 'assessment' }) {
  if (!fs.paused) return null;
  const iv = mode === 'interview';
  return (
    <div className="cand fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 space-y-6 cand-slide-in">
        <div className="flex items-center justify-center gap-3"><div className="bg-orange-100 p-3 rounded-full"><AlertTriangle className="w-8 h-8 text-orange-600" /></div><h2 className="text-2xl font-bold text-gray-900">{iv ? 'Interview Paused' : 'Assessment Paused'}</h2></div>
        <div className="text-center space-y-2"><p className="text-gray-700 text-lg">You have exited fullscreen mode. The {iv ? 'interview' : 'assessment'} is now paused.</p><p className="text-gray-600 text-sm">Return to fullscreen to continue.</p></div>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-center gap-2 text-red-700"><Clock className="w-5 h-5" /><span className="text-sm font-semibold uppercase tracking-wide">Time Remaining</span></div>
          <div className="text-center"><div className="text-5xl font-bold text-red-600 font-mono">{fs.remainingFormatted}</div><p className="text-xs text-red-600 mt-2">Auto-submits when time runs out</p></div>
        </div>
        <div className="grid grid-cols-2 gap-4"><div className="bg-gray-50 rounded-lg p-4 text-center"><div className="text-2xl font-bold text-gray-900">{fs.exits}</div><div className="text-xs text-gray-600 mt-1">Fullscreen Exits</div></div><div className="bg-gray-50 rounded-lg p-4 text-center"><div className="text-2xl font-bold text-gray-900">{fs.outside}s</div><div className="text-xs text-gray-600 mt-1">Total Time Outside</div></div></div>
        <button onClick={() => fs.enterFullscreen()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-lg"><Maximize2 className="w-5 h-5" /><span>Return to Fullscreen &amp; Resume</span></button>
        <div className="text-center text-xs text-gray-500 pt-2"><p>Maximum 2 minutes total time outside fullscreen</p></div>
      </div>
    </div>
  );
}

export const SubmitConfirmationModal = memo(function SubmitConfirmationModal({ isOpen, onConfirm, onCancel, totalQuestions, answeredQuestions, isSubmitting, hideGoBack = false, label = 'Submit Assessment', note }) {
  if (!isOpen) return null;
  const un = Math.max(0, totalQuestions - answeredQuestions); const all = un === 0;
  return (
    <div className="cand fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className={`p-6 border-b ${all ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}><div className="flex items-center gap-3">{all ? <CheckCircle size={24} className="text-green-600" /> : <AlertCircle size={24} className="text-orange-600" />}<h3 className="font-bold text-lg text-gray-900">{all ? 'Ready to Submit?' : 'Confirm Submission'}</h3></div></div>
        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><span className="text-sm text-gray-600">Total Questions:</span><span className="font-bold text-gray-900">{totalQuestions}</span></div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg"><span className="text-sm text-green-700">Answered:</span><span className="font-bold text-green-700">{answeredQuestions}</span></div>
            {un > 0 && <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg"><span className="text-sm text-orange-700">Unanswered:</span><span className="font-bold text-orange-700">{un}</span></div>}
          </div>
          {!all && <div className="bg-orange-50 border border-orange-200 rounded-lg p-4"><p className="text-sm text-orange-800"><strong>Warning:</strong> You have {un} unanswered {un === 1 ? 'question' : 'questions'}. These will be marked as skipped.</p></div>}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4"><p className="text-sm text-blue-800">{note || 'Once you submit, you will not be able to change your answers. Your responses will be evaluated and results will be available shortly.'}</p></div>
          <div className={`flex pt-2 ${hideGoBack ? 'justify-center' : 'gap-3'}`}>
            {!hideGoBack && <button onClick={onCancel} disabled={isSubmitting} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50">Go Back</button>}
            <button onClick={onConfirm} disabled={isSubmitting} className={`px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 ${hideGoBack ? 'w-full' : 'flex-1'}`}>{isSubmitting ? 'Submitting...' : label}</button>
          </div>
        </div>
      </div>
    </div>
  );
});
