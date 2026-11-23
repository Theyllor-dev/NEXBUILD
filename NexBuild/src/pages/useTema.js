
import { useCallback, useEffect, useSyncExternalStore } from "react";

const CHAVE = "cidadeativa-tema";
const ouvintes = new Set();

const obterTemaSalvo = () => {
  try {
    const salvo = localStorage.getItem(CHAVE);
    return salvo === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};


if (typeof document !== "undefined") {
  document.documentElement.dataset.theme = obterTemaSalvo();
}

const temaAtual = () => {
  if (typeof document === "undefined") return "light";

  return document.documentElement.dataset.theme === "dark"
    ? "dark"
    : "light";
};

const assinar = (callback) => {
  ouvintes.add(callback);

  return () => ouvintes.delete(callback);
};

const notificar = () => {
  ouvintes.forEach((callback) => callback());
};

const aplicarTema = (novoTema) => {
  document.documentElement.dataset.theme = novoTema;

  try {
    localStorage.setItem(CHAVE, novoTema);
  } catch {}

  notificar();
};

export function useTema() {
  const tema = useSyncExternalStore(
    assinar,
    temaAtual,
    () => "light"
  );

  const alternar = useCallback(() => {
    const novoTema = temaAtual() === "dark" ? "light" : "dark";

    aplicarTema(novoTema);
  }, []);


  useEffect(() => {
    const sincronizar = (evento) => {
      if (evento.key !== CHAVE) return;

      const novoTema = evento.newValue === "dark" ? "dark" : "light";

      document.documentElement.dataset.theme = novoTema;
      notificar();
    };

    window.addEventListener("storage", sincronizar);

    return () => {
      window.removeEventListener("storage", sincronizar);
    };
  }, []);

  return {
    tema,
    alternar,
  };
}
