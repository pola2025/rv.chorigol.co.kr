"use client";
// 스마트플레이스에 붙여넣을 문구 복사 버튼. 이 페이지에서 유일한 클라이언트 컴포넌트다.
import { useState } from "react";

export default function CopyButton({ text }) {
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // http 나 구형 브라우저 — clipboard API 가 없을 때
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };

  return (
    <button
      type="button"
      className={`sv-cp${done ? " sv-cp-done" : ""}`}
      onClick={copy}
      aria-live="polite"
    >
      {done ? "복사됨" : "복사"}
    </button>
  );
}
