
import { useEffect, useState } from "react";

import {
  FaFileAlt,
  FaClock,
  FaExclamationTriangle,
  FaCheckCircle
} from "react-icons/fa";

import { API_URL } from "../api";
import "./Indicadores.css";

function NumeroAnimado({ valor, duracao = 1000 }) {
  const [numero, setNumero] = useState(0);

  useEffect(() => {
    const destino = Number(valor);

    if (!Number.isFinite(destino)) {
      setNumero(0);
      return;
    }

    let inicio = null;
    let frame;

    function animar(timestamp) {
      if (inicio === null) inicio = timestamp;

      const progresso = Math.min(
        (timestamp - inicio) / duracao,
        1
      );

      const suavizado = 1 - Math.pow(1 - progresso, 3);

      setNumero(Math.round(destino * suavizado));

      if (progresso < 1) {
        frame = requestAnimationFrame(animar);
      }
    }

    frame = requestAnimationFrame(animar);

    return () => cancelAnimationFrame(frame);
  }, [valor, duracao]);

  return <>{numero}</>;
}

function Indicadores() {
  const [dados, setDados] = useState({
    total: 0,
    emAnalise: 0,
    altaGravidade: 0,
    resolvidas: 0
  });

  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function buscarIndicadores() {
      try {
        const token = localStorage.getItem("token");

        const resposta = await fetch(`${API_URL}/estatisticas`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!resposta.ok) throw new Error(`Erro HTTP ${resposta.status}`);
        const resultado = await resposta.json();
        const totais = resultado.totais || {};

        setDados({
          total: Number(totais.total) || 0,
          emAnalise: Number(totais.emAnalise) || 0,
          altaGravidade: Number(totais.altaGravidade) || 0,
          resolvidas: Number(totais.resolvidas) || 0
        });

      } catch (erro) {
        console.error("Erro ao carregar indicadores:", erro);
      } finally {
        setCarregando(false);
      }
    }

    buscarIndicadores();
    const intervalo = setInterval(buscarIndicadores, 15000);
    window.addEventListener("nexbuild:ocorrencias-alteradas", buscarIndicadores);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("nexbuild:ocorrencias-alteradas", buscarIndicadores);
    };
  }, []);

  const indicadores = [
    {
      titulo: "Total de denúncias",
      valor: dados.total,
      descricao: "Ocorrências registradas",
      classe: "roxo",
      icone: <FaFileAlt />
    },
    {
      titulo: "Em análise",
      valor: dados.emAnalise,
      descricao: "Aguardando revisão",
      classe: "azul",
      icone: <FaClock />
    },
    {
      titulo: "Alta gravidade",
      valor: dados.altaGravidade,
      descricao: "Requer atenção urgente",
      classe: "vermelho",
      icone: <FaExclamationTriangle />
    },
    {
      titulo: "Resolvidas",
      valor: dados.resolvidas,
      descricao: "Problemas solucionados",
      classe: "verde",
      icone: <FaCheckCircle />
    }
  ];

  return (
    <section className="indicadores">
      {indicadores.map((indicador) => (
        <div
          className={`indicador-card ${indicador.classe}`}
          key={indicador.titulo}
        >
          <div className="indicador-info">
            <span className="indicador-titulo">
              {indicador.titulo}
            </span>

            <strong className="indicador-valor">
              {carregando ? (
                "..."
              ) : (
                <NumeroAnimado valor={indicador.valor} />
              )}
            </strong>

            <span className="indicador-descricao">
              {indicador.descricao}
            </span>
          </div>

          <div className="indicador-icone">
            {indicador.icone}
          </div>
        </div>
      ))}
    </section>
  );
}

export default Indicadores;
