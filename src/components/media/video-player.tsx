"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

function time(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  return `${Math.floor(value / 60)}:${Math.floor(value % 60)
    .toString()
    .padStart(2, "0")}`;
}

export function VideoPlayer({
  src,
  poster,
  className = "",
  vietnamese = false,
}: {
  src: string;
  poster?: string;
  className?: string;
  vietnamese?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null),
    video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(false),
    [current, setCurrent] = useState(0),
    [duration, setDuration] = useState(0),
    [error, setError] = useState(false);
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => setError(true));
    else v.pause();
  };
  return (
    <div
      className={`video-player ${playing ? "is-playing" : ""} ${className}`}
      ref={root}
      data-native-scroll
    >
      <video
        ref={video}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        muted={muted}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setCurrent(video.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(video.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
        onClick={toggle}
        aria-label={
          vietnamese
            ? "Video xưởng HyperAuto Care"
            : "HyperAuto Care workshop video"
        }
      />
      {!playing && !error && (
        <button
          className="video-play-large"
          onClick={toggle}
          aria-label={vietnamese ? "Phát video" : "Play workshop video"}
        >
          <Icon name="play" />
        </button>
      )}
      {error && (
        <p className="video-error">
          {vietnamese
            ? "Không thể phát video. "
            : "The video could not be played. "}
          <a href={src}>{vietnamese ? "Mở video" : "Open video"}</a>
        </p>
      )}
      <div className="video-controls">
        <button
          onClick={toggle}
          aria-label={
            vietnamese
              ? playing
                ? "Dừng video"
                : "Phát video"
              : playing
                ? "Pause video"
                : "Play video"
          }
        >
          <Icon name={playing ? "pause" : "play"} />
        </button>
        <span>
          {time(current)} / {time(duration)}
        </span>
        <input
          type="range"
          aria-label={vietnamese ? "Tiến trình video" : "Video progress"}
          min={0}
          max={duration || 1}
          step={0.1}
          value={current}
          onChange={(e) => {
            if (video.current) {
              video.current.currentTime = Number(e.target.value);
              setCurrent(Number(e.target.value));
            }
          }}
        />
        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={
            vietnamese
              ? muted
                ? "Bật âm thanh"
                : "Tắt âm thanh"
              : muted
                ? "Unmute video"
                : "Mute video"
          }
        >
          <Icon name={muted ? "muted" : "volume"} />
        </button>
        <button
          aria-label={vietnamese ? "Xem toàn màn hình" : "Fullscreen video"}
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            else root.current?.requestFullscreen();
          }}
        >
          <Icon name="expand" />
        </button>
      </div>
    </div>
  );
}
