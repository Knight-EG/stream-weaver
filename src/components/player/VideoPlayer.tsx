import { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward, Loader2 } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  title?: string;
  onBack?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export function VideoPlayer({ url, title, onBack, onNext, onPrev }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<number>(0);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShowControls(false), 4000);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);
    setPlaying(false);

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    if (url.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1,
        capLevelToPlayerSize: true,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setPlaying(true)).catch(() => {});
        setLoading(false);
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setTimeout(() => hls.startLoad(), 3000);
          } else {
            setError('Playback error. Please try again.');
            setLoading(false);
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        video.play().then(() => setPlaying(true)).catch(() => {});
        setLoading(false);
      }, { once: true });
    } else {
      video.src = url;
      video.addEventListener('canplay', () => {
        video.play().then(() => setPlaying(true)).catch(() => {});
        setLoading(false);
      }, { once: true });
    }

    return () => { hlsRef.current?.destroy(); };
  }, [url]);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [resetHideTimer]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
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
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        onError={() => { setError('Failed to load stream'); setLoading(false); }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-player-bg/80">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-player-bg/90 gap-3">
          <p className="text-destructive text-lg font-medium">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); if (videoRef.current) videoRef.current.load(); }}
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
              <button onClick={onBack} className="text-foreground/80 hover:text-foreground tv-focusable p-1" data-focusable="true">
                ← Back
              </button>
            )}
            {title && <h2 className="text-foreground font-semibold text-lg truncate">{title}</h2>}
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
