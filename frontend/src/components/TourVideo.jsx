export function TourVideo({ tour }) {
  const base = `/walkthroughs/${tour.slug}`;
  return <figure style={{ margin: 0 }}>
    <video className="tour-video" controls playsInline preload="none" poster={`${base}.jpg`} aria-label={`${tour.title} walkthrough — illustrative synthetic data`}>
      <source src={`${base}.mp4`} type="video/mp4"/>
      <track kind="captions" src={`${base}.vtt`} srcLang="en" label="English" default/>
      <a href={`${base}.mp4`}>Download the {tour.title.toLowerCase()} walkthrough</a>
    </video>
    <figcaption className="tour-video-label">Recorded product walkthrough · Illustrative synthetic data · <a href={`${base}.txt`}>Read transcript</a></figcaption>
  </figure>;
}
