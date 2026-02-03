"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Payload = {
  id?: string;
  message: string;
  photos: string[];
  music?: string | null;
  createdAt: string;
};

const funnyTexts = [
  "Arre soch lo 😜",
  "Galat button dab gaya 😆",
  "Itna jaldi NO? 😏",
  "Main toh YES hi sununga 💘",
  "No ko refresh kar do 😇",
  "Tumhare dil ne YES bola 💕",
];

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export default function Home() {
  const [mode, setMode] = useState<"setup" | "experience">("setup");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [noText, setNoText] = useState("Try again 😇");
  const [noCount, setNoCount] = useState(0);
  const [yesClicked, setYesClicked] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoKey, setPhotoKey] = useState(0);
  const [confettiOn, setConfettiOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const photosInputRef = useRef<HTMLInputElement | null>(null);
  const musicInputRef = useRef<HTMLInputElement | null>(null);

  const hearts = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, index) => ({
        id: index,
        size: 16 + Math.random() * 26,
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 8 + Math.random() * 6,
      })),
    []
  );

  const sparkles = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, index) => ({
        id: index,
        top: Math.random() * 100,
        left: Math.random() * 100,
        delay: Math.random() * 4,
      })),
    []
  );

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 80 }).map((_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 2.6,
        duration: 2.6 + Math.random() * 2.4,
        color: ["#ff6fae", "#ffd166", "#ff9a9e", "#a78bfa", "#ffd1e8"][
          index % 5
        ],
      })),
    []
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      fetch(`/api/valentine?id=${id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Not found");
          return res.json();
        })
        .then((parsed: Payload) => {
          setPayload(parsed);
          setMode("experience");
          setMessage(parsed.message);
          setPhotos(parsed.photos);
          localStorage.setItem("valentine:last", id);
        })
        .catch(() => {
          setError("This surprise link looks broken. Try again?");
        });
    }
  }, []);

  useEffect(() => {
    if (!yesClicked || photos.length === 0) return;
    const interval = setInterval(() => {
      setPhotoIndex((prev) => (prev + 1) % photos.length);
      setPhotoKey((prev) => prev + 1);
    }, 3500);
    return () => clearInterval(interval);
  }, [yesClicked, photos.length]);

  const handlePhotosChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    setPhotoFiles(files);
    if (files.length === 0) {
      setPhotos([]);
      return;
    }
    const previews = await Promise.all(files.map(readFileAsDataUrl));
    setPhotos(previews);
  };

  const handleMusicChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] || null;
    setMusicFile(file);
  };

  const handleSubmit = async () => {
    setError("");
    if (!message.trim()) {
      setError("Write a sweet message first.");
      return;
    }
    if (photoFiles.length === 0) {
      setError("Upload at least one photo.");
      return;
    }
    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append("message", message.trim());
      photoFiles.forEach((file) => formData.append("photos", file));
      if (musicFile) formData.append("music", musicFile);

      const response = await fetch("/api/valentine", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed.");
      }
      const nextPayload = (await response.json()) as Payload;
      const url = `${window.location.origin}/?id=${nextPayload.id}`;
      setShareUrl(url);
      setPayload(nextPayload);
      setPhotos(nextPayload.photos);
      localStorage.setItem("valentine:last", String(nextPayload.id));
      setMessage("");
      setPhotos([]);
      setPhotoFiles([]);
      setMusicFile(null);
      if (photosInputRef.current) photosInputRef.current.value = "";
      if (musicInputRef.current) musicInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = () => {
    if (!payload?.id) return;
    window.history.replaceState(null, "", `/?id=${payload.id}`);
    setMode("experience");
  };

  const handleNo = () => {
    const randomText = funnyTexts[Math.floor(Math.random() * funnyTexts.length)];
    setNoText(randomText);
    setNoCount((prev) => Math.min(prev + 1, 7));
  };

  const handleYes = () => {
    setYesClicked(true);
    setConfettiOn(true);
    setTimeout(() => setConfettiOn(false), 4200);
    setNoCount(0);
    if (payload?.music && audioRef.current) {
      audioRef.current.play().catch(() => undefined);
    }
  };

  const showSetup = mode === "setup";

  return (
    <div className="valentine-page">
      <div className="heart-bg">
        {hearts.map((heart) => (
          <span
            key={heart.id}
            className="heart"
            style={{
              left: `${heart.left}%`,
              fontSize: `${heart.size}px`,
              animationDelay: `${heart.delay}s`,
              animationDuration: `${heart.duration}s`,
            }}
          >
            💗
          </span>
        ))}
        {sparkles.map((sparkle) => (
          <span
            key={sparkle.id}
            className="sparkle"
            style={{
              top: `${sparkle.top}%`,
              left: `${sparkle.left}%`,
              animationDelay: `${sparkle.delay}s`,
            }}
          />
        ))}
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-400">
            Valentine Surprise
          </p>
          <h1 className="title-font text-4xl font-semibold text-rose-600 md:text-5xl">
            A playful, romantic surprise
          </h1>
          <p className="mx-auto max-w-2xl text-base text-rose-500 md:text-lg">
            Upload your memories, add a heartfelt message, and share a magical
            moment your partner can experience.
          </p>
        </header>

        {showSetup ? (
          <section className="glass-card mx-auto w-full max-w-3xl p-6 md:p-10 fade-in">
            <div className="flex flex-col gap-8">
              <div>
                <h2 className="title-font text-2xl font-semibold text-rose-600">
                  First Screen – Upload & Setup
                </h2>
                <p className="mt-2 text-sm text-rose-500">
                  Files are saved on this server. Share the link to open the
                  surprise anywhere.
                </p>
              </div>

              <label className="flex flex-col gap-3">
                <span className="text-sm font-semibold text-rose-500">
                  Upload your cutest photos
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotosChange}
                  ref={photosInputRef}
                  className="block w-full rounded-2xl border border-rose-200 bg-white/80 px-4 py-3 text-sm text-rose-500"
                />
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {photos.map((photo, index) => (
                      <div
                        key={`${photo}-${index}`}
                        className="photo-frame h-28 w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt={`Preview ${index + 1}`} className="photo-image" />
                      </div>
                    ))}
                  </div>
                )}
              </label>

              <label className="flex flex-col gap-3">
                <span className="text-sm font-semibold text-rose-500">
                  Write a custom romantic message
                </span>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Type something sweet..."
                  className="w-full rounded-3xl border border-rose-200 bg-white/80 px-4 py-4 text-sm text-rose-700 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-3">
                <span className="text-sm font-semibold text-rose-500">
                  Optional romantic background music
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleMusicChange}
                  ref={musicInputRef}
                  className="block w-full rounded-2xl border border-rose-200 bg-white/80 px-4 py-3 text-sm text-rose-500"
                />
              </label>

              {error && (
                <div className="rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <button
                  className="romantic-button bg-rose-500 text-white"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Uploading..." : "Generate surprise link"}
                </button>
                {shareUrl && (
                  <button
                    className="romantic-button border border-rose-300 bg-white text-rose-600"
                    onClick={handlePreview}
                  >
                    Preview experience
                  </button>
                )}
              </div>

              {shareUrl && (
                <div className="rounded-3xl border border-rose-200 bg-white/70 p-4 text-sm text-rose-600">
                  <p className="font-semibold">Shareable URL</p>
                  <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                    <input
                      className="w-full rounded-full border border-rose-200 bg-white/90 px-4 py-2 text-sm"
                      value={shareUrl}
                      readOnly
                    />
                    <button
                      className="romantic-button border border-rose-300 bg-white text-rose-600"
                      onClick={() => navigator.clipboard.writeText(shareUrl)}
                    >
                      Copy link
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="relative mx-auto flex w-full max-w-4xl flex-col gap-10">
            {confettiOn && (
              <div className="confetti">
                {confettiPieces.map((piece) => (
                  <span
                    key={piece.id}
                    style={{
                      left: `${piece.left}%`,
                      background: piece.color,
                      animationDelay: `${piece.delay}s`,
                      animationDuration: `${piece.duration}s`,
                    }}
                  />
                ))}
              </div>
            )}

            <div className="glass-card mx-auto w-full max-w-3xl p-6 text-center md:p-10">
              {!yesClicked ? (
                <div className="slide-up">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-400">
                    Step 1
                  </p>
                  <div className="dudu-wrap mt-4">
                    <span
                      className={`dudu-bear ${noCount > 2 ? "dudu-angry" : ""}`}
                      style={{
                        transform: `scale(${1 + noCount * 0.08})`,
                      }}
                    >
                      🐻
                    </span>
                    <span className="dudu-mood">
                      {noCount === 0 && "Dudu is chill 😌"}
                      {noCount > 0 && noCount <= 2 && "Dudu is watching 👀"}
                      {noCount > 2 && noCount <= 4 && "Dudu is getting mad 💢"}
                      {noCount > 4 && "Dudu is furious 🔥"}
                    </span>
                  </div>
                  <h2 className="title-font mt-4 text-3xl font-semibold text-rose-600 md:text-4xl">
                    Will you be my Valentine? 💖
                  </h2>
                  <p className="mt-3 text-sm text-rose-500">{noText}</p>
                  <div className="relative mt-8 flex flex-col items-center justify-center gap-4 md:flex-row">
                    <button
                      className="romantic-button w-full bg-rose-500 text-white md:w-auto"
                      style={{
                        transform: `scale(${1 + noCount * 0.08})`,
                        transition: "transform 0.25s ease",
                      }}
                      onClick={handleYes}
                    >
                      YES ❤️
                    </button>
                    <div className="relative h-16 w-44">
                      <button
                        className="romantic-button border border-rose-300 bg-white text-rose-600"
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: "50%",
                          transform: `translate(-50%, -50%) scale(${Math.max(
                            0,
                            1 - noCount * 0.15
                          )})`,
                          opacity: noCount >= 6 ? 0 : 1,
                          pointerEvents: noCount >= 6 ? "none" : "auto",
                          transition: "transform 0.25s ease, opacity 0.25s ease",
                        }}
                        onMouseEnter={handleNo}
                        onClick={handleNo}
                      >
                        NO 🙄
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="fade-in">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-400">
                    Step 2
                  </p>
                  <h2 className="title-font mt-4 text-3xl font-semibold text-rose-600 md:text-4xl">
                    Yayyy! I knew it! 💕
                  </h2>
                  <p className="mt-3 text-sm text-rose-500">
                    Get ready for a mini journey through your favorite moments.
                  </p>

                  {photos.length > 0 && (
                    <div className="mt-8 text-left">
                      <h3 className="title-font text-2xl font-semibold text-rose-600">
                        Photo Reveal
                      </h3>
                      <p className="mt-2 text-sm text-rose-500">
                        Each photo is a little love note.
                      </p>
                      <div className="mt-6 overflow-hidden rounded-3xl border border-rose-200 bg-white/80">
                        <div
                          key={photoKey}
                          className="photo-frame h-72 w-full md:h-96"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photos[photoIndex]}
                            alt={`Memory ${photoIndex + 1}`}
                            className="photo-image"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-10">
                    <h3 className="title-font text-2xl font-semibold text-rose-600">
                      A message just for you
                    </h3>
                    <p className="mt-4 text-base text-rose-600 md:text-lg">
                      {payload?.message || message}
                    </p>
                    <div className="relative mt-8 flex flex-col items-center gap-3">
                      <span className="text-4xl">😘💋</span>
                      <p className="text-base font-semibold text-rose-500">
                        Happy Valentine’s Day, my love ❤️
                      </p>
                      <div className="relative h-20 w-full">
                        {Array.from({ length: 8 }).map((_, index) => (
                          <span
                            key={`float-${index}`}
                            className="floating-heart"
                            style={{
                              left: `${10 + index * 10}%`,
                              top: `${20 + (index % 3) * 10}%`,
                              animationDelay: `${index * 0.4}s`,
                            }}
                          >
                            💞
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {payload?.music && (
              <audio ref={audioRef} src={payload.music} loop />
            )}
          </section>
        )}
      </main>
    </div>
  );
}
