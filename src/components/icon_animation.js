import React, { useEffect, useRef } from 'react';

const DOTLOTTIE_SCRIPT_SRC = 'https://unpkg.com/@lottiefiles/dotlottie-wc@0.8.5/dist/dotlottie-wc.js';

function ensureDotlottieScriptLoaded() {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector(`script[src="${DOTLOTTIE_SCRIPT_SRC}"]`);
  if (existing) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.src = DOTLOTTIE_SCRIPT_SRC;
  document.head.appendChild(script);
}

const IconAnimation = ({
  src = 'https://lottie.host/dff15d9e-bcd2-4a70-8552-bb2057f26593/pya2Lju4z7.lottie',
  width = 28,
  height = 28,
  autoplay = true,
  loop = true,
  style = {}
}) => {
  const ref = useRef(null);

  useEffect(() => {
    ensureDotlottieScriptLoaded();
  }, []);

  return (
    <dotlottie-wc
      ref={ref}
      src={src}
      autoplay={autoplay}
      loop={loop}
      style={{ width: `${width}px`, height: `${height}px`, display: 'block', ...style }}
    />
  );
};

export default IconAnimation;

export const IconAnimation2 = ({
  src = 'https://lottie.host/5dd0b9b8-d332-4ee1-ab32-b14632781245/lNvrD3Hh0s.lottie',
  width = 28,
  height = 28,
  autoplay = true,
  loop = true,
  style = {}
}) => {
  useEffect(() => {
    ensureDotlottieScriptLoaded();
  }, []);

  return (
    <dotlottie-wc
      src={src}
      autoplay={autoplay}
      loop={loop}
      style={{ width: `${width}px`, height: `${height}px`, display: 'block', ...style }}
    />
  );
};


