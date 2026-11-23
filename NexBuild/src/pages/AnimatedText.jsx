import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useTema } from "./useTema";

gsap.registerPlugin(ScrollTrigger, SplitText);

export default function AnimatedText({
  children,
  className = "",
  corInicial,
  corFinal,
  corDestaque = "#80d866",
  inicio = "top 80%",
  fim = "bottom 45%",
  marcadores = false,
}) {
  const { tema } = useTema();
  const elementoRef = useRef(null);

  useLayoutEffect(() => {
    const elemento = elementoRef.current;
    if (!elemento) return;

    let split;
    let ativo = true;

    document.fonts.ready.then(() => {
      if (!ativo) return;

      const css = getComputedStyle(elemento);
      const inicial =
        corInicial ?? (css.getPropertyValue("--texto-inicial").trim() || "#aeb7bd");
      const final =
        corFinal ?? (css.getPropertyValue("--texto").trim() || "#000000");

      split = SplitText.create(elemento, {
        type: "words,lines",
        wordsClass: "animated-word",
        autoSplit: true,

        onSplit(self) {
          gsap.set(self.words, { color: inicial });

          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: elemento,
              start: inicio,
              end: fim,
              scrub: 1,
              markers: marcadores,
              invalidateOnRefresh: true,
            },
          });

          timeline.to(self.words, {
            color: corDestaque,
            stagger: 0.08,
            ease: "none",
          });

          timeline.to(self.words, {
            color: final,
            stagger: 0.08,
            ease: "none",
          });

          return timeline;
        },
      });

      ScrollTrigger.refresh();
    });

    return () => {
      ativo = false;
      split?.revert();
    };
  }, [children, corInicial, corFinal, corDestaque, inicio, fim, marcadores, tema]);

  return (
    <p ref={elementoRef} className={`animated-text ${className}`}>
      {children}
    </p>
  );
}