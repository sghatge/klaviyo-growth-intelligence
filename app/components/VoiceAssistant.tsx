"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Mic, MicOff, Send, Volume2, VolumeX, X, LoaderCircle, Sparkles } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; text: string };
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const STARTER: ChatMessage = {
  role: "assistant",
  text: "Hi! I'm your ArtFlow AI assistant. Ask me about campaign performance, customer segments, lifecycle flows, abandoned carts or email QA."
};

export default function VoiceAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([STARTER]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("Ready");
  const recognition = useRef<RecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  useEffect(() => () => {
    recognition.current?.abort();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const ask = async (raw: string) => {
    const question = raw.trim();
    if (!question || busy) return;
    setError("");
    setInput("");
    setMessages((current) => [...current, { role: "user", text: question }]);
    setBusy(true);
    setMode("Thinking");
    try {
      const response = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question })
      });
      const result = await response.json() as { answer?: string; error?: string; warning?: string; mode?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || "I couldn't answer that just now.");
      setMessages((current) => [...current, { role: "assistant", text: result.answer! }]);
      setMode(result.mode === "ai" ? "AI connected" : "Demo response");
      if (result.warning) setError(result.warning);
      speak(result.answer);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      setMode("Needs attention");
    } finally {
      setBusy(false);
    }
  };

  const startListening = () => {
    setError("");
    const browser = window as Window & {
      SpeechRecognition?: new () => RecognitionLike;
      webkitSpeechRecognition?: new () => RecognitionLike;
    };
    const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice input isn't supported in this browser. Please use Chrome or type your question.");
      return;
    }
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    const instance = new Recognition();
    instance.lang = "en-IN";
    instance.continuous = false;
    instance.interimResults = true;
    instance.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (interimText) setInput(interimText);
      if (finalText.trim()) {
        setInput(finalText.trim());
        recognition.current?.stop();
        setListening(false);
        void ask(finalText);
      }
    };
    instance.onerror = (event) => {
      setListening(false);
      if (event.error !== "no-speech" && event.error !== "aborted") setError(event.error === "not-allowed" ? "Microphone permission was blocked. Allow microphone access in your browser settings." : "Voice input stopped. Please try again or type your question.");
    };
    instance.onend = () => setListening(false);
    recognition.current = instance;
    try {
      instance.start();
      setListening(true);
      setMode("Listening");
    } catch {
      setListening(false);
      setError("Couldn't start the microphone. Please try again.");
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(input);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  return (
    <div className="voice-agent">
      {open && (
        <section className="voice-window" aria-label="ArtFlow AI voice assistant">
          <div className="voice-head">
            <div className="voice-avatar"><Sparkles size={17} /></div>
            <div className="voice-heading"><b>ArtFlow AI Assistant</b><small><span className={busy || listening ? "voice-live-dot" : "voice-dot"} />{listening ? "Listening…" : speaking ? "Speaking…" : mode}</small></div>
            <button className="voice-icon-btn" aria-label={voiceEnabled ? "Mute spoken responses" : "Enable spoken responses"} onClick={() => { if (voiceEnabled) stopSpeaking(); setVoiceEnabled(!voiceEnabled); }}>{voiceEnabled ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button>
            <button className="voice-icon-btn" aria-label="Close assistant" onClick={() => { recognition.current?.stop(); setListening(false); stopSpeaking(); setOpen(false); }}><X size={18}/></button>
          </div>
          <div className="voice-messages" ref={scrollRef} aria-live="polite">
            {messages.map((message, index) => (
              <div className={`voice-message ${message.role}`} key={index}>
                {message.role === "assistant" && <span className="voice-message-icon"><Bot size={14}/></span>}
                <p>{message.text}</p>
              </div>
            ))}
            {busy && <div className="voice-thinking"><LoaderCircle size={14}/> Thinking…</div>}
          </div>
          {error && <div className="voice-error" role="status">{error}</div>}
          <div className="voice-controls">
            <button className={`voice-mic ${listening ? "recording" : ""}`} onClick={startListening} disabled={busy} aria-label={listening ? "Stop listening" : "Start voice input"} title={listening ? "Stop listening" : "Speak"}>
              {listening ? <MicOff size={19}/> : <Mic size={19}/>}
            </button>
            <form onSubmit={submit} className="voice-form">
              <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Listening for your question…" : "Ask ArtFlow anything…"} aria-label="Ask ArtFlow AI" maxLength={1600}/>
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send message"><Send size={16}/></button>
            </form>
          </div>
          <div className="voice-footnote">Demo workspace context · No campaigns are sent or changed</div>
        </section>
      )}
      <button className={`voice-launcher ${open ? "is-open" : ""}`} onClick={() => setOpen(!open)} aria-label={open ? "Close ArtFlow assistant" : "Open ArtFlow voice assistant"}>
        {open ? <X size={19}/> : <><Mic size={19}/><span>Talk to ArtFlow</span></>}
      </button>
    </div>
  );
}
