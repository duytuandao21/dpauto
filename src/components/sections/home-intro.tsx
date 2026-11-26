"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Gallery } from "@/components/media/gallery";
import { VideoPlayer } from "@/components/media/video-player";
import { homeDefaults } from "@/lib/home-defaults";
import { youtubeId } from "@/lib/youtube";
import { useImage, useSection } from "@/components/site/site-content";
import type { SiteImage } from "@/lib/content";

type Img = Parameters<ReturnType<typeof useImage>>[0];

/** Homepage intro before the services: copy, workshop photos and a YouTube or uploaded video. */
export function HomeIntro() {
  const resolve = useImage();
  const intro = useSection("home.intro", homeDefaults["home.intro"]);
  if (!intro) return null;
  const title = String(intro.title || "");
  const highlight = String(intro.highlight || "").trim();
  const at = highlight
    ? title.toLowerCase().indexOf(highlight.toLowerCase())
    : -1;
  const images = ((intro.images || []) as Img[])
    .map((i) => resolve(i))
    .filter((i): i is SiteImage => !!i?.src);
  const youtube = youtubeId(intro.youtube as string | undefined);
  const upload = resolve(((intro.videos || []) as Img[])[0])?.src;
  // Admin-uploaded cover, shown before playing either kind of video.
  const cover = resolve(intro.image as Img)?.src;

  return (
    <section className="section home-intro" id="gioi-thieu">
      <div className="container home-intro-grid">
        <div className="home-intro-copy">
          <h2>
            {at < 0 ? (
              title
            ) : (
              <>
                {title.slice(0, at)}
                <span className="home-intro-accent">
                  {title.slice(at, at + highlight.length)}
                </span>
                {title.slice(at + highlight.length)}
              </>
            )}
          </h2>
          {intro.description && <p>{intro.description}</p>}
          {images.length > 0 && (
            <Gallery images={images} className="home-intro-photos" />
          )}
        </div>
        {(youtube || upload) && (
          <div className="home-intro-media">
            {youtube ? (
              <YouTubeVideo id={youtube} title={title} cover={cover} />
            ) : (
              <VideoPlayer src={upload!} poster={cover} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Thumbnail + play button; YouTube's player (~1 MB) loads only after a click. */
function YouTubeVideo({
  id,
  title,
  cover,
}: {
  id: string;
  title: string;
  cover?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [thumb, setThumb] = useState("sddefault");
  if (playing)
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
        title={title || "Video giới thiệu"}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  return (
    <button
      type="button"
      className="home-intro-youtube"
      aria-label={`Phát video: ${title}`}
      onClick={() => setPlaying(true)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail host */}
      <img
        src={cover || `https://i.ytimg.com/vi/${id}/${thumb}.jpg`}
        alt=""
        loading="lazy"
        // sddefault is missing on some older videos; hqdefault always exists.
        onError={() => !cover && setThumb("hqdefault")}
      />
      <span className="video-play-large" aria-hidden="true">
        <Icon name="play" />
      </span>
    </button>
  );
}
