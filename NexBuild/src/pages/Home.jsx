import { useLayoutEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "@studio-freight/lenis";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/instrument-sans";
import "./Home.css";
import ScrollVideo from "./ScrollVideo";
import AnimatedText from "./AnimatedText.jsx";
import { useTema } from "./useTema";
gsap.registerPlugin(ScrollTrigger);
import dashboard from "./imagens/dashboard-real.png";
import dashboardMapa from "./imagens/mapa-real.png";


function IconePin({ tamanho = 28 }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function IconeUsuario({ tamanho = 28 }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  );
}

function IconeMapa({ tamanho = 28 }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}
function IconeSol({ tamanho = 20 }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function IconeLua({ tamanho = 20 }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
function RuasDecorativas() {
  return (
    <svg
      className="home-card-ruas"
      viewBox="0 0 320 200"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.5" opacity="0.5">
        <path d="M0 60h320M0 130h320M70 0v200M170 0v200M250 0v200" />
        <path d="M0 190 320 20" strokeDasharray="6 6" />
      </g>
      <circle cx="170" cy="130" r="22" fill="#FFC21A" opacity="0.25" />
      <circle cx="170" cy="130" r="8" fill="#FFC21A" />
    </svg>
  );
}
function FiltroVidro() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
      focusable="false"
    >
      <filter
        id="frosted"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.008 0.008"
          numOctaves="2"
          seed="92"
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="blurred"
          scale="40"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
const CATEGORIAS = [
  "Buracos na via",
  "Iluminação pública",
  "Lixo e entulho",
  "Calçadas danificadas",
  "Esgoto e drenagem",
  "Árvores e podas",
  "Sinalização",
];

const ETAPAS = [
  {
    titulo: "Registre a ocorrência",
    texto: "Informe o problema e marque o local. Seu registro chega à plataforma para análise da equipe responsável.",
  },
  {
    titulo: "Organize a demanda",
    texto: "No painel de gestão, as equipes podem classificar, priorizar e acompanhar as ocorrências em um só lugar.",
  },
  {
    titulo: "Acompanhe a evolução",
    texto: "Da análise ao encaminhamento, o URBENT ajuda a manter o histórico e a organizar as próximas ações.",
  },
];

const RECURSOS = [
  { numero: "01", titulo: "Central de ocorrências", texto: "Registros, localização, prioridades e status reunidos em uma interface de gestão." },
  { numero: "02", titulo: "Equipes conectadas", texto: "Organização de tarefas e comunicação para apoiar o trabalho entre setores." },
  { numero: "03", titulo: "Decisões com contexto", texto: "Dados e histórico das demandas para apoiar a análise e o planejamento urbano." },
];

function Home() {
  const { tema, alternar } = useTema();
  const navigate = useNavigate();
  const mainRef = useRef(null);
  const lenisRef = useRef(null);
  const reduzir = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );


 
useLayoutEffect(() => {
  let lenis = null;
  let tick = null;

  if (!reduzir) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
lenisRef.current = lenis;

window.__cidadeAtivaLenis = lenis;

lenis.on("scroll", ScrollTrigger.update);

    tick = (tempo) => lenis.raf(tempo * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
  }

  const mm = gsap.matchMedia(mainRef);

  const entrada = () => {
    gsap.from(".home-h1 .linha > span", {
      yPercent: 110,
      duration: 1.1,
      ease: "power4.out",
      stagger: 0.12,
      delay: 0.15,
    });

    gsap.from(".home-lead, .home-botoes", {
      autoAlpha: 0,
      y: 24,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.12,
      delay: 0.7,
    });
  };

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    entrada();

gsap.fromTo(
  ".home-etapas-lista li",
  {
    autoAlpha: 0,
    y: 75,
    scale: 0.94,
    rotateX: 8,
    filter: "blur(8px)",
  },
  {
    autoAlpha: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    filter: "blur(0px)",
    duration: 1.1,
    stagger: 0.18,
    ease: "power3.out",
    scrollTrigger: {
      trigger: ".home-etapas-lista",
      start: "top 80%",
      toggleActions: "play none none reverse",
  
    },
  }
);


gsap.fromTo(
  ".home-card",
  {
    autoAlpha: 0,
    y: 100,
    scale: 0.92,
    rotateX: 10,
    filter: "blur(10px)",
  },
  {
    autoAlpha: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    filter: "blur(0px)",
    duration: 1.2,
    stagger: 0.2,
    ease: "power3.out",
    scrollTrigger: {
      trigger: ".home-cards",
      start: "top 82%",
      toggleActions: "play none none reverse",
     
    },
  }
);
    const elemento = mainRef.current?.querySelector(
      "[data-text-reveal]"
    );

    if (!elemento) return;

    const textoOriginal = elemento.innerHTML;
    const palavras = elemento.textContent.split(/(\s+)/);
    const fragmento = document.createDocumentFragment();

    palavras.forEach((palavra) => {
      if (!palavra.trim()) {
        fragmento.appendChild(document.createTextNode(palavra));
        return;
      }

      const mascara = document.createElement("span");
      mascara.className = "texto-mascara";

      const palavraInterna = document.createElement("span");
      palavraInterna.className = "texto-palavra";
      palavraInterna.textContent = palavra;

      mascara.appendChild(palavraInterna);
      fragmento.appendChild(mascara);
    });

    elemento.replaceChildren(fragmento);

    gsap.fromTo(
      elemento.querySelectorAll(".texto-palavra"),
      {
        yPercent: 110,
        opacity: 0,
        filter: "blur(5px)",
      },
      {
        yPercent: 0,
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.8,
        stagger: 0.045,
        ease: "power3.out",
        scrollTrigger: {
        trigger: elemento,
        start: "top 80%",
        toggleActions: "play none none reverse",
        markers: false,
},
      }
    );

    ScrollTrigger.refresh();

    return () => {
      elemento.innerHTML = textoOriginal;
    };
  });

  return () => {
    mm.revert();

    if (tick) gsap.ticker.remove(tick);

if (lenis) {
  if (window.__cidadeAtivaLenis === lenis) {
    delete window.__cidadeAtivaLenis;
  }

  lenis.destroy();
}

lenisRef.current = null;
  };
}, [reduzir]);


  const irPara = (e, alvo) => {
    e.preventDefault();
    if (lenisRef.current) {
      lenisRef.current.scrollTo(alvo, {
        duration: 1.5,
        offset: alvo === "#inicio" ? 0 : -96,
      });
    } else {
      document.querySelector(alvo)?.scrollIntoView({ behavior: "auto" });
    }
  };

  const sair = () => {
    gsap.to(mainRef.current, {
      opacity: 0,
      y: -20,
      duration: reduzir ? 0 : 0.5,
      ease: "power2.in",
      onComplete: () => navigate("/login"),
    });
  };

  return (
    <div className="home-container" ref={mainRef}>
      <FiltroVidro />
      <header className="home-header">
        <a
          className="home-logo"
          href="#inicio"
          onClick={(e) => irPara(e, "#inicio")}
          aria-label="NexBuild, voltar ao início"
        >
          <span className="home-logo-marca" aria-hidden="true">
            <IconePin tamanho={18} />
          </span>
          NexBuild
        </a>

        <nav className="home-nav" aria-label="Principal">
          <a href="#inicio" onClick={(e) => irPara(e, "#inicio")}>
            Início
          </a>
          <a
            href="#como-funciona"
            onClick={(e) => irPara(e, "#como-funciona")}
          >
            Como funciona
          </a>
          <a href="#plataforma" onClick={(e) => irPara(e, "#plataforma")}>
            Plataforma
          </a>
          <a href="#dashboard" onClick={(e) => irPara(e, "#dashboard")}>
            Dashboard
          </a>
          <a href="#acoes" onClick={(e) => irPara(e, "#acoes")}>
            Começar
          </a>
          <button
          type="button"
          className="home-tema"
          onClick={alternar}
          aria-pressed={tema === "dark"}
          aria-label={tema === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
>
  {tema === "dark" ? <IconeSol /> : <IconeLua />}
</button>
          <button type="button" className="home-sair" onClick={sair}>
            Sair
          </button>
        </nav>
      </header>

      <nav className="home-mobile-bar" aria-label="Navegação da página inicial no celular">
        <a href="#inicio" onClick={(e) => irPara(e, "#inicio")} aria-label="Início"><IconePin tamanho={20}/><span>Início</span></a>
        <a href="#como-funciona" onClick={(e) => irPara(e, "#como-funciona")} aria-label="Como funciona"><IconeMapa tamanho={20}/><span>Sobre</span></a>
        <a href="#plataforma" onClick={(e) => irPara(e, "#plataforma")} aria-label="Plataforma"><IconeUsuario tamanho={20}/><span>Plataforma</span></a>
        <button type="button" onClick={alternar} aria-label={tema === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}>
          {tema === "dark" ? <IconeSol tamanho={20}/> : <IconeLua tamanho={20}/>}
          <span>Tema</span>
        </button>
        <button type="button" onClick={sair} aria-label="Acessar área de gestão"><span className="home-mobile-login-icon" aria-hidden="true">↗</span><span>Entrar</span></button>
      </nav>

      <main>
       
        <ScrollVideo />

      
        

        <section className="home-etapas" id="como-funciona">
          <div className="home-etapas-titulo">
            <span className="home-kicker">UMA CIDADE MAIS CONECTADA</span>
            <h2>Da ocorrência à ação. Tudo conectado.</h2>
            
<AnimatedText>
  O cidadão participa. A gestão organiza. O URBENT conecta as duas pontas em uma experiência digital mais simples.
</AnimatedText>

          </div>

          <ol className="home-etapas-lista">
            {ETAPAS.map((etapa, i) => (
              <li key={etapa.titulo}>
                <span className="home-etapa-num" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3>{etapa.titulo}</h3>
                  <AnimatedText>{etapa.texto}</AnimatedText>
                </div>
              </li>
            ))}
          </ol>
        </section>

     
        <section className="home-plataforma" id="plataforma" aria-labelledby="plataforma-titulo">
          <div className="home-plataforma-cabecalho">
            <span className="home-kicker">URBENT / SOFTWARE COMO SERVIÇO</span>
            <h2 id="plataforma-titulo">Mais que um canal de denúncias. Uma plataforma para a cidade.</h2>
            <p>O URBENT é uma solução SaaS de gestão de ocorrências urbanas. Ele reúne registros dos cidadãos e ferramentas de organização para apoiar equipes e gestores no dia a dia.</p>
          </div>
          <div className="home-plataforma-grid">
            {RECURSOS.map((recurso) => (
              <article className="home-recurso" key={recurso.numero}>
                <span className="home-recurso-num">{recurso.numero} / URBENT</span>
                <h3>{recurso.titulo}</h3>
                <p>{recurso.texto}</p>
              </article>
            ))}
          </div>
          <div className="home-plataforma-rodape">
            <span>Uma plataforma. Diferentes etapas da gestão urbana.</span>
            <button type="button" className="home-botao" onClick={() => navigate("/login")}>Acessar área de gestão</button>
          </div>
        </section>


        <section className="home-showcase" id="dashboard" aria-labelledby="showcase-titulo">
          <div className="home-showcase-heading">
            <span className="home-kicker">POR DENTRO DO URBENT</span>
            <h2 id="showcase-titulo">Toda a cidade. <em>Uma única visão.</em></h2>
            <p>Do primeiro registro ao acompanhamento das equipes, as informações ficam reunidas em um painel pensado para tornar a gestão de ocorrências mais clara e organizada.</p>
          </div>
          <div className="home-showcase-grid">
            <div className="home-screenshot-wrap">
              <div className="home-window-bar"><span className="home-window-dots" aria-hidden="true"><i/><i/><i/></span><span>URBENT / painel administrativo</span><span className="home-window-live">TELA REAL</span></div>
              <img src={dashboard} alt="Captura real do dashboard URBENT com indicadores de denúncias, ocorrências recentes e mapa" loading="lazy" />
            </div>
            <div className="home-showcase-copy">
              <span className="home-feature-index">01 / PAINEL DE GESTÃO</span>
              <h3>Informação que ajuda a decidir.</h3>
              <p>Indicadores de ocorrências, prioridades e status oferecem uma visão centralizada para as equipes acompanharem as demandas.</p>
              <div className="home-feature-tags"><span>Indicadores</span><span>Prioridades</span><span>Acompanhamento</span></div>
            </div>
          </div>
        </section>

        <section className="home-showcase home-showcase-map" id="mapa" aria-labelledby="mapa-titulo">
          <div className="home-showcase-grid home-showcase-grid-reverse">
            <div className="home-screenshot-wrap">
              <div className="home-window-bar"><span className="home-window-dots" aria-hidden="true"><i/><i/><i/></span><span>URBENT / mapa de ocorrências</span><span className="home-window-live">TELA REAL</span></div>
              <img src={dashboardMapa} alt="Captura real do mapa administrativo do URBENT com marcadores de gravidade e lista de ocorrências" loading="lazy" />
            </div>
            <div className="home-showcase-copy">
              <span className="home-feature-index">02 / INTELIGÊNCIA TERRITORIAL</span>
              <h2 id="mapa-titulo">Cada ocorrência tem um lugar. Cada decisão, uma direção.</h2>
              <p>Visualize a distribuição geográfica das demandas, consulte registros e identifique áreas que precisam de atenção.</p>
              <p className="home-feature-note">O mapa completo mostrado aqui pertence à área administrativa. Uma versão pública pode ser disponibilizada futuramente, com proteção de dados.</p>
            </div>
          </div>
        </section>

        <section className="home-ia" id="inteligencia-artificial" aria-labelledby="ia-titulo">
          <div className="home-ia-heading"><span className="home-kicker">INTELIGÊNCIA ARTIFICIAL · APOIO À GESTÃO</span><h2 id="ia-titulo">Menos tempo organizando. <em>Mais tempo resolvendo.</em></h2><p>A IA pode apoiar a leitura e a organização das ocorrências. As decisões e os encaminhamentos continuam sob responsabilidade das equipes.</p></div>
          <div className="home-ia-fluxo">
            <article><span>01</span><h3>O cidadão registra</h3><p>Descrição, categoria e localização chegam à plataforma.</p></article>
            <article><span>02</span><h3>A IA apoia a análise</h3><p>Resumos e sugestões podem facilitar a triagem, com revisão humana.</p></article>
            <article><span>03</span><h3>A equipe decide</h3><p>Gestores avaliam prioridades e acompanham o andamento.</p></article>
          </div>
          <p className="home-ia-aviso">Fluxo ilustrativo do uso de IA; a disponibilidade depende das funcionalidades habilitadas na instalação.</p>
        </section>

        <section className="home-acoes" id="acoes">
          <span className="home-kicker">PARTICIPE OU ACESSE</span>
          <h2>Como você quer começar?</h2>

          <div className="home-cards">
            <article className="home-card home-card-principal">
              <div className="home-card-aneis" aria-hidden="true" />
              <span className="home-card-icone">
                <IconePin tamanho={34} />
              </span>
              <div className="home-card-corpo">
                <h3>Nova ocorrência</h3>
                <AnimatedText>
                  Ajude a identificar o que precisa de atenção. Registre o problema e indique onde ele aconteceu, sem precisar criar uma conta.
              </AnimatedText>
                <button
                  type="button"
                  className="home-botao home-botao-sec"
                  onClick={() => navigate("/denuncia")}
                >
                  Registrar ocorrência
                </button>
              </div>
            </article>

            <article className="home-card home-card-mapa">
              <RuasDecorativas />
              <span className="home-card-icone">
                <IconeMapa tamanho={30} />
              </span>
              <div className="home-card-corpo">
                <h3>Visão territorial</h3>
                <AnimatedText>Visualize e organize registros geolocalizados na área de gestão.</AnimatedText>
                <button
                  type="button"
                  className="home-botao home-botao-sec"
                  onClick={() => navigate("/login")}
                >
                  Acessar painel
                </button>
              </div>
            </article>

            <article className="home-card home-card-conta">
              <span className="home-card-icone">
                <IconeUsuario tamanho={30} />
              </span>
              <div className="home-card-corpo">
                <h3>Área da equipe</h3>
                <p>Acesso reservado a administradores e funcionários para gerenciar demandas e tarefas.</p>
                <button
                  type="button"
                  className="home-botao home-botao-sec"
                  onClick={() => navigate("/login")}
                >
                  Entrar na plataforma
                </button>
              </div>
            </article>
          </div>
        </section>

        
        <section className="home-final">
          <h2>Uma cidade melhor começa com um registro.</h2>
          <p>
            Sua participação ajuda a identificar problemas reais. Conte o que aconteceu; o URBENT organiza as informações para a equipe responsável.
          </p>
          <button
            type="button"
            className="home-botao"
            onClick={() => navigate("/denuncia")}
          >
            Registrar ocorrência
          </button>
        </section>
      </main>

      <footer className="home-footer">
        <AnimatedText>© 2026 URBENT. Tecnologia para conectar pessoas, ocorrências e gestão.</AnimatedText>
        <nav aria-label="Rodapé">
          <a href="#inicio" onClick={(e) => irPara(e, "#inicio")}>
            Início
          </a>
          <a
            href="#como-funciona"
            onClick={(e) => irPara(e, "#como-funciona")}
          >
            Como funciona
          </a>
          <a href="#dashboard" onClick={(e) => irPara(e, "#dashboard")}>
            Dashboard
          </a>
          <a href="#acoes" onClick={(e) => irPara(e, "#acoes")}>
            Começar
          </a>
        </nav>
      </footer>
    </div>
  );
}

export default Home;