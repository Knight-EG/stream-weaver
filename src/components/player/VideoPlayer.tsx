import { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward, Loader2, AlertTriangle, Lock, RotateCcw } from 'lucide-react';
import { startSession, endSession } from '@/lib/analytics';
import { fetchEPGForChannel, getCurrentProgram, getProgramProgress, type EPGProgram } from '@/lib/epg';
import { getSecureStreamUrl } from '@/lib/stream-proxy';
import { saveResumePosition, getResumePosition } from '@/lib/resume-playback';

interface VideoPlayerProps {
  url: string;
  title?: string;
  channelId?: string;
  fallbackUrls?: string[];
  onBack?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

export function VideoPlayer({ url, title, channelId, fallbackUrls = [], onBack, onNext, onPrev }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [currentEPG, setCurrentEPG] = useState<EPGProgram | null>(null);
  const [epgProgress, setEpgProgress] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const hideTimer = useRef<number>(0);
  const retryTimer = useRef<number>(0);
  const saveInterval = useRef<number>(0);

  const allUrls = [url, ...fallbackUrls];
  const activeUrl = allUrls[currentUrlIndex] || url;

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowControls(false), 4000);
  }, []);

  const retryWithBackoff = useCallback((attempt: number) => {
    if (attempt >= MAX_RETRIES) {
      if (currentUrlIndex < allUrls.length - 1) {
        setCurrentUrlIndex(i => i + 1);
        setRetryCount(0);
        return;
      }
      setError('Stream unavailable after multiple retries.');
      setLoading(false);
      return;
    }
    const delay = BASE_DELAY * Math.pow(2, attempt) + Math.random() * 1000;
    retryTimer.current = window.setTimeout(() => {
      setRetryCount(attempt + 1);
    }, delay);
  }, [currentUrlIndex, allUrls.length]);

  // Resolve secure stream URL
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResolvedUrl(null);

    const id = channelId || `ch-${activeUrl}`;
    getSecureStreamUrl(id, activeUrl).then(secureUrl => {
      if (!cancelled) setResolvedUrl(secureUrl);
    }).catch(() => {
      if (!cancelled) setResolvedUrl(activeUrl); // fallback to direct
    });

    return () => { cancelled = true; };
  }, [activeUrl, channelId]);

  // Load video when URL is resolved
  useEffect(() => {
    if (!resolvedUrl) return;
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);
    setPlaying(false);

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    if (title) startSession(title, activeUrl);

    const playUrl = resolvedUrl;

    if ((playUrl.includes('.m3u8') || playUrl.includes('stream-proxy')) && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1,
        capLevelToPlayerSize: true,
        fragLoadingMaxRetry: 3,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
      });
      hlsRef.current = hls;
      hls.loadSource(playUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setPlaying(true)).catch(() => {});
        setLoading(false);
        setRetryCount(0);
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.destroy();
            retryWithBackoff(retryCount);
          } else {
            setError('Playback error.');
            setLoading(false);
          }
        }
      });
    } else {
      video.src = playUrl;
      const onCanPlay = () => {
        video.play().then(() => setPlaying(true)).catch(() => {});
        setLoading(false);
        setRetryCount(0);
      };
      video.addEventListener('canplay', onCanPlay, { once: true });
      video.addEventListener('error', () => retryWithBackoff(retryCount), { once: true });
    }

    return () => {
      hlsRef.current?.destroy();
      clearTimeout(retryTimer.current);
      endSession();
    };
  }, [resolvedUrl, retryCount]);

  // EPG
  useEffect(() => {
    if (!channelId) return;
    let mounted = true;
    fetchEPGForChannel(channelId).then(programs => {
      if (!mounted) return;
      const current = getCurrentProgram(programs);
      setCurrentEPG(current);
    });
    const interval = setInterval(() => {
      if (currentEPG) setEpgProgress(getProgramProgress(currentEPG));
    }, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, [channelId]);

  useEffect(() => { resetHideTimer(); return () => clearTimeout(hideTimer.current); }, [resetHideTimer]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = () => {
    const c = containerRef.current;
    if (!c) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else c.requestFullscreen();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-player-bg overflow-hidden rounded-lg group"
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
    >
      <video ref={videoRef} className="w-full h-full object-contain" playsInline />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-player-bg/80 gap-2">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          {retryCount > 0 && (
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Retry {retryCount}/{MAX_RETRIES}...
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-player-bg/90 gap-3">
          <AlertTriangle className="w-10 h-10 text-destructive" />
          <p className="text-destructive text-lg font-medium">{error}</p>
          <button
            onClick={() => { setError(null); setRetryCount(0); setCurrentUrlIndex(0); setResolvedUrl(null); }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md tv-focusable"
            data-focusable="true"
          >
            Retry
          </button>
        </div>
      )}

      <div className={`absolute inset-0 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-player-bg/80 to-transparent p-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="text-foreground/80 hover:text-foreground tv-focusable p-1" data-focusable="true" data-back-button="true">
                ← Back
              </button>
            )}
            <div className="flex-1 min-w-0">
              {title && <h2 className="text-foreground font-semibold text-lg truncate">{title}</h2>}
              {currentEPG && (
                <div className="mt-1">
                  <p className="text-muted-foreground text-xs truncate">Now: {currentEPG.title}</p>
                  <div className="w-48 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${epgProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-player-bg/80 to-transparent p-4">
          <div className="flex items-center justify-center gap-6">
            {onPrev && (
              <button onClick={onPrev} className="text-foreground/70 hover:text-foreground tv-focusable p-2" data-focusable="true">
                <SkipBack className="w-6 h-6" />
              </button>
            )}
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center tv-focusable"
              data-focusable="true"
            >
              {playing ? <Pause className="w-7 h-7 text-foreground" /> : <Play className="w-7 h-7 text-foreground ml-1" />}
            </button>
            {onNext && (
              <button onClick={onNext} className="text-foreground/70 hover:text-foreground tv-focusable p-2" data-focusable="true">
                <SkipForward className="w-6 h-6" />
              </button>
            )}
            <button onClick={toggleMute} className="text-foreground/70 hover:text-foreground tv-focusable p-2 ml-auto" data-focusable="true">
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button onClick={toggleFullscreen} className="text-foreground/70 hover:text-foreground tv-focusable p-2" data-focusable="true">
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
