import { Suspense, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import "./ScrollVideo.css";
import * as THREE from "three";

gsap.registerPlugin(ScrollTrigger);
const CAMERA_FINAL = { z: 170, y: 16 }; 
const CAMERA_MEIO = { z: 50, y: 1 }; 
const CAMERA_INICIO = { z: 0, y: 4 };   
const PRIMEIRO_FRAME = 1;
const TOTAL_FRAMES = 241;
const DIGITOS = 4;
const DURACAO_DO_SCROLL = "+=300%";
const ZOOM_CARD = 1.2;
const caminhoDoFrame = (n) =>
  `/frames/videoframe_${String(n).padStart(DIGITOS, "0")}.jpg`;

function PredioModelo({ movimentoRef }) {
  const { scene } = useGLTF("/models/predio.glb");
  const grupoRef = useRef(null);

  useEffect(() => {
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.frustumCulled = false;    
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          m.side = THREE.DoubleSide;
        });
      }
    });
  }, [scene]);

  useFrame(({ camera }) => {
    if (grupoRef.current) {
      grupoRef.current.rotation.y = movimentoRef.current.rotacaoY;
    }
    camera.position.z = movimentoRef.current.distancia;
    camera.position.y = movimentoRef.current.altura;
  });

  return (
    <group ref={grupoRef}>
      <primitive object={scene} position={[-0.42, -14.44, 0]} scale={0.9} />
    </group>
  );
}

useGLTF.preload("/models/predio.glb");

function ScrollVideo() {
  const navigate = useNavigate();
  const secaoRef = useRef(null);
  const canvasRef = useRef(null);
  const movimentoPredioRef = useRef({
  rotacaoY: -0.55,
  distancia: CAMERA_MEIO.z,
  altura: CAMERA_MEIO.y,
});
  const invalidarRef = useRef(null);

  useEffect(() => {
    const secao = secaoRef.current;
    const canvas = canvasRef.current;
    const pedirRender = () => invalidarRef.current?.();
    if (!secao || !canvas) return undefined;

  const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return undefined;

    const imagens = new Array(TOTAL_FRAMES);
    const estado = { frame: 0 };
    let ultimoDesenhado = -1;
    let ativo = true;
    let frameInicialRaf = 0;

    const pronta = (img) => img && img.complete && img.naturalWidth > 0;


    const desenhar = () => {
      const indiceDesejado = Math.min(
        TOTAL_FRAMES - 1,
        Math.max(0, Math.round(estado.frame))
      );

      let indiceDisponivel = indiceDesejado;
      while (indiceDisponivel > 0 && !pronta(imagens[indiceDisponivel])) {
        indiceDisponivel--;
      }

      const img = imagens[indiceDisponivel];
      if (!pronta(img) || indiceDisponivel === ultimoDesenhado) return;

      ultimoDesenhado = indiceDisponivel;
      const cw = canvas.width;
      const ch = canvas.height;
      const escala = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const largura = img.naturalWidth * escala;
      const altura = img.naturalHeight * escala;

      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(
        img,
        (cw - largura) / 2,
        (ch - altura) / 2,
        largura,
        altura
      );
    };

    const ajustarTamanho = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ultimoDesenhado = -1;
      desenhar();
    };


    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (!ativo) return;
        if (i === 0 || i === Math.round(estado.frame)) desenhar();
      };
      img.src = caminhoDoFrame(PRIMEIRO_FRAME + i);
      imagens[i] = img;
    }

    const observador = new ResizeObserver(ajustarTamanho);
    observador.observe(canvas);
    ajustarTamanho();

    const mm = gsap.matchMedia(secao);

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
  id: "abertura-cidade",
  trigger: secao,
  start: "top top",
  end: DURACAO_DO_SCROLL,
  scrub: 0.6,
  pin: true,
  anticipatePin: 1,
  invalidateOnRefresh: true,
  refreshPriority: 1,
},
      });
    const pins = [".sv-pin-a", ".sv-pin-b", ".sv-pin-c"].map((s) =>
  secao.querySelector(s)
);


const centro = (el, eixo) =>
  eixo === "x"
    ? el.offsetLeft + el.offsetWidth / 2 - secao.clientWidth / 2
    : el.offsetTop + el.offsetHeight / 2 - secao.clientHeight / 2;


const focar = (alvo, quando) => {
  const e = ZOOM_CARD;
  const dur = 0.55;
  const ease = "power2.inOut";

  tl.to(
    ".sv-cena",
    {
      scale: e,
      x: () => (1 - e) * centro(pins[alvo], "x"),
      y: () => (1 - e) * centro(pins[alvo], "y"),
      duration: dur,
      ease,
    },
    quando
  );

  pins.forEach((el) => {
    tl.to(
      el,
      {
        x: () => (e - 1) * (centro(el, "x") - centro(pins[alvo], "x")),
        y: () => (e - 1) * (centro(el, "y") - centro(pins[alvo], "y")),
        duration: dur,
        ease,
      },
      quando
    );
  });
};
     
      tl.to(
        estado,
        {
          frame: TOTAL_FRAMES - 1,
          duration: 5,
          onUpdate: desenhar,
        },
        0
      );

   
      tl.to(
        ".sv-hero-texto",
        {
          autoAlpha: 0,
          z: -700,
          scale: 0.38,
          y: 30,
          filter: "blur(8px)",
          transformOrigin: "center center",
          duration: 0.9,
          ease: "power2.in",
        },
        0.25
      );

  
tl.fromTo(
  ".sv-predio",
  { autoAlpha: 0 },
  { autoAlpha: 1, duration: 0.25, ease: "power1.out" },
  1.2
);

tl.fromTo(
  movimentoPredioRef.current,
  { distancia: CAMERA_INICIO.z, altura: CAMERA_INICIO.y },
  {
    distancia: CAMERA_MEIO.z,
    altura: CAMERA_MEIO.y,
    duration: 1.2,
    ease: "power3.inOut",
    onUpdate: pedirRender,
  },
  1.2
);

ScrollTrigger.refresh();

tl.fromTo(
  movimentoPredioRef.current,
  { rotacaoY: -0.55 },
  { rotacaoY: 0.65, duration: 3, ease: "none", onUpdate: pedirRender },
  1.2
);

   
      const entrarPin = (seletor, quando) =>
  tl.fromTo(
    seletor,
    { autoAlpha: 0, yPercent: 12, scale: 0.92 },
    {
      autoAlpha: 1,
      yPercent: 0,
      scale: 1,
      duration: 0.55,
      ease: "back.out(1.2)",
    },
    quando
  );

entrarPin(".sv-pin-a", 2.1);
entrarPin(".sv-pin-b", 2.7);
entrarPin(".sv-pin-c", 3.3);


focar(0, 2.1);
focar(1, 2.7);
focar(2, 3.3);

// volta tudo ao normal
tl.to(".sv-cena", { scale: 1, x: 0, y: 0, duration: 0.7, ease: "power2.inOut" }, 3.95);
tl.to(".sv-pin", { x: 0, y: 0, duration: 0.7, ease: "power2.inOut" }, 3.95);


tl.fromTo(
  movimentoPredioRef.current,
  { distancia: CAMERA_MEIO.z, altura: CAMERA_MEIO.y },
  {
    distancia: CAMERA_FINAL.z,
    altura: CAMERA_FINAL.y,
    duration: 1.1,
    ease: "power2.in",
    immediateRender: false,
    onUpdate: pedirRender,
  },
  3.9
);

tl.to(".sv-predio", { autoAlpha: 0, duration: 0.5, ease: "power1.in" }, 4.5);

tl.to(
  ".sv-pin",
  { autoAlpha: 0, yPercent: -8, duration: 0.4, ease: "power2.in", stagger: 0.08 },
  4.0
);

tl.to(
  secao,
  {
    scale: 0.975,
    borderRadius: 36,
    boxShadow: "inset 0 0 0 2px rgba(255, 255, 255, 0.22)",
    transformOrigin: "50% 60%",
    duration: 0.7,
    ease: "power2.inOut",
  },
  4.3
);


tl.to(".sv-veu", { opacity: 1.6, duration: 0.7, ease: "power1.in" }, 4.3);
      return () => tl.kill();
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      estado.frame = 0;
      desenhar();
     gsap.set(".sv-predio", { autoAlpha: 1 });
movimentoPredioRef.current.distancia = CAMERA_MEIO.z;
pedirRender();
    });
frameInicialRaf = requestAnimationFrame(() => {
  ScrollTrigger.refresh();

  const trigger = ScrollTrigger.getById("abertura-cidade");

  const destino = trigger
    ? trigger.start
    : secao.getBoundingClientRect().top + window.scrollY;

  if (window.__cidadeAtivaLenis) {
    window.__cidadeAtivaLenis.scrollTo(destino, {
      immediate: true,
    });
  } else {
    window.scrollTo(0, destino);
  }

  ScrollTrigger.update();
});
    return () => {
  ativo = false;

  cancelAnimationFrame(frameInicialRaf);
  observador.disconnect();
  mm.revert();
  imagens.forEach((img) => {
    if (img) img.onload = null;
  });
};
  }, []);

  return (
    <section className="sv-secao" id="inicio" ref={secaoRef}>
  <div className="sv-cena">
    <canvas className="sv-canvas" ref={canvasRef} role="img" aria-label="..." />
    <div className="sv-veu" aria-hidden="true" />
    <div className="sv-predio" aria-hidden="true">
  <Canvas
    camera={{ position: [0, CAMERA_MEIO.y, CAMERA_MEIO.z], fov: 40, near: 0.1, far: 300 }}
    frameloop="demand"
    dpr={[1, 1.25]}
    gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
    onCreated={({ invalidate }) => {
      invalidarRef.current = invalidate;
    }}
    style={{ width: "100%", height: "100%" }}
  >
    <ambientLight intensity={1.4} />
    <directionalLight position={[10, 20, 15]} intensity={2.2} />
    <Suspense fallback={null}>
      <PredioModelo movimentoRef={movimentoPredioRef} />
    </Suspense>
  </Canvas>
</div>
</div>

     <div className="home-pin sv-pin sv-pin-a" aria-hidden="true">
  <span className="home-pin-ponto ponto-analise" />
  <span className="sv-pin-info">
    <small className="sv-pin-cat">Iluminação pública</small>
    <strong>Poste sem luz</strong>
    <span className="sv-pin-end">Av. Centenário, 1200 · Centro</span>
    <span className="sv-pin-meta">
      <em>Em análise</em>
      <span>#CA-2841 · há 2 dias</span>
    </span>
  </span>
</div>

<div className="home-pin sv-pin sv-pin-b" aria-hidden="true">
  <span className="home-pin-ponto ponto-registrada" />
  <span className="sv-pin-info">
    <small className="sv-pin-cat">Calçadas danificadas</small>
    <strong>Buraco na calçada</strong>
    <span className="sv-pin-end">Rua das Palmeiras, 85 · Pinheirinho</span>
    <span className="sv-pin-meta">
      <em>Registrada</em>
      <span>#CA-2907 · hoje</span>
    </span>
  </span>
</div>

<div className="home-pin sv-pin sv-pin-c" aria-hidden="true">
  <span className="home-pin-ponto ponto-resolvida" />
  <span className="sv-pin-info">
    <small className="sv-pin-cat">Lixo e entulho</small>
    <strong>Lixo acumulado</strong>
    <span className="sv-pin-end">Praça Nova, esquina com Rua 7 · Santa Bárbara</span>
    <span className="sv-pin-meta">
      <em>Resolvida</em>
      <span>#CA-2716 · em 3 dias</span>
    </span>
  </span>
</div>

    
      <div className="sv-hero-texto">
        <h1 className="home-h1">
          <span className="linha">
            <span>A cidade fala.</span>
          </span>
          <span className="linha">
            <span>O NexBuild</span>
          </span>
          <span className="linha">
            <span>transforma em ação.</span>
          </span>
        </h1>

        <p className="home-lead">
          Conectamos cidadãos e equipes em uma plataforma inteligente de gestão de ocorrências urbanas. Registre demandas, organize informações e acompanhe o trabalho da cidade.
        </p>

        <div className="home-botoes">
          <button
            type="button"
            className="home-botao"
            onClick={() => navigate("/denuncia")}
          >
            Registrar ocorrência
          </button>
          <button
            type="button"
            className="home-botao home-botao-sec"
            onClick={() => navigate("/login")}
          >
            Acessar a gestão
          </button>
        </div>

        <p className="home-dica">Role a página para voar sobre a cidade</p>
      </div>
    </section>
  );
}

export default ScrollVideo;
