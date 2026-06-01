import { Link } from 'react-router-dom';

const steps = [
  {
    num: '01',
    title: 'Sequence your shots',
    desc: 'Define each scene with a title, duration, and reference frame. Drag to reorder until the rhythm feels right.',
  },
  {
    num: '02',
    title: 'Layer audio markers',
    desc: 'Mark music beds, SFX cues, and dialogue across multiple lanes below the shot timeline. Resize and reposition freely.',
  },
  {
    num: '03',
    title: 'Feel the pacing',
    desc: 'Hit play and let the playhead scrub your board. Adjust shot durations until it clicks — then generate.',
  },
];

export default function Landing() {
  return (
    <>
      {/* N5 Floating pill nav */}
      <nav className="lnd-nav" aria-label="Site navigation">
        <span className="lnd-wordmark">overboard</span>
        <Link to="/app" className="lnd-nav-cta">Open app</Link>
      </nav>

      <main>
        {/* Hero — Marquee, full viewport */}
        <section className="lnd-hero" aria-labelledby="hero-heading">
          <h1 className="lnd-headline" id="hero-heading">
            Storyboard<br />before you<br />generate.
          </h1>
          <span className="lnd-scroll" aria-hidden="true">↓ scroll</span>
        </section>

        <hr className="lnd-rule" />

        {/* Intro lede */}
        <section className="lnd-intro" aria-label="About">
          <p>
            Pre-visualization for AI video creators. Plan shots, layer audio,
            feel the pacing — before you generate a single frame.
          </p>
        </section>

        {/* Steps — F4 vertical stack, number | content */}
        <section className="lnd-steps" aria-label="How it works">
          {steps.map((s) => (
            <div key={s.num} className="lnd-step">
              <span className="lnd-step-num" aria-hidden="true">{s.num}</span>
              <div>
                <h3 className="lnd-step-title">{s.title}</h3>
                <p className="lnd-step-desc">{s.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* CTA strip — single action */}
        <section className="lnd-cta" aria-label="Get started">
          <Link to="/app" className="lnd-cta-btn">
            Start storyboarding →
          </Link>
        </section>

        {/* Footer — Ft5 Statement */}
        <footer className="lnd-footer">
          <p className="lnd-footer-statement">
            Every frame planned.<br />No pixels wasted.
          </p>
          <div className="lnd-footer-meta">
            <span className="lnd-wordmark-sm">overboard</span>
            <span>© 2026</span>
          </div>
        </footer>
      </main>
    </>
  );
}
