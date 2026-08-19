import { useEffect, useRef, useState } from 'react';

const teacherLogin = './login.html';
const studentLogin = './studentLogin.html';
const teacherRegister = './teacherRegister.html';
const studentRegister = './studentRegister.html';

export default function App() {
  const [signInOpen, setSignInOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const signInRef = useRef(null);

  useEffect(() => {
    const onClick = (event) => {
      if (signInRef.current && !signInRef.current.contains(event.target)) {
        setSignInOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const closeMenus = () => {
    setSignInOpen(false);
    setMobileOpen(false);
  };

  return (
    <div className="home">
      <header className={`nav ${mobileOpen ? 'mobile-open' : ''}`}>
        <a className="brand" href="#top" onClick={closeMenus}>
          <span className="brand-mark">E</span>
          <span className="brand-text">
            <strong>EduVoice</strong>
            <span>Smart Campus Suite</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href="#about" onClick={closeMenus}>About</a></li>
          <li><a href="#features" onClick={closeMenus}>Features</a></li>
          <li><a href="#how" onClick={closeMenus}>How it works</a></li>
          <li><a href="#portals" onClick={closeMenus}>Portals</a></li>
        </ul>

        <div className="nav-actions">
          <div className={`signin ${signInOpen ? 'open' : ''}`} ref={signInRef}>
            <button className="btn btn-primary" type="button" onClick={() => setSignInOpen((v) => !v)}>
              Sign in
            </button>
            <div className="signin-menu">
              <a href={teacherLogin}>
                <strong>Teacher sign in</strong>
                <span>Voice marks, attendance review, Excel export</span>
              </a>
              <a href={studentLogin}>
                <strong>Student sign in</strong>
                <span>Face attendance, profile, and records</span>
              </a>
            </div>
          </div>
          <button
            className="menu-btn"
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Major project · Attendance & assessment</p>
          <h1>Classroom records that keep up with the lecture.</h1>
          <p className="lede">
            EduVoice is a smart attendance and voice-based mark entry system.
            Teachers speak names and scores; students mark presence with face
            verification. Live sheets, saved history, and Excel export stay in one campus portal.
          </p>
          <div className="hero-actions">
            <a className="btn btn-gold" href={teacherLogin}>Teacher sign in</a>
            <a className="btn btn-outline" href={studentLogin}>Student sign in</a>
          </div>
          <div className="hero-stats">
            <div>
              <strong>2</strong>
              <span>Secure portals</span>
            </div>
            <div>
              <strong>Live</strong>
              <span>Voice to mark sheet</span>
            </div>
            <div>
              <strong>Face</strong>
              <span>Verified attendance</span>
            </div>
          </div>
        </div>

        <aside className="hero-card" aria-hidden="true">
          <h3>Live mark sheet</h3>
          <div className="sheet-row head">
            <span>Student</span>
            <span>Marks</span>
            <span>Subject</span>
          </div>
          <div className="sheet-row">
            <span>Sanjana</span>
            <span>86</span>
            <span>DSA</span>
          </div>
          <div className="sheet-row">
            <span>Ravi</span>
            <span>74</span>
            <span>DSA</span>
          </div>
          <div className="sheet-row">
            <span>Keerthy</span>
            <span>91</span>
            <span>DSA</span>
          </div>
          <div className="mic">
            <span className="pulse" />
            “Aazma scored 88 marks”
          </div>
        </aside>
      </section>

      <section className="section about" id="about">
        <div className="about-grid">
          <div>
            <p className="eyebrow">Why this project exists</p>
            <h2>Paper registers slow the class down. This system does not.</h2>
            <p>
              Traditional mark entry and roll-call consume teaching time, invite
              transcription errors, and make it hard to produce a clean Excel sheet
              after every test. Students also have no reliable way to prove they
              were present.
            </p>
            <p>
              EduVoice connects teachers and students on a single Node.js and
              MongoDB backend. Teachers dictate results; natural-language parsing
              turns speech into structured rows. Students authenticate, set a
              reference face image, then mark attendance with the camera and
              location. Faculty can review summaries and download workbooks.
            </p>
          </div>
          <div className="pillars">
            <article className="pillar">
              <h3>Built for real classrooms</h3>
              <p>Subject-wise sheets, editable names, and saved history after each session.</p>
            </article>
            <article className="pillar">
              <h3>Role-based access</h3>
              <p>JWT-protected teacher and student APIs so dashboards never mix identities.</p>
            </article>
            <article className="pillar">
              <h3>Export when you need it</h3>
              <p>Generate Excel mark sheets and attendance lists without leaving the portal.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section features" id="features">
        <div className="features-inner">
          <p className="eyebrow">Platform capabilities</p>
          <h2>Everything the major project is designed to deliver.</h2>
          <p className="lede">
            Four classroom workflows sit on one stack: voice capture, live tables,
            biometric attendance, and faculty reporting.
          </p>
          <div className="feature-grid">
            <article className="feature">
              <div className="icon">🎙</div>
              <h3>Voice mark entry</h3>
              <p>
                Speak patterns such as “Name scored 85 marks.” The browser transcribes
                in real time, client-side NLP extracts names and scores, and the server
                can refine the same text for accuracy.
              </p>
            </article>
            <article className="feature">
              <div className="icon">📊</div>
              <h3>Live Excel-style table</h3>
              <p>
                Rows appear as you speak. Teachers can correct spelling, change marks,
                delete entries, add a student manually, save the sheet, or download .xlsx.
              </p>
            </article>
            <article className="feature">
              <div className="icon">📷</div>
              <h3>Face-verified attendance</h3>
              <p>
                Students start the camera, capture their face, and submit attendance
                with geolocation. Faculty later review who was present and export records.
              </p>
            </article>
            <article className="feature">
              <div className="icon">🗂</div>
              <h3>Profiles and history</h3>
              <p>
                Teachers manage profile, password, attendance summaries, and past mark
                entries. Students update profile details and view their own attendance log.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section how" id="how">
        <div className="how-inner">
          <p className="eyebrow">From lecture to records</p>
          <h2>A four-step flow that stays out of the way.</h2>
          <div className="steps">
            <article className="step">
              <div className="step-num">01</div>
              <h3>Create an account</h3>
              <p>
                Teachers register with department and employee ID. Students register
                once, then sign in to their dashboard.
              </p>
            </article>
            <article className="step">
              <div className="step-num">02</div>
              <h3>Set the subject</h3>
              <p>
                Open Voice Mark Entry, type the subject, and start the microphone.
                The live sheet is ready before the first name is spoken.
              </p>
            </article>
            <article className="step">
              <div className="step-num">03</div>
              <h3>Speak or scan</h3>
              <p>
                Dictate marks, or let students mark attendance with face capture.
                Incomplete names can be edited in place before saving.
              </p>
            </article>
            <article className="step">
              <div className="step-num">04</div>
              <h3>Save and export</h3>
              <p>
                Persist entries to MongoDB, reopen them from Saved Mark Sheets,
                and download Excel for department records.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section portals" id="portals">
        <div className="portals-inner">
          <p className="eyebrow">Choose your portal</p>
          <h2>Sign in as faculty or as a student.</h2>
          <div className="portal-grid">
            <article className="portal teacher">
              <p className="eyebrow">Faculty</p>
              <h2>Teacher workspace</h2>
              <ul>
                <li>Voice-to-sheet mark capture</li>
                <li>Student attendance review and export</li>
                <li>Saved mark sheets and Excel download</li>
                <li>Profile, stats, and password management</li>
              </ul>
              <div className="hero-actions">
                <a className="btn btn-gold" href={teacherLogin}>Sign in</a>
                <a className="btn btn-ghost" href={teacherRegister}>Create faculty account</a>
              </div>
            </article>
            <article className="portal student">
              <p className="eyebrow">Campus</p>
              <h2>Student workspace</h2>
              <ul>
                <li>Secure login and personal dashboard</li>
                <li>Reference photo for face verification</li>
                <li>Mark attendance with camera and location</li>
                <li>View your attendance history anytime</li>
              </ul>
              <div className="hero-actions">
                <a className="btn btn-primary" href={studentLogin}>Sign in</a>
                <a className="btn btn-outline" href={studentRegister}>Create student account</a>
              </div>
            </article>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div>
          <strong>EduVoice</strong> · Smart Attendance and Voice-Based Mark Entry System
        </div>
        <div>Major academic project · React homepage · Express API</div>
      </footer>
    </div>
  );
}
