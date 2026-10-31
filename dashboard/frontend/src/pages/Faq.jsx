import { useState } from "react";
import { IconFile, IconLink, IconShield, IconUsb } from "../components/Icons.jsx";
import RoleTable from "../components/RoleTable.jsx";

const AUDIENCE = [
  { icon: <IconShield />, who: "Security / IT teams",
    what: "See every USB drive that touched a monitored machine, which files left on it, and how risky each connection was." },
  { icon: <IconUsb />, who: "Incident responders",
    what: "Open one incident and get the device identity, the corroborating Windows artifacts and a correlation graph in one place." },
  { icon: <IconLink />, who: "Auditors & reviewers",
    what: "Verify the hash-linked chain of custody and export a PDF report — the export is itself recorded in the chain." },
  { icon: <IconFile />, who: "Students & lab demos",
    what: "Run the whole pipeline on a Mac without a USB drive using the fake collector." },
];

const FAQS = [
  {
    q: "What exactly does this system detect?",
    a: <>A USB mass-storage device being connected to a Windows machine. The collector then reads the five
       traces Windows leaves behind — the <strong>USBSTOR</strong> registry key, <strong>MountPoints2</strong>,
       the <strong>SetupAPI</strong> install log, the <strong>Event Log</strong>, and <strong>LNK</strong> shortcut
       records — and hashes every file on the drive.</>,
  },
  {
    q: "How is the risk score calculated?",
    a: <>The engine adds points per rule and the total maps to a level: unapproved serial (+25), a sensitive
       filename pattern (+20), an executable transferred (+25), a hash mismatch on re-verification (+30).
       Every incident lists the exact rules that fired, so a score is never a black box.
       <strong> 0–24 LOW · 25–49 MEDIUM · 50–69 HIGH · 70+ CRITICAL.</strong></>,
  },
  {
    q: "I added a file to the pendrive after plugging it in — when does it show up in the Files table?",
    a: <>Within about 10 seconds, as long as the drive is still plugged in and the collector is running.
       The collector re-walks the drive on each refresh, hashes <strong>only paths it has not seen before</strong>,
       appends them, and records the addition as a <strong>files_added</strong> entry in the chain of custody.
       <br /><br />Hashes already collected are never recomputed. That is the important guarantee: evidence can
       <em> grow</em>, but what was already recorded can never be silently rewritten. Each custody entry seals the
       evidence as it stood at that moment, and the newest entry must match the files exactly as they are now —
       so editing or dropping a recorded hash still breaks the chain.
       <br /><br />Two limits. The collector stops at 300 files per drive, so a full drive will not take more.
       And if the collector is not running, or the drive has been unplugged, nothing can be added — re-plug it
       and you get a fresh incident with its own chain.</>,
  },
  {
    q: "What does 'chain of custody' mean here?",
    a: <>Each custody entry stores a hash of the entry before it. Changing any entry — or any recorded file
       hash — breaks the links, and the incident page reports <strong>BROKEN</strong> within seconds.
       It proves the record has not been edited after collection.</>,
  },
  {
    q: "What is the evidence confidence score?",
    a: <>How many independent Windows sources corroborate the same incident. One source could be a fluke;
       five agreeing sources is a strong case. It is shown separately from risk on purpose —
       <em> how sure we are</em> is a different question from <em>how bad it is</em>.</>,
  },
  {
    q: "Who can sign in, and what can each role do?",
    a: <>Anyone can create an account on the sign-in page and choose a role — there are no preset
       logins. Both roles read exactly the same evidence; only an investigator can run the two actions
       that <strong>write to the chain of custody</strong>. See the table above for the full split.
       Accounts are stored in your browser (password as a PBKDF2-SHA256 hash), and since the API has no
       authentication, the role decides what this dashboard offers rather than what the server allows.</>,
  },
  {
    q: "Do I need a real USB drive to try it?",
    a: <>No. On a Mac or any machine without a drive, run <code>python -m engine.fake_collector</code> and an
       incident appears on the dashboard within a few seconds. The real collector is Windows-only because
       it reads the registry and event logs, and it needs Administrator rights.</>,
  },
  {
    q: "Is any of my data sent anywhere?",
    a: <>Incidents are stored in the MongoDB database configured in <code>.env</code>. The dashboard only talks
       to the local API. File <em>contents</em> are never stored — only paths, sizes and SHA-256 hashes.</>,
  },
];

function Faq({ q, a, open, onToggle }) {
  return (
    <div className={`faq ${open ? "open" : ""}`}>
      <button className="faq-q" onClick={onToggle} aria-expanded={open}>
        <span>{q}</span>
        <span className="faq-mark" aria-hidden="true">{open ? "–" : "+"}</span>
      </button>
      {open && <div className="faq-a">{a}</div>}
    </div>
  );
}

export default function FaqPage() {
  const [open, setOpen] = useState(2);   // the file-snapshot question trips people up most

  return (
    <>
      <div className="hero">
        <div className="hero-row">
          <div>
            <div className="hero-eyebrow">Reference</div>
            <h1>Help &amp; FAQ</h1>
            <div className="sub">What this console does, who it is for, and how to read what it shows.</div>
          </div>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>Who can use this</h2></div>
        <div className="card-body">
          <div className="grid-2">
            {AUDIENCE.map((a) => (
              <div className="who" key={a.who}>
                <span className="who-ico">{a.icon}</span>
                <div>
                  <div className="who-title">{a.who}</div>
                  <div className="muted-text small">{a.what}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2>Investigator vs viewer</h2>
          <span className="hint">what each role can do</span>
        </div>
        <div className="card-body"><RoleTable /></div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h2>How one incident is built</h2></div>
        <div className="card-body">
          <ol className="flow">
            <li><strong>Collect</strong><span>A USB connection triggers the collector: device identity, five artifact sources, SHA-256 of every file on the drive.</span></li>
            <li><strong>Analyse</strong><span>The engine re-verifies hashes, seals the custody chain, builds the correlation graph and scores confidence and risk.</span></li>
            <li><strong>Review</strong><span>The incident appears here with its reasons spelled out, ready to re-verify or export as a PDF report.</span></li>
          </ol>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Frequently asked</h2></div>
        <div className="card-body stack" style={{ gap: 0 }}>
          {FAQS.map((f, i) => (
            <Faq key={f.q} {...f} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </div>
      </section>
    </>
  );
}
