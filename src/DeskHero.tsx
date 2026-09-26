import React, { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { projects, services } from './data'

const DeskObjects = lazy(() => import('./DeskObjects'))

export default function DeskHero() {
  const [activeTab, setActiveTab] = useState<'home' | 'about' | 'projects' | 'skills' | 'contact'>('home')
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [copiedEmail, setCopiedEmail] = useState(false)
  
  // Parallax tracking
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const targetPos = useRef({ x: 0, y: 0 })
  const currentPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    let animFrame: number
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      targetPos.current = { x, y }
    }

    const updateParallax = () => {
      currentPos.current.x += (targetPos.current.x - currentPos.current.x) * 0.08
      currentPos.current.y += (targetPos.current.y - currentPos.current.y) * 0.08
      setMousePos({ x: currentPos.current.x, y: currentPos.current.y })
      animFrame = requestAnimationFrame(updateParallax)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    animFrame = requestAnimationFrame(updateParallax)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animFrame)
    }
  }, [])

  const copyEmail = () => {
    navigator.clipboard.writeText('hellens.studio@design.io')
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2500)
  }

  // Parallax calculations
  const flareX = mousePos.x * -22
  const flareY = mousePos.y * -22
  const paperShiftX = mousePos.x * 6
  const paperShiftY = mousePos.y * 6

  return (
    <div className="creative-workspace" aria-label="Hellens Creative Designer Workspace">
      {/* 1. Underlying 3D WebGL Desk Scene (Emerald Cutting Mat, 3D Laptop, 3D Gameboy, 3D Camera, 3D Sketchbook, 3D Pencils, 3D Sticky Notes, 3D Polaroid, 3D Highlighter, 3D Ruler, 3D EarPods) */}
      <Suspense fallback={<div className="desk-three-fallback" />}>
        <DeskObjects 
          onSelectProp={(key) => setActiveModal(key)} 
          mousePos={mousePos} 
        />
      </Suspense>

      {/* 2. Top Navigation: Torn Paper Strip Pinned to Desk */}
      <header className="paper-nav-wrapper">
        {/* Blue 3D Pushpin on the Left (positioned outside clip-path so it's not clipped) */}
        <div className="blue-pushpin" title="Pinned to desk" />

        <nav 
          className="paper-nav-strip"
          style={{
            transform: `translate(${paperShiftX * 0.3}px, ${paperShiftY * 0.3}px) rotate(-0.6deg)`
          }}
        >

          {/* Brand Logo */}
          <div 
            className="nav-brand" 
            onClick={() => { setActiveTab('home'); setActiveModal(null); }}
          >
            <span>HELLENS</span>
            <span className="brand-asterisk">✳</span>
          </div>

          {/* Nav Links with Hand-Drawn Marker Underlines */}
          <ul className="nav-menu">
            <li>
              <button 
                className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
                onClick={() => { setActiveTab('home'); setActiveModal(null); }}
              >
                Home
                {activeTab === 'home' && <span className="marker-stroke" />}
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeTab === 'about' ? 'active' : ''}`}
                onClick={() => { setActiveTab('about'); setActiveModal('about'); }}
              >
                About
                {activeTab === 'about' && <span className="marker-stroke" />}
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeTab === 'projects' ? 'active' : ''}`}
                onClick={() => { setActiveTab('projects'); setActiveModal('projects'); }}
              >
                Projects
                {activeTab === 'projects' && <span className="marker-stroke" />}
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeTab === 'skills' ? 'active' : ''}`}
                onClick={() => { setActiveTab('skills'); setActiveModal('skills'); }}
              >
                Skills
                {activeTab === 'skills' && <span className="marker-stroke" />}
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeTab === 'contact' ? 'active' : ''}`}
                onClick={() => { setActiveTab('contact'); setActiveModal('contact'); }}
              >
                Contact
                {activeTab === 'contact' && <span className="marker-stroke" />}
              </button>
            </li>
          </ul>

          {/* Action Button: Dark Physical Pill Button */}
          <button 
            className="nav-cta-pill"
            onClick={() => { setActiveTab('contact'); setActiveModal('contact'); }}
          >
            Let's Talk ↗
          </button>
        </nav>
      </header>

      {/* 3. Central Hero Paper Cutout Title Group (Precisely Centered) */}
      <main 
        className="hero-paper-cluster" 
        style={{
          transform: `translate(calc(-50% + ${paperShiftX}px), calc(-50% + ${paperShiftY}px))`
        }}
      >
        {/* Chalk Kicker right above title */}
        <div className="chalk-kicker">
          <span>A LITTLE DATA. A LOT OF CLARITY.</span>
          <svg className="chalk-arrow" viewBox="0 0 65 30">
            <path d="M5,8 Q35,2 55,22 M46,20 L55,22 L53,13" fill="none" stroke="#d5ebd9" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>

        {/* Top Cutout: HELLENS ✳ */}
        <div 
          className="paper-card paper-hellens"
          onClick={() => setActiveModal('about')}
          title="Click to view Studio Profile"
        >
          <h2>HELLENS<span className="orange-asterisk">✳</span></h2>
        </div>

        {/* Middle Cutout: Dashboard */}
        <div 
          className="paper-card paper-dashboard"
          onClick={() => setActiveModal('projects')}
          title="Click to view Selected Dashboard Projects"
        >
          <h1>Dashboard</h1>
          <div className="orange-marker-brush" />
        </div>

        {/* Bottom Cutout: Portfolio. */}
        <div 
          className="paper-card paper-portfolio"
          onClick={() => setActiveModal('contact')}
          title="Click to get in touch"
        >
          <h2>Portfolio<span className="orange-period">.</span></h2>
        </div>

        {/* Chalk Caption right below title */}
        <div className="chalk-caption">
          <span>Thoughtfully arranged. Clearly understood.</span>
          <div className="chalk-underline" />
        </div>
      </main>

      {/* 5. Natural Daylight & Prismatic Lens Flare Overlays */}
      <div 
        className="desk-sunlight-beam"
        style={{ transform: `translate(${flareX * 0.4}px, ${flareY * 0.4}px)` }}
        aria-hidden="true"
      />
      <div 
        className="prismatic-lens-leak"
        style={{ transform: `translate(${flareX}px, ${flareY}px)` }}
        aria-hidden="true"
      />

      {/* 6. Analog Film Grain & Lens Shading */}
      <div className="film-grain-layer" aria-hidden="true" />
      <div className="vignette-lens-layer" aria-hidden="true" />

      {/* 7. Interactive Modals: Physical Designer Paper Dossiers */}
      {activeModal && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="paper-dossier" onClick={e => e.stopPropagation()}>
            <div className="dossier-tab-header">
              <span className="dossier-label">
                {activeModal === 'projects' && 'FEATURED CASE STUDIES / WIREFRAMES'}
                {activeModal === 'about' && 'STUDIO MANIFESTO & PHILOSOPHY'}
                {activeModal === 'skills' && 'DISCIPLINES & DESIGN CAPABILITIES'}
                {activeModal === 'contact' && 'START A COLLABORATION'}
              </span>
              <button 
                className="dossier-close-btn" 
                onClick={() => setActiveModal(null)}
                aria-label="Close dossier"
              >
                ✕ Close
              </button>
            </div>

            <div className="dossier-content">
              {/* PROJECTS DOSSIER */}
              {activeModal === 'projects' && (
                <div className="projects-grid">
                  <div className="dossier-intro">
                    <h3>Selected Dashboard Work</h3>
                    <p>Designed with intentional hierarchy, data storytelling, and user-centric workflows.</p>
                  </div>
                  <div className="project-cards-container">
                    {projects.map((proj) => (
                      <article key={proj.code} className="project-index-card">
                        <div className="card-top-tag">{proj.code}</div>
                        <h4 className="card-title">{proj.title}</h4>
                        <p className="card-copy">{proj.copy}</p>
                        
                        <div className="card-metric-block">
                          <span className="metric-num">{proj.value}</span>
                          <span className="metric-tag">{proj.label}</span>
                        </div>

                        {/* Mini Data Bar Chart */}
                        <div className="mini-bars" aria-hidden="true">
                          {proj.bars.map((height, i) => (
                            <div 
                              key={i} 
                              className="bar" 
                              style={{ height: `${height}%`, animationDelay: `${i * 0.1}s` }} 
                            />
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {/* ABOUT / PROCESS DOSSIER */}
              {activeModal === 'about' && (
                <div className="manifesto-sheet">
                  <div className="scotch-tape tape-top" />
                  <span className="handwritten-badge">HELLENS • DESIGN PHILOSOPHY</span>
                  <h3>"Where raw data transforms into intuitive clarity."</h3>
                  
                  <div className="manifesto-columns">
                    <div className="manifesto-column">
                      <h4>01. Less Noise, More Signal</h4>
                      <p>
                        Dashboards shouldn't overwhelm stakeholders with chaotic charts. We isolate the single metric that drives immediate action and build around it.
                      </p>
                    </div>
                    <div className="manifesto-column">
                      <h4>02. Physical Meets Digital</h4>
                      <p>
                        Inspired by industrial control rooms, architectural blueprints, and tactile stationery. A dashboard should feel tangible, reliable, and deliberate.
                      </p>
                    </div>
                    <div className="manifesto-column">
                      <h4>03. Systemic Scalability</h4>
                      <p>
                        From tiny mobile notifications to multi-monitor operations centers, every component is rigorously tested against real enterprise data loads.
                      </p>
                    </div>
                  </div>

                  <div className="manifesto-quote-box">
                    <em>"Thoughtfully arranged. Clearly understood."</em>
                    <span className="sig">— Hellens Studio</span>
                  </div>
                </div>
              )}

              {/* SKILLS / SERVICES DOSSIER */}
              {activeModal === 'skills' && (
                <div className="skills-sheet">
                  <div className="dossier-intro">
                    <h3>Core Capabilities</h3>
                    <p>End-to-end design from information architecture to production-ready design tokens.</p>
                  </div>
                  <div className="services-list">
                    {services.map(svc => (
                      <div key={svc.id} className="service-paper-row">
                        <span className="service-tab-tag">{svc.tab}</span>
                        <div className="service-info">
                          <h4>{svc.title}</h4>
                          <p className="short">{svc.short}</p>
                          <p className="detail">{svc.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CONTACT DOSSIER */}
              {activeModal === 'contact' && (
                <div className="contact-sheet">
                  <div className="contact-paper-card">
                    <span className="badge-available">● AVAILABLE FOR Q4 PROJECTS</span>
                    <h3>Let's build something exceptional.</h3>
                    <p>Have an ambitious product or complex data problem? Let's turn it into an effortless user experience.</p>
                    
                    <div className="contact-action-row">
                      <div className="email-display" onClick={copyEmail} title="Click to copy email">
                        <span>hellens.studio@design.io</span>
                        <span className="copy-btn">{copiedEmail ? '✓ Copied!' : 'Copy'}</span>
                      </div>
                      <a 
                        href="mailto:hellens.studio@design.io?subject=Project%20Inquiry%20from%20Portfolio" 
                        className="email-send-btn"
                      >
                        Open Mail App ↗
                      </a>
                    </div>

                    <div className="social-links-footer">
                      <a href="https://behance.net" target="_blank" rel="noreferrer">Behance ↗</a>
                      <a href="https://dribbble.com" target="_blank" rel="noreferrer">Dribbble ↗</a>
                      <a href="https://linkedin.com" target="_blank" rel="noreferrer">LinkedIn ↗</a>
                      <a href="https://github.com" target="_blank" rel="noreferrer">GitHub ↗</a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
