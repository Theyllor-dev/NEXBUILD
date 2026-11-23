import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  FaSearch,
  FaChevronRight,
  FaMapMarkerAlt,
  FaRobot,
  FaTimes,
  FaCalendarAlt,
  FaClipboardList,
  FaExclamationTriangle,
  FaSyncAlt,
} from "react-icons/fa";
import { API_URL } from "../api";
import "./ListaDenuncias.css";
import "./ListaDenunciasUX.css";
import "./ListaDenunciasIA.css";
const dataFormatada = (valor, hora = false) => {
  if (!valor) return hora ? "--:--" : "Não informada";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return hora ? "--:--" : "Não informada";
  return hora
    ? data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : data.toLocaleDateString("pt-BR");
};
const classe = (valor) =>
  String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
const formatar = (item) => {
  const local = item.localizacao || {};
  return {
    id: item.id_ocorrencia ?? item.id,
    problema:
      item.titulo ||
      item.categoria_nome ||
      item.categoria ||
      "Ocorrência sem título",
    descricao: item.descricao || "Sem descrição informada.",
    cidade: item.cidade || local.cidade || "Não informada",
    bairro: item.bairro || local.bairro || "Não informado",
    rua: item.rua || item.endereco || local.endereco || "Não informada",
    prioridade: item.prioridade || "Média",
    status: item.status || "Aberta",
    data: dataFormatada(item.data_registro),
    hora: dataFormatada(item.data_registro, true),
    analiseIA: typeof item.observacao_ia === "string" ? item.observacao_ia.trim() : "",
    ia: Boolean(String(item.observacao_ia || "").trim()),
    statusIA: String(item.status_ia || item.status_analise_ia || "").toLowerCase(),
    registroEm: item.data_registro,
  };
};
export default function ListadeDenuncias() {
  const navigate = useNavigate();
  const [denuncias, setDenuncias] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [pesquisa, setPesquisa] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [recarregar, setRecarregar] = useState(0);
  const [atualizandoIA, setAtualizandoIA] = useState(false);
  const buscar = useCallback(async (signal) => {
    setCarregando(true);
    setErro("");
    try {
      const token = localStorage.getItem("token");
      const resposta = await fetch(`${API_URL}/ocorrencias`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal,
      });
      const resultado = await resposta.json();
      if (!resposta.ok)
        throw new Error(
          resultado.erro || "Não foi possível buscar as ocorrências.",
        );
      if (!Array.isArray(resultado))
        throw new Error("O servidor retornou um formato inesperado.");
      if (!signal.aborted) setDenuncias(resultado.map(formatar));
    } catch (e) {
      if (e.name !== "AbortError" && !signal.aborted) setErro(e.message);
    } finally {
      if (!signal.aborted) setCarregando(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    buscar(controller.signal);
    return () => controller.abort();
  }, [buscar, recarregar]);
  useEffect(() => {
    const atualizar = () => setRecarregar((n) => n + 1);
    window.addEventListener("nexbuild:ocorrencias-alteradas", atualizar);
    window.addEventListener("focus", atualizar);
    return () => {
      window.removeEventListener("nexbuild:ocorrencias-alteradas", atualizar);
      window.removeEventListener("focus", atualizar);
    };
  }, []);
  // Atualiza a análise mesmo quando ela chega ao banco após o cadastro.
  // Mantém a ocorrência aberta sincronizada com os dados mais recentes.
  useEffect(() => {
    if (!selecionada?.id) return;
    let ativo = true;
    let emAndamento = false;
    const atualizarAnalise = async () => {
      if (emAndamento || document.visibilityState === "hidden") return;
      emAndamento = true;
      try {
        const token = localStorage.getItem("token");
        const resposta = await fetch(`${API_URL}/ocorrencias`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          cache: "no-store",
        });
        if (!resposta.ok) return;
        const dados = await resposta.json();
        if (!ativo || !Array.isArray(dados)) return;
        const formatadas = dados.map(formatar);
        setDenuncias(formatadas);
        setSelecionada((anterior) =>
          anterior ? formatadas.find((item) => String(item.id) === String(anterior.id)) ?? anterior : null
        );
      } catch (erro) {
        // Uma falha de rede não deve fechar os detalhes da denúncia.
        console.warn("Não foi possível atualizar a análise da IA:", erro);
      } finally {
        emAndamento = false;
      }
    };
    atualizarAnalise();
    const intervalo = window.setInterval(atualizarAnalise, 12000);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
    };
  }, [selecionada?.id]);
  const atualizarIAAgora = async () => {
    if (atualizandoIA) return;
    setAtualizandoIA(true);
    try {
      const token = localStorage.getItem("token");
      const resposta = await fetch(`${API_URL}/ocorrencias`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        cache: "no-store",
      });
      if (!resposta.ok) throw new Error("Não foi possível consultar as ocorrências.");
      const dados = await resposta.json();
      if (!Array.isArray(dados)) throw new Error("Resposta inesperada do servidor.");
      const formatadas = dados.map(formatar);
      setDenuncias(formatadas);
      setSelecionada((anterior) =>
        anterior ? formatadas.find((item) => String(item.id) === String(anterior.id)) ?? anterior : null
      );
    } catch (erro) {
      setErro(erro.message);
    } finally {
      setAtualizandoIA(false);
    }
  };
  useEffect(() => {
    if (!selecionada) return;
    const aoTeclar = (e) => {
      if (e.key === "Escape") setSelecionada(null);
    };
    document.addEventListener("keydown", aoTeclar);
    const html = document.documentElement;
    const body = document.body;
    const htmlAnterior = html.style.overflow;
    const bodyAnterior = body.style.overflow;
    const htmlOverscroll = html.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      html.style.overflow = htmlAnterior;
      body.style.overflow = bodyAnterior;
      html.style.overscrollBehavior = htmlOverscroll;
    };
  }, [selecionada]);
  const filtradas = useMemo(
    () =>
      denuncias.filter((d) => {
        const termo = pesquisa.toLocaleLowerCase("pt-BR").trim();
        const correspondeTexto = [
          d.problema,
          d.bairro,
          d.cidade,
          String(d.id),
        ].some((v) => String(v).toLocaleLowerCase("pt-BR").includes(termo));
        return (
          correspondeTexto &&
          (!filtroPrioridade || d.prioridade === filtroPrioridade) &&
          (!filtroStatus || d.status === filtroStatus)
        );
      }),
    [denuncias, pesquisa, filtroPrioridade, filtroStatus],
  );
  return (
    <section className="lista-denuncias nex-lista">
      <div className="lista-topo nex-topo">
        <div>
          <h2>Ocorrências recentes</h2>
          <p>
            Consulte os registros e acompanhe a situação de cada atendimento.
          </p>
        </div>
        <div className="nex-acoes-topo">
          <button
            type="button"
            className="nex-atualizar"
            onClick={() => setRecarregar((n) => n + 1)}
            disabled={carregando}
          >
            <FaSyncAlt aria-hidden="true" /> Atualizar
          </button>
          <button
            type="button"
            className="nex-ver-todas"
            onClick={() => navigate("/admin/denuncias")}
          >
            Ver todas as denúncias <FaChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="filtros-denuncias nex-filtros">
        <label className="campo-pesquisa">
          <FaSearch aria-hidden="true" />
          <input
            aria-label="Pesquisar ocorrências"
            type="search"
            placeholder="Pesquisar título, local ou ID..."
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar prioridade"
          value={filtroPrioridade}
          onChange={(e) => setFiltroPrioridade(e.target.value)}
        >
          <option value="">Todas as prioridades</option>
          <option value="Alta">Alta</option>
          <option value="Média">Média</option>
          <option value="Baixa">Baixa</option>
        </select>
        <select
          aria-label="Filtrar status"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="Aberta">Aberta</option>
          <option value="Em análise">Em análise</option>
          <option value="Em execução">Em execução</option>
          <option value="Resolvida">Resolvida</option>
        </select>
      </div>
      <p className="nex-contagem" aria-live="polite">
        {carregando
          ? "Carregando..."
          : `Exibindo ${Math.min(filtradas.length, 5)} de ${filtradas.length} ocorrências`}
      </p>
      <div className="tabela-denuncias nex-tabela">
        <div className="tabela-cabecalho">
          <span>ID</span>
          <span>PROBLEMA</span>
          <span>LOCALIZAÇÃO</span>
          <span>PRIORIDADE</span>
          <span>STATUS</span>
          <span></span>
        </div>
        {carregando && (
          <p className="nex-mensagem">Carregando ocorrências...</p>
        )}
        {!carregando && erro && (
          <div className="nex-mensagem mensagem-erro" role="alert">
            {erro}{" "}
            <button type="button" onClick={() => setRecarregar((n) => n + 1)}>
              Tentar novamente
            </button>
          </div>
        )}
        {!carregando && !erro && filtradas.length === 0 && (
          <p className="nex-mensagem">
            Nenhuma ocorrência encontrada. Tente mudar os filtros.
          </p>
        )}
        {!carregando &&
          !erro &&
          filtradas.slice(0, 5).map((d) => (
            <button
              type="button"
              className="denuncia-linha nex-linha"
              key={d.id}
              onClick={() => setSelecionada(d)}
              aria-label={`Abrir ocorrência ${d.id}: ${d.problema}`}
            >
              <span className="denuncia-id">#{d.id}</span>
              <span className="problema">
                <strong>{d.problema}</strong>
                {d.ia && (
                  <small>
                    <FaRobot aria-hidden="true" /> IA analisada
                  </small>
                )}
              </span>
              <span className="localizacao">
                <FaMapMarkerAlt aria-hidden="true" />
                <span>
                  <strong>{d.bairro}</strong>
                  <small>{d.cidade}</small>
                </span>
              </span>
              <span className={`prioridade ${classe(d.prioridade)}`}>
                {d.prioridade}
              </span>
              <span className={`status ${classe(d.status)}`}>{d.status}</span>
              <FaChevronRight className="seta-denuncia" aria-hidden="true" />
            </button>
          ))}
      </div>
      {selecionada &&
        createPortal(
          <div
            className="relatorio-overlay nex-overlay"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSelecionada(null);
            }}
          >
            <section
              className="relatorio-denuncia nex-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="nex-modal-titulo"
            >
              <header className="nex-modal-header">
                <div className="nex-modal-heading">
                  <span className="nex-eyebrow">
                    OCORRÊNCIA #{selecionada.id}
                  </span>
                  <h2 id="nex-modal-titulo">{selecionada.problema}</h2>
                  <p>
                    <FaCalendarAlt aria-hidden="true" /> Registrada em{" "}
                    {selecionada.data} às {selecionada.hora}
                  </p>
                </div>
                <button
                  type="button"
                  className="nex-fechar"
                  aria-label="Fechar detalhes"
                  onClick={() => setSelecionada(null)}
                >
                  <FaTimes />
                </button>
              </header>
              <div className="nex-badges">
                <span
                  className={`nex-chip nex-status ${classe(selecionada.status)}`}
                >
                  {selecionada.status}
                </span>
                <span
                  className={`nex-chip nex-prioridade ${classe(selecionada.prioridade)}`}
                >
                  <FaExclamationTriangle aria-hidden="true" /> Prioridade{" "}
                  {selecionada.prioridade}
                </span>
              </div>
              <div className="nex-modal-conteudo">
                <section className="nex-descricao-simples">
                  <h3>Descrição</h3>
                  <p className="nex-descricao">{selecionada.descricao}</p>
                </section>
                <section className="nex-bloco">
                  <h3>
                    <FaMapMarkerAlt aria-hidden="true" /> Localização
                  </h3>
                  <p className="nex-endereco">{selecionada.rua}</p>
                  <p className="nex-subtexto">
                    {selecionada.bairro}, {selecionada.cidade}
                  </p>
                </section>
                <section className="nex-bloco nex-ia">
                  <h3>
                    <FaRobot aria-hidden="true" /> Análise da IA
                  </h3>
                  {selecionada.ia ? (
                    <p className="nex-descricao">{selecionada.analiseIA}</p>
                  ) : (
                      <div className="nex-ia-pendente" aria-live="polite">
                        {(() => {
                          const falhou = ["erro", "falha", "failed"].includes(selecionada.statusIA);
                          const concluidaSemTexto = ["concluida", "concluído", "concluido"].includes(selecionada.statusIA);
                          const aguardando = !falhou && !concluidaSemTexto &&
                            ["pendente", "processando", "analisando"].includes(selecionada.statusIA);
                          return (
                            <>
                              <div className="nex-ia-estado">
                                {aguardando && <FaSyncAlt className="nex-ia-girando" aria-hidden="true" />}
                                <div>
                                  <strong>{falhou ? "Não foi possível concluir a análise" : aguardando ? (selecionada.statusIA === "pendente" ? "Aguardando análise da IA..." : "IA está analisando sua denúncia...") : "Análise ainda não disponível"}</strong>
                                  <p className="nex-subtexto">
                                    {falhou
                                      ? "A análise falhou. Verifique o servidor e tente novamente quando estiver disponível."
                                      : aguardando
                                        ? "Aguardando o resultado do Ollama. A consulta será atualizada automaticamente."
                                        : "Ainda não recebemos um resultado da IA. Verifique o servidor caso a análise esteja demorando."}
                                  </p>
                                </div>
                              </div>
                              {aguardando && <div className="nex-ia-barra" aria-hidden="true"><span /></div>}
                              <button
                                type="button"
                                className="nex-atualizar"
                                onClick={atualizarIAAgora}
                                disabled={atualizandoIA}
                                style={{ marginTop: 12 }}
                              >
                                <FaSyncAlt aria-hidden="true" />
                                {atualizandoIA ? " Consultando..." : " Verificar análise novamente"}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                  )}
                  <p className="nex-aviso">
                    A sugestão da IA deve ser revisada por um responsável.
                  </p>
                </section>
                <section className="nex-responsavel">
                  <h3>Responsável</h3>
                  <p>
                    Consulte a página de denúncias para gerenciar o atendimento
                    desta ocorrência.
                  </p>
                </section>
              </div>
              <footer className="nex-modal-footer">
                <button type="button" onClick={() => setSelecionada(null)}>
                  Fechar detalhes
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </section>
  );
}
