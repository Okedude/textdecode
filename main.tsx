import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Mode = "typing-full" | "typing-letter" | "crypto" | "button";
type Difficulty = "easy" | "normal" | "hard";
type CryptoMode = "caesar" | "vigenere" | "modulo" | "hash";

type Challenge = {
  title: string;
  text: string;
  mode: Mode;
  difficulty: Difficulty;
  crypto: CryptoMode;
  showMethod: boolean;
  targetClicks: number;
};

const DEFAULT_CHALLENGE: Challenge = {
  title: "Meine TextDecode Challenge",
  text: "Geheimer Beispieltext: Nur wer die Challenge schafft, darf ihn lesen.",
  mode: "typing-full",
  difficulty: "normal",
  crypto: "caesar",
  showMethod: true,
  targetClicks: 65,
};

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeChallenge(challenge: Challenge): string {
  return toBase64Url(JSON.stringify(challenge));
}

function decodeChallenge(payload: string): Challenge | null {
  try {
    const parsed = JSON.parse(fromBase64Url(payload));
    return { ...DEFAULT_CHALLENGE, ...parsed };
  } catch {
    return null;
  }
}

function caesar(text: string, shift = 4): string {
  return text.replace(/[a-z]/gi, (char) => {
    const base = char === char.toLowerCase() ? 97 : 65;
    return String.fromCharCode(((char.charCodeAt(0) - base + shift) % 26) + base);
  });
}

function vigenere(text: string, key = "SECRET"): string {
  let i = 0;
  return text.replace(/[a-z]/gi, (char) => {
    const base = char === char.toLowerCase() ? 97 : 65;
    const shift = alphabet.indexOf(key[i++ % key.length].toUpperCase());
    return String.fromCharCode(((char.charCodeAt(0) - base + shift) % 26) + base);
  });
}

function moduloEncode(text: string, mod = 10): string {
  return text
    .split("")
    .map((char) => String(char.charCodeAt(0) % mod))
    .join(" ");
}

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function randomClicks(difficulty: Difficulty): number {
  if (difficulty === "easy") return Math.floor(Math.random() * 31) + 35;
  if (difficulty === "normal") return Math.floor(Math.random() * 51) + 60;
  return Math.floor(Math.random() * 81) + 100;
}

function App() {
  const [view, setView] = useState<"uploader" | "player">("uploader");
  const [challenge, setChallenge] = useState<Challenge>(DEFAULT_CHALLENGE);
  const [shareUrl, setShareUrl] = useState("");
  const [typed, setTyped] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [blob, setBlob] = useState({ x: 45, y: 50 });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payload = params.get("c");
    if (!payload) return;
    const decoded = decodeChallenge(payload);
    if (!decoded) return;
    setChallenge(decoded);
    setView("player");
    resetRuntime();
  }, []);

  useEffect(() => {
    if (view !== "player" || challenge.mode !== "button" || challenge.difficulty !== "hard" || unlocked) return;
    const interval = window.setInterval(() => {
      setBlob({ x: Math.random() * 78 + 8, y: Math.random() * 68 + 12 });
    }, 430);
    return () => window.clearInterval(interval);
  }, [view, challenge.mode, challenge.difficulty, unlocked]);

  const encrypted = useMemo(() => {
    if (challenge.crypto === "caesar") return caesar(challenge.text);
    if (challenge.crypto === "vigenere") return vigenere(challenge.text);
    if (challenge.crypto === "modulo") return moduloEncode(challenge.text);
    return simpleHash(challenge.text);
  }, [challenge.crypto, challenge.text]);

  const progress = Math.round((typed.length / Math.max(challenge.text.length, 1)) * 100);
  const clickProgress = Math.round((clicks / Math.max(challenge.targetClicks, 1)) * 100);
  const currentIndex = typed.length;

  function updateChallenge(patch: Partial<Challenge>) {
    setChallenge((old) => {
      const next = { ...old, ...patch };
      if (patch.difficulty) next.targetClicks = randomClicks(patch.difficulty);
      return next;
    });
    setShareUrl("");
    resetRuntime();
  }

  function resetRuntime() {
    setTyped("");
    setUnlocked(false);
    setClicks(0);
    setBlob({ x: Math.random() * 78 + 8, y: Math.random() * 68 + 12 });
  }

  function generateLink() {
    const finalChallenge = {
      ...challenge,
      targetClicks: randomClicks(challenge.difficulty),
    };
    const url = `${window.location.origin}/textdecode/?c=${encodeChallenge(finalChallenge)}`;
    setChallenge(finalChallenge);
    setShareUrl(url);
    resetRuntime();
  }

  async function copyLink() {
    const url = shareUrl || `${window.location.origin}/textdecode/`;
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function handleFile(file: File) {
    const content = await file.text();
    updateChallenge({ title: file.name.replace(/\.[^.]+$/, ""), text: content });
  }

  function handleTyping(value: string) {
    if (challenge.mode === "typing-full") {
      if (challenge.text.startsWith(value)) {
        setTyped(value);
        if (value === challenge.text) setUnlocked(true);
      } else {
        setTyped("");
        setUnlocked(false);
      }
      return;
    }

    const next = value[value.length - 1] || "";
    if (next === challenge.text[currentIndex]) {
      const newTyped = typed + next;
      setTyped(newTyped);
      if (newTyped === challenge.text) setUnlocked(true);
    }
  }

  function handleBlobClick() {
    const next = clicks + 1;
    setClicks(next);
    if (next >= challenge.targetClicks) setUnlocked(true);
    if (challenge.difficulty !== "easy") {
      setBlob({ x: Math.random() * 78 + 8, y: Math.random() * 68 + 12 });
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">TextDecode</p>
          <h1>Upload text. Lock it. Share the challenge link.</h1>
          <p className="muted">Uploader and player views are separated. Shared links open only the player challenge.</p>
        </div>
        <div className="tabs">
          <button className={view === "uploader" ? "active" : ""} onClick={() => setView("uploader")}>Uploader</button>
          <button className={view === "player" ? "active" : ""} onClick={() => setView("player")}>Player preview</button>
        </div>
      </header>

      {view === "uploader" ? (
        <section className="grid">
          <div className="card">
            <h2>Uploader area</h2>

            <label>Title</label>
            <input value={challenge.title} onChange={(e) => updateChallenge({ title: e.target.value })} />

            <label>Upload .txt file</label>
            <input type="file" accept=".txt,text/plain" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

            <label>Text</label>
            <textarea value={challenge.text} onChange={(e) => updateChallenge({ text: e.target.value })} />

            <label>Unlock mode</label>
            <select value={challenge.mode} onChange={(e) => updateChallenge({ mode: e.target.value as Mode })}>
              <option value="typing-full">Type whole text; mistake resets</option>
              <option value="typing-letter">Correct letter only; then next</option>
              <option value="crypto">Crypto / encoded text</option>
              <option value="button">Moving blob click challenge</option>
            </select>

            <label>Difficulty</label>
            <select value={challenge.difficulty} onChange={(e) => updateChallenge({ difficulty: e.target.value as Difficulty })}>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard: blob moves constantly</option>
            </select>

            <label>Crypto method</label>
            <select value={challenge.crypto} onChange={(e) => updateChallenge({ crypto: e.target.value as CryptoMode })}>
              <option value="caesar">Caesar</option>
              <option value="vigenere">Vigenère</option>
              <option value="modulo">Modulo</option>
              <option value="hash">Hash</option>
            </select>

            <label className="check">
              <input type="checkbox" checked={challenge.showMethod} onChange={(e) => updateChallenge({ showMethod: e.target.checked })} />
              Show method hint to player
            </label>

            <div className="share">
              <button onClick={generateLink}>Generate link</button>
              <button className="secondary" onClick={copyLink}>Copy link</button>
              <p className="url">{shareUrl || "https://okedude.github.io/textdecode/?c=..."}</p>
              <p className="hint">For GitHub Pages, upload this app to the repository named <b>textdecode</b>. The link data is stored in <code>?c=...</code>, so no backend is needed for short/medium texts.</p>
            </div>
          </div>

          <PlayerCard
            challenge={challenge}
            encrypted={encrypted}
            typed={typed}
            setTyped={setTyped}
            unlocked={unlocked}
            setUnlocked={setUnlocked}
            progress={progress}
            currentIndex={currentIndex}
            handleTyping={handleTyping}
            clicks={clicks}
            clickProgress={clickProgress}
            blob={blob}
            handleBlobClick={handleBlobClick}
            resetRuntime={resetRuntime}
          />
        </section>
      ) : (
        <section className="playerWrap">
          <PlayerCard
            challenge={challenge}
            encrypted={encrypted}
            typed={typed}
            setTyped={setTyped}
            unlocked={unlocked}
            setUnlocked={setUnlocked}
            progress={progress}
            currentIndex={currentIndex}
            handleTyping={handleTyping}
            clicks={clicks}
            clickProgress={clickProgress}
            blob={blob}
            handleBlobClick={handleBlobClick}
            resetRuntime={resetRuntime}
          />
        </section>
      )}
    </main>
  );
}

function PlayerCard(props: {
  challenge: Challenge;
  encrypted: string;
  typed: string;
  setTyped: (value: string) => void;
  unlocked: boolean;
  setUnlocked: (value: boolean) => void;
  progress: number;
  currentIndex: number;
  handleTyping: (value: string) => void;
  clicks: number;
  clickProgress: number;
  blob: { x: number; y: number };
  handleBlobClick: () => void;
  resetRuntime: () => void;
}) {
  const { challenge, encrypted, typed, unlocked, progress, currentIndex, handleTyping, clicks, clickProgress, blob, handleBlobClick, resetRuntime } = props;

  return (
    <div className="card player">
      <div className="playerHeader">
        <div>
          <p className="eyebrow">Player view</p>
          <h2>{challenge.title}</h2>
          <p className="muted">No uploader controls are shown here.</p>
        </div>
        <span className={unlocked ? "pill ok" : "pill"}>{unlocked ? "Unlocked" : "Locked"}</span>
      </div>

      <button className="secondary small" onClick={resetRuntime}>Restart</button>

      {challenge.mode.includes("typing") && (
        <>
          <div className="ghostText">
            <span className="done">{typed}</span>
            <span>{challenge.text.slice(typed.length)}</span>
          </div>
          <input
            value={challenge.mode === "typing-full" ? typed : ""}
            placeholder={challenge.mode === "typing-full" ? "Type the full text exactly..." : `Next letter: ${challenge.text[currentIndex] || "done"}`}
            onChange={(e) => handleTyping(e.target.value)}
          />
          <Progress value={progress} />
          <p className="muted">{progress}% complete {challenge.mode === "typing-full" ? "· one mistake resets everything" : "· only the correct next key works"}</p>
        </>
      )}

      {challenge.mode === "crypto" && (
        <>
          <div className="encoded">{encrypted}</div>
          <p className="muted">{challenge.showMethod ? `Hint: ${challenge.crypto.toUpperCase()}` : "No method hint."}</p>
          <button onClick={() => props.setUnlocked(true)}>Demo unlock</button>
        </>
      )}

      {challenge.mode === "button" && (
        <>
          <div className="arena">
            <button
              className="blob"
              onClick={handleBlobClick}
              style={{ left: `${blob.x}%`, top: `${blob.y}%` }}
            >
              Blob
            </button>
          </div>
          <Progress value={clickProgress} />
          <p className="muted">
            Clicks: {clicks}/{challenge.targetClicks}. {challenge.difficulty === "hard" ? "The blob moves constantly." : "Many clicks are needed."}
          </p>
        </>
      )}

      <div className={unlocked ? "result unlocked" : "result"}>
        <h3>Text</h3>
        <p>{challenge.text}</p>
      </div>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
