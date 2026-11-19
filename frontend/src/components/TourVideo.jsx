import { VideoPlayer, VideoSkin, Video } from "@videojs/react/video";
import "@videojs/react/video/skin.css";

export function TourVideo({ tour }) {
  const base = `/walkthroughs/${tour.slug}`;
  return <figure style={{ margin: 0 }}>
    <VideoPlayer><VideoSkin className="tour-video-player" style={{ width: "100%", aspectRatio: "8 / 5" }}><Video src={`${base}.mp4`} poster={`${base}.jpg`} preload="metadata" playsInline aria-label={`${tour.title} walkthrough — illustrative synthetic data`}><track kind="captions" src={`${base}.vtt`} srcLang="en" label="English" default/></Video></VideoSkin></VideoPlayer>
    <figcaption className="tour-video-label">Recorded product walkthrough · Illustrative synthetic data · <a href={`${base}.txt`}>Read transcript</a></figcaption>
  </figure>;
}
