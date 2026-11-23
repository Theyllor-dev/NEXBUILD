import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import { createPortal } from "react-dom";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import { apiServico } from "../../servicos";
import { API_URL } from "../../api";
import "./MinhasTarefas.css";
const quando = (d) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
const dinheiro = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const tipoUsuario = (() => {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch {
    return {};
  }
})();
const admin =
  tipoUsuario.perfil === "Administrador" ||
  tipoUsuario.tipo_usuario === "Administrador";
export default function MinhasTarefas() {
  const drawerRef = useRef(null);
  const [tarefas, setTarefas] = useState([]),
    [pendentes, setPendentes] = useState([]),
    [avisos, setAvisos] = useState([]);
  const [selecionada, setSelecionada] = useState(null),
    [detalhes, setDetalhes] = useState(null),
    [aba, setAba] = useState("etapas");
  const [filtroEquipe, setFiltroEquipe] = useState("todas"),
    [filtroStatus, setFiltroStatus] = useState("todos"),
    [busca, setBusca] = useState("");
  const [erro, setErro] = useState(""),
    [sucesso, setSucesso] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const [orc, setOrc] = useState({ valor: "", observacoes: "" }),
    [rel, setRel] = useState({
      atividades: "",
      materiais: "",
      observacoes: "",
    }),
    [obs, setObs] = useState("");
  const carregar = useCallback(async () => {
    try {
      if (admin) {
        setPendentes(await apiServico("/os/pendentes"));
      } else {
        const [t, n] = await Promise.all([
          apiServico("/minhas-tarefas"),
          apiServico("/minhas-notificacoes"),
        ]);
        setTarefas(t);
        setAvisos(n);
      }
      setErro("");
    } catch (e) {
      setErro(e.message);
    }
  }, []);
  const carregarDetalhes = useCallback(async (id) => {
    try {
      const d = await apiServico(`/os/${id}`);
      setDetalhes(d);
      setOrc({
        valor: d.orcamento?.valor ?? "",
        observacoes: d.orcamento?.observacoes || "",
      });
      setRel({
        atividades: d.relatorio?.atividades || "",
        materiais: d.relatorio?.materiais || "",
        observacoes: d.relatorio?.observacoes || "",
      });
    } catch (e) {
      setErro(e.message);
    }
  }, []);
  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, 20000);
    const socket = io(API_URL, {
      auth: { token: localStorage.getItem("token") },
    });
    socket.on("os-atualizada", () => {
      carregar();
      setSelecionada((id) => {
        if (id) carregarDetalhes(id);
        return id;
      });
    });
    socket.on("nova-notificacao-servico", carregar);
    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, [carregar, carregarDetalhes]);
  useLayoutEffect(() => {
    if (!selecionada) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.scrollTo({ top: 0, behavior: "instant" });
    const tecla = (e) => {
      if (e.key === "Escape") setSelecionada(null);
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener("keydown", tecla);
    };
  }, [selecionada]);
  useLayoutEffect(() => {
    if (selecionada)
      drawerRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [aba, selecionada]);
  const abrir = (id) => {
    setDetalhes(null);
    setSelecionada(id);
    setAba("etapas");
    setSucesso("");
    carregarDetalhes(id);
  };
  async function agir(acao, mensagem = "Alteração salva.") {
    setOcupado(true);
    setErro("");
    setSucesso("");
    try {
      await acao();
      await Promise.all([
        carregar(),
        selecionada ? carregarDetalhes(selecionada) : Promise.resolve(),
      ]);
      setSucesso(mensagem);
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }
  async function anexo(e) {
    const file = e.target.files?.[0];
    if (!file || !selecionada) return;
    if (file.size > 5 * 1024 * 1024)
      return setErro("Arquivo deve ter no máximo 5 MB.");
    const data = new FormData();
    data.append("arquivo", file);
    await agir(async () => {
      const r = await fetch(`${API_URL}/os/${selecionada}/anexos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: data,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(j.erro || `HTTP ${r.status}`);
    }, "Arquivo enviado.");
    e.target.value = "";
  }
  async function baixar(a) {
    try {
      const r = await fetch(
        `${API_URL}/os/${selecionada}/anexos/${a.id_anexo}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
        },
      );
      if (!r.ok) throw Error("Não foi possível baixar o anexo.");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.nome_original;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setErro(e.message);
    }
  }
  const equipes = [
    ...new Map(
      pendentes.map((t) => [
        String(t.id_equipe),
        { id: String(t.id_equipe), nome: t.equipe_nome },
      ]),
    ).values(),
  ].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const tarefasAdmin = pendentes.filter(
    (t) =>
      (filtroEquipe === "todas" || String(t.id_equipe) === filtroEquipe) &&
      (filtroStatus === "todos" ||
        (filtroStatus === "orcamento" && t.status_orcamento === "Pendente") ||
        (filtroStatus === "conclusao" && t.status_conclusao === "Solicitada") ||
        (filtroStatus === "relatorio" && Number(t.total_relatorios) > 0) ||
        (filtroStatus === "andamento" && t.status_conclusao !== "Aprovada")) &&
      `${t.titulo} ${t.equipe_nome} ${t.id_ocorrencia}`
        .toLowerCase()
        .includes(busca.toLowerCase()),
  );
  const total = detalhes?.etapas?.length || 0,
    feitas = detalhes?.etapas?.filter((e) => e.concluida).length || 0;
  return (
    <div className="admin">
      <Sidebar />
      <main className="admin-content">
        <Header />
        <section className="nex-tarefas">
          <div className="os-heading os-heading-v2">
            <div>
              <span className="os-kicker">NEXBUILD · OPERAÇÕES</span>
              <h1>{admin ? "Central de operações" : "Central de tarefas"}</h1>
              <p>
                {admin
                  ? "Acompanhe as equipes e aprove orçamentos e conclusões."
                  : "Acompanhe as etapas, orçamento, anexos e relatório da sua equipe."}
              </p>
            </div>
            <button type="button" className="os-refresh-v2" onClick={carregar} disabled={ocupado}>↻ Atualizar</button>
          </div>
          {erro && (
            <p className="nex-tarefas-erro" role="alert">
              {erro}
            </p>
          )}
          {sucesso && (
            <p className="os-success" role="status">
              {sucesso}
            </p>
          )}
          {admin && (
            <>
              <div className="os-metrics os-admin-metrics">
                <div>
                  <strong>{pendentes.length}</strong>
                  <span>Ordens distribuídas</span>
                </div>
                <div>
                  <strong>
                    {
                      pendentes.filter((t) => t.status_orcamento === "Pendente")
                        .length
                    }
                  </strong>
                  <span>Orçamentos para aprovar</span>
                </div>
                <div>
                  <strong>
                    {
                      pendentes.filter(
                        (t) => t.status_conclusao === "Solicitada",
                      ).length
                    }
                  </strong>
                  <span>Conclusões pendentes</span>
                </div>
                <div>
                  <strong>
                    {
                      pendentes.filter((t) => Number(t.total_relatorios) > 0)
                        .length
                    }
                  </strong>
                  <span>Relatórios recebidos</span>
                </div>
              </div>
              <div className="os-admin-filters">
                <div className="os-filter-title">
                  <h2>Equipes operacionais</h2>
                  <span>{equipes.length} equipes com serviços</span>
                </div>
                <div className="os-team-pills">
                  <button
                    className={filtroEquipe === "todas" ? "ativo" : ""}
                    onClick={() => setFiltroEquipe("todas")}
                  >
                    Todas as equipes <small>{pendentes.length}</small>
                  </button>
                  {equipes.map((e) => (
                    <button
                      key={e.id}
                      className={filtroEquipe === e.id ? "ativo" : ""}
                      onClick={() => setFiltroEquipe(e.id)}
                    >
                      {e.nome}{" "}
                      <small>
                        {
                          pendentes.filter((t) => String(t.id_equipe) === e.id)
                            .length
                        }
                      </small>
                    </button>
                  ))}
                </div>
                <div className="os-filter-controls">
                  <label>
                    Pesquisar serviço
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Título, equipe ou número da OS"
                    />
                  </label>
                  <label>
                    Situação
                    <select
                      value={filtroStatus}
                      onChange={(e) => setFiltroStatus(e.target.value)}
                    >
                      <option value="todos">Todos os serviços</option>
                      <option value="andamento">Em acompanhamento</option>
                      <option value="orcamento">Orçamentos pendentes</option>
                      <option value="relatorio">Com relatório técnico</option>
                      <option value="conclusao">Conclusões para validar</option>
                    </select>
                  </label>
                </div>
              </div>
            </>
          )}
          {!admin && (
            <>
              <div className="os-metrics">
                <div>
                  <strong>{tarefas.length}</strong>
                  <span>Serviços atribuídos</span>
                </div>
                <div>
                  <strong>
                    {
                      tarefas.filter((t) => t.status === "Em atendimento")
                        .length
                    }
                  </strong>
                  <span>Em atendimento</span>
                </div>
                <div>
                  <strong>{avisos.filter((a) => !a.lida).length}</strong>
                  <span>Novas notificações</span>
                </div>
              </div>
              <h2>Notificações</h2>
              <div className="os-notices">
                {avisos.filter((a) => !a.lida).length === 0 ? (
                  <p>Você está em dia. Nenhuma notificação pendente.</p>
                ) : (
                  avisos
                    .filter((a) => !a.lida)
                    .map((a) => (
                      <div key={a.id_notificacao}>
                        <span>{a.mensagem}</span>
                        <button
                          onClick={() =>
                            agir(() =>
                              apiServico(
                                `/minhas-notificacoes/${a.id_notificacao}/lida`,
                                { method: "PUT" },
                              ),
                            )
                          }
                        >
                          Marcar lida
                        </button>
                      </div>
                    ))
                )}
              </div>
            </>
          )}
          <div className="os-list-heading-v2">
            <div>
              <span className="os-kicker">ACOMPANHAMENTO</span>
              <h2>{admin ? "Ordens de serviço" : "Serviços da equipe"} <span className="os-count-v2">{admin ? tarefasAdmin.length : tarefas.length}</span></h2>
            </div>
            <span className="os-list-caption-v2">Selecione uma ordem para acompanhar as etapas</span>
          </div>
          <div className="nex-tarefas-grid">
            {(admin ? tarefasAdmin : tarefas).length === 0 ? (
              <div className="os-empty">
                {admin
                  ? "Nenhuma ordem encontrada para estes filtros."
                  : "Sua equipe ainda não recebeu serviços. Peça ao administrador que encaminhe uma ocorrência para sua equipe."}
              </div>
            ) : (
              (admin ? tarefasAdmin : tarefas).map((t) => (
                <article
                  key={t.id_ocorrencia}
                  className="os-task os-task-v2"
                  onClick={() => abrir(t.id_ocorrencia)}
                >
                  <div className="nex-tarefas-top">
                    <span className="os-kicker">OS #{t.id_ocorrencia}</span>
                    <span className="os-pill">{t.status}</span>
                  </div>
                  <h3>{t.titulo}</h3>
                  <p>{admin ? t.equipe_nome : t.descricao}</p>
                  {admin && (
                    <div className="os-admin-tags">
                      <span>
                        {t.status_orcamento === "Pendente"
                          ? "💰 Orçamento pendente"
                          : t.status_orcamento === "Aprovado"
                            ? "✓ Orçamento aprovado"
                            : "Orçamento: " +
                              (t.status_orcamento || "não enviado")}
                      </span>
                      <span>
                        {Number(t.total_relatorios) > 0
                          ? "📄 Relatório recebido"
                          : "Relatório pendente"}
                      </span>
                      <span>
                        {t.status_conclusao === "Solicitada"
                          ? "⚑ Conclusão para validar"
                          : t.status_conclusao === "Aprovada"
                            ? "✓ Concluído"
                            : "Em acompanhamento"}
                      </span>
                      <span>{Number(t.etapas_concluidas) || 0}/7 etapas</span>
                    </div>
                  )}
                  {!admin && (
                    <small>
                      {[t.endereco, t.bairro, t.cidade]
                        .filter(Boolean)
                        .join(", ")}
                    </small>
                  )}
                  <button
                    className="os-main-btn"
                    onClick={() => abrir(t.id_ocorrencia)}
                  >
                    Ver detalhes →
                  </button>
                </article>
              ))
            )}
          </div>
          {selecionada &&
            createPortal(
              <div className="nex-tarefas os-portal-root">
                <div
                  className="os-backdrop"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) setSelecionada(null);
                  }}
                >
                  <aside
                    ref={drawerRef}
                    className="os-drawer"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Ordem de serviço ${selecionada}`}
                  >
                    <div className="os-drawer-head">
                      <div>
                        <span className="os-kicker">
                          ORDEM DE SERVIÇO #{selecionada}
                        </span>
                        <h2>Detalhes do atendimento</h2>
                      </div>
                      <button
                        className="os-close"
                        aria-label="Fechar"
                        onClick={() => setSelecionada(null)}
                      >
                        ✕
                      </button>
                    </div>
                    {!detalhes ? (
                      <p>Carregando detalhes...</p>
                    ) : (
                      <>
                        <div className="os-progress">
                          <div>
                            <strong>Progresso do serviço</strong>
                            <span>
                              {feitas}/{total} etapas ·{" "}
                              {total ? Math.round((feitas / total) * 100) : 0}%
                            </span>
                          </div>
                          <div className="os-bar">
                            <div
                              style={{
                                width: `${total ? (feitas / total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="os-tabs">
                          {[
                            ["etapas", "Etapas"],
                            ["orcamento", "Orçamento"],
                            ["anexos", "Anexos"],
                            ["relatorio", "Relatório"],
                            ["historico", "Histórico"],
                            ["conclusao", "Conclusão"],
                          ].map(([id, nome]) => (
                            <button
                              key={id}
                              className={aba === id ? "ativo" : ""}
                              onClick={() => setAba(id)}
                            >
                              {nome}
                            </button>
                          ))}
                        </div>
                        <div className="os-tab-content">
                          {aba === "etapas" && (
                            <div className="os-steps">
                              {detalhes.etapas.map((et) => (
                                <label key={et.codigo} className="os-step">
                                  <input
                                    type="checkbox"
                                    checked={!!et.concluida}
                                    disabled={
                                      ocupado ||
                                      ["aprovacao", "encerramento"].includes(
                                        et.codigo,
                                      ) ||
                                      admin
                                    }
                                    onChange={(e) =>
                                      agir(() =>
                                        apiServico(
                                          `/os/${selecionada}/etapas/${et.codigo}`,
                                          {
                                            method: "PUT",
                                            body: JSON.stringify({
                                              concluida: e.target.checked,
                                            }),
                                          },
                                        ),
                                      )
                                    }
                                  />
                                  <span>
                                    <strong>{et.titulo}</strong>
                                    <small>
                                      {et.concluida
                                        ? `Concluído por ${et.responsavel || "responsável"} · ${quando(et.data_conclusao)}`
                                        : [
                                              "aprovacao",
                                              "encerramento",
                                            ].includes(et.codigo)
                                          ? "Validação exclusiva do administrador"
                                          : "Aguardando realização"}
                                    </small>
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                          {aba === "orcamento" && (
                            <div className="os-form">
                              <h3>Orçamento do serviço</h3>
                              <label>
                                Valor estimado (R$)
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={orc.valor}
                                  onChange={(e) =>
                                    setOrc({ ...orc, valor: e.target.value })
                                  }
                                  disabled={
                                    admin ||
                                    detalhes.orcamento?.status === "Aprovado"
                                  }
                                />
                              </label>
                              <label>
                                Observações
                                <textarea
                                  maxLength={4000}
                                  value={orc.observacoes}
                                  onChange={(e) =>
                                    setOrc({
                                      ...orc,
                                      observacoes: e.target.value,
                                    })
                                  }
                                  disabled={
                                    admin ||
                                    detalhes.orcamento?.status === "Aprovado"
                                  }
                                />
                              </label>
                              <p>
                                Status:{" "}
                                <b>
                                  {detalhes.orcamento?.status || "Não enviado"}
                                </b>
                                {detalhes.orcamento &&
                                  ` · ${dinheiro(detalhes.orcamento.valor)}`}
                              </p>
                              {!admin && (
                                <button
                                  disabled={
                                    ocupado ||
                                    detalhes.orcamento?.status === "Aprovado" ||
                                    orc.valor === ""
                                  }
                                  onClick={() =>
                                    agir(() =>
                                      apiServico(
                                        `/os/${selecionada}/orcamento`,
                                        {
                                          method: "PUT",
                                          body: JSON.stringify(orc),
                                        },
                                      ),
                                    )
                                  }
                                >
                                  Enviar orçamento
                                </button>
                              )}
                              {admin &&
                                detalhes.orcamento?.status === "Pendente" && (
                                  <div className="os-actions">
                                    <button
                                      onClick={() =>
                                        agir(() =>
                                          apiServico(
                                            `/os/${selecionada}/orcamento/aprovacao`,
                                            {
                                              method: "PUT",
                                              body: JSON.stringify({
                                                aprovado: true,
                                              }),
                                            },
                                          ),
                                        )
                                      }
                                    >
                                      Aprovar orçamento
                                    </button>
                                    <button
                                      className="os-danger"
                                      onClick={() =>
                                        agir(() =>
                                          apiServico(
                                            `/os/${selecionada}/orcamento/aprovacao`,
                                            {
                                              method: "PUT",
                                              body: JSON.stringify({
                                                aprovado: false,
                                              }),
                                            },
                                          ),
                                        )
                                      }
                                    >
                                      Rejeitar
                                    </button>
                                  </div>
                                )}
                            </div>
                          )}
                          {aba === "anexos" && (
                            <div className="os-form">
                              <h3>Fotos e documentos</h3>
                              <p>
                                JPG, PNG, WebP ou PDF · máximo 5 MB por arquivo.
                              </p>
                              <label>
                                Adicionar arquivo
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,application/pdf"
                                  disabled={ocupado || admin}
                                  onChange={anexo}
                                />
                              </label>
                              <div className="os-attachments">
                                {detalhes.anexos.length === 0 ? (
                                  <p>Nenhum anexo enviado.</p>
                                ) : (
                                  detalhes.anexos.map((a) => (
                                    <div key={a.id_anexo}>
                                      <span>
                                        <strong>{a.nome_original}</strong>
                                        <small>
                                          {a.autor} · {quando(a.criado_em)}
                                        </small>
                                      </span>
                                      <button onClick={() => baixar(a)}>
                                        Baixar
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                          {aba === "relatorio" && (
                            <div className="os-form">
                              <h3>Relatório técnico</h3>
                              <label>
                                Atividades realizadas
                                <textarea
                                  maxLength={5000}
                                  value={rel.atividades}
                                  disabled={admin}
                                  onChange={(e) =>
                                    setRel({
                                      ...rel,
                                      atividades: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Materiais utilizados
                                <textarea
                                  maxLength={5000}
                                  value={rel.materiais}
                                  disabled={admin}
                                  onChange={(e) =>
                                    setRel({
                                      ...rel,
                                      materiais: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Observações
                                <textarea
                                  maxLength={5000}
                                  value={rel.observacoes}
                                  disabled={admin}
                                  onChange={(e) =>
                                    setRel({
                                      ...rel,
                                      observacoes: e.target.value,
                                    })
                                  }
                                />
                              </label>
                              {!admin && (
                                <button
                                  disabled={
                                    ocupado ||
                                    !rel.atividades.trim() ||
                                    !rel.materiais.trim()
                                  }
                                  onClick={() =>
                                    agir(() =>
                                      apiServico(
                                        `/os/${selecionada}/relatorio`,
                                        {
                                          method: "PUT",
                                          body: JSON.stringify(rel),
                                        },
                                      ),
                                    )
                                  }
                                >
                                  Salvar relatório
                                </button>
                              )}
                            </div>
                          )}
                          {aba === "historico" && (
                            <div className="os-timeline">
                              {detalhes.eventos.length === 0 ? (
                                <p>
                                  As atualizações desta ordem aparecerão aqui.
                                </p>
                              ) : (
                                detalhes.eventos.map((ev) => (
                                  <div key={ev.id_evento}>
                                    <strong>{ev.descricao}</strong>
                                    <small>
                                      {ev.autor} · {quando(ev.criado_em)}
                                    </small>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                          {aba === "conclusao" && (
                            <div className="os-form">
                              <h3>Validação do atendimento</h3>
                              <p>
                                Situação:{" "}
                                <b>
                                  {detalhes.conclusao?.status ||
                                    "Ainda não solicitada"}
                                </b>
                              </p>
                              <label>
                                Observações
                                <textarea
                                  value={obs}
                                  maxLength={3000}
                                  onChange={(e) => setObs(e.target.value)}
                                  placeholder="Registre a conclusão ou a justificativa da decisão"
                                />
                              </label>
                              {admin ? (
                                detalhes.conclusao?.status === "Solicitada" && (
                                  <div className="os-actions">
                                    <button
                                      disabled={ocupado}
                                      onClick={() =>
                                        agir(() =>
                                          apiServico(
                                            `/os/${selecionada}/conclusao`,
                                            {
                                              method: "PUT",
                                              body: JSON.stringify({
                                                aprovado: true,
                                                observacao: obs,
                                              }),
                                            },
                                          ),
                                        )
                                      }
                                    >
                                      Aprovar conclusão
                                    </button>
                                    <button
                                      className="os-danger"
                                      disabled={ocupado || !obs.trim()}
                                      onClick={() =>
                                        agir(() =>
                                          apiServico(
                                            `/os/${selecionada}/conclusao`,
                                            {
                                              method: "PUT",
                                              body: JSON.stringify({
                                                aprovado: false,
                                                observacao: obs,
                                              }),
                                            },
                                          ),
                                        )
                                      }
                                    >
                                      Rejeitar conclusão
                                    </button>
                                  </div>
                                )
                              ) : (
                                <button
                                  disabled={
                                    ocupado ||
                                    !obs.trim() ||
                                    detalhes.conclusao?.status ===
                                      "Solicitada" ||
                                    detalhes.conclusao?.status === "Aprovada"
                                  }
                                  onClick={() =>
                                    agir(() =>
                                      apiServico(
                                        `/os/${selecionada}/conclusao`,
                                        {
                                          method: "POST",
                                          body: JSON.stringify({
                                            observacao: obs,
                                          }),
                                        },
                                      ),
                                    )
                                  }
                                >
                                  Solicitar conclusão ao administrador
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </aside>
                </div>
              </div>,
              document.body,
            )}
        </section>
      </main>
    </div>
  );
}
