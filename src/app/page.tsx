'use client';

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import styles from "./page.module.css";

type Stage = "loading" | "ready" | "converting" | "done" | "error";

const CORE_VERSION = "0.12.6";
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist`;

export default function Home() {
  const [stage, setStage] = useState<Stage>("loading");
  const [error, setError] = useState<string | null>(null);
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegLoadedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      if (typeof window === "undefined") {
        return;
      }
      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
      }
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg || ffmpegLoadedRef.current) {
        setStage("ready");
        return;
      }

      try {
        setStage("loading");
        setError(null);
        await ffmpeg!.load({
          coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
          workerURL: await toBlobURL(`${BASE_URL}/ffmpeg-worker.js`, "text/javascript"),
        });
        ffmpegLoadedRef.current = true;
        setStage("ready");
      } catch (err) {
        console.error(err);
        setError(
          "Failed to initialize the transcoder. Please refresh and try again."
        );
        setStage("error");
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (stage === "error") {
      return;
    }

    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg || !ffmpegLoadedRef.current) {
      return;
    }

    const handleProgress = ({ progress }: { progress: number }) => {
      setProgress(Math.min(Math.max(progress, 0), 1));
    };

    ffmpeg.on("progress", handleProgress);
    return () => {
      ffmpeg.off("progress", handleProgress);
    };
  }, [stage]);

  useEffect(() => {
    return () => {
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
      if (inputPreviewUrl) {
        URL.revokeObjectURL(inputPreviewUrl);
      }
    };
  }, [outputUrl, inputPreviewUrl]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      setInputFile(file);
      setFileInfo(`${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      if (inputPreviewUrl) {
        URL.revokeObjectURL(inputPreviewUrl);
      }
      const previewUrl = URL.createObjectURL(file);
      setInputPreviewUrl(previewUrl);
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
        setOutputUrl(null);
      }
      setStage((prev) => (prev === "loading" ? "loading" : "ready"));
    },
    [outputUrl, inputPreviewUrl]
  );

  const convert = useCallback(async () => {
    if (!inputFile || stage === "loading" || stage === "error") {
      return;
    }

    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg || !ffmpegLoadedRef.current) {
      return;
    }

    setStage("converting");
    setProgress(0);
    setError(null);

    try {
      const extension = inputFile.name.includes(".")
        ? inputFile.name.slice(inputFile.name.lastIndexOf("."))
        : ".gif";
      const inputName = `input${extension}`;
      const outputName = "output.mp4";

      try {
        await ffmpeg.deleteFile(inputName);
      } catch {
        // No previous input to remove.
      }

      try {
        await ffmpeg.deleteFile(outputName);
      } catch {
        // No previous output to remove.
      }

      await ffmpeg.writeFile(inputName, await fetchFile(inputFile));
      await ffmpeg.exec([
        "-i",
        inputName,
        "-movflags",
        "faststart",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        outputName,
      ]);

      const data = (await ffmpeg.readFile(outputName)) as Uint8Array;
      const buffer = data.slice().buffer;
      const blob = new Blob([buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      setStage("done");
      setProgress(1);
    } catch (err) {
      console.error(err);
      setError(
        "Conversion failed. Try a different file or refresh the page before trying again."
      );
      setStage("error");
    }
  }, [inputFile, stage]);

  const reset = useCallback(() => {
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
    }
    setOutputUrl(null);
    setInputFile(null);
    setFileInfo(null);
    setProgress(0);
    setError(null);
    if (inputPreviewUrl) {
      URL.revokeObjectURL(inputPreviewUrl);
    }
    setInputPreviewUrl(null);
    setStage("ready");
  }, [outputUrl, inputPreviewUrl]);

  const isBusy = stage === "loading" || stage === "converting";
  const actionLabel =
    stage === "loading"
      ? "Initializing..."
      : stage === "converting"
      ? `Converting • ${(progress * 100).toFixed(0)}%`
      : "Convert to MP4";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Animation to Video Converter</h1>
          <p>
            Turn animated GIF or WebP clips into mp4 video that plays seamlessly across
            devices, entirely in your browser.
          </p>
        </header>

        <section className={styles.panel}>
          <div className={styles.inputZone}>
            <label htmlFor="file" className={styles.dropArea}>
              <span className={styles.dropTitle}>
                {inputFile ? "Replace animation" : "Drag & drop animation"}
              </span>
              <span className={styles.dropSubtitle}>
                {inputFile ? fileInfo : "GIF, WebP, APNG • up to ~50 MB"}
              </span>
              <input
                id="file"
                type="file"
                accept=".gif,.webp,.apng,video/*"
                onChange={handleFileChange}
                disabled={isBusy}
              />
            </label>
            <button
              className={styles.actionButton}
              disabled={!inputFile || isBusy || stage === "error"}
              onClick={convert}
            >
              {actionLabel}
            </button>
            {stage === "done" && (
              <button className={styles.secondaryButton} onClick={reset}>
                Start another conversion
              </button>
            )}
            {stage === "converting" && (
              <div className={styles.progressBar} aria-hidden="true">
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${Math.max(progress * 100, 4)}%` }}
                />
              </div>
            )}
            {error && <p className={styles.error}>{error}</p>}
          </div>
          <div className={styles.outputZone}>
            {stage === "loading" && (
              <div className={styles.placeholder}>
                <span>Booting up the transcoder…</span>
              </div>
            )}
            {stage === "ready" && !inputFile && (
              <div className={styles.placeholder}>
                <span>Select an animation to begin</span>
              </div>
            )}
            {inputFile && inputPreviewUrl && stage !== "done" && stage !== "error" && (
              <div className={styles.preview}>
                <h2>Source preview</h2>
                <video
                  key={`${inputFile.name}-preview`}
                  className={styles.video}
                  controls
                  playsInline
                  src={inputPreviewUrl}
                />
              </div>
            )}
            {outputUrl && stage === "done" && (
              <div className={styles.preview}>
                <h2>Converted video</h2>
                <video className={styles.video} controls playsInline src={outputUrl} />
                <a className={styles.download} href={outputUrl} download="converted.mp4">
                  Download mp4
                </a>
              </div>
            )}
            {stage === "error" && (
              <div className={styles.placeholder}>
                <span>Something went wrong. Reset and try again.</span>
              </div>
            )}
          </div>
        </section>

        <section className={styles.faq}>
          <h2>How it works</h2>
          <p>
            The conversion runs locally using ffmpeg.wasm, so your media never leaves
            this browser window. For best results, keep source animations under 50 MB
            and ensure at least 24 fps for smoother playback.
          </p>
          <ul>
            <li>Supports animated GIF, WebP, APNG, and most short video clips.</li>
            <li>Outputs H.264 mp4 optimized for broad compatibility.</li>
            <li>No uploads, accounts, or watermarking required.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
