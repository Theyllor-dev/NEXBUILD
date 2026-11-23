import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HEADER_EVENT } from "./HeaderEvents";
import { io } from "socket.io-client";
import { API_URL } from "../api";
import { createPortal } from "react-dom";
import {
  FaSearch,
  FaBell,
  FaSun,
  FaMoon,
  FaChevronDown,
  FaUser,
  FaSignOutAlt,
  FaCheck,
  FaTimes
} from "react-icons/fa";
import { useTema } from "../context/TemaContext";
import "./Header.css";
function Header() {
  const navigate = useNavigate();
  const { temaClaro, alternarTema } = useTema();
  // Dados da sessão atual (o backend continua responsável pelas permissões).
  let usuario = null;
  try {
    usuario = JSON.parse(localStorage.getItem("usuario") || "null");
  } catch {
    usuario = null;
  }
  const nomeCompleto = usuario?.nome?.trim() || "Usuário";
  const primeiroNome = nomeCompleto.split(/\s+/)[0];
  const inicial = primeiroNome.charAt(0).toLocaleUpperCase("pt-BR");
  const tipoUsuario = usuario?.tipo_usuario || "Usuário";

  function sair() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    navigate("/", { replace: true });
  }

  const [mobile, setMobile] = useState(
    window.matchMedia("(max-width: 700px)").matches
  );
  const [notificacoesAberto, setNotificacoesAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [pesquisaAberta, setPesquisaAberta] = useState(false);
  const [termoPesquisa, setTermoPesquisa] = useState("");
  const [notificacoes, setNotificacoes] = useState([]);
  const [pulso, setPulso] = useState(false);
  const [erroNotificacoes, setErroNotificacoes] = useState("");
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    let ativo = true;
    const headers = { Authorization: `Bearer ${token}` };
    const buscarTodas = async () => {
      try {
        const [chat, servicos, reunioes] = await Promise.all([
          fetch(`${API_URL}/chat/notificacoes`, { headers }).then(r => r.ok ? r.json() : []),
          fetch(`${API_URL}/minhas-notificacoes`, { headers }).then(r => r.ok ? r.json() : []),
          fetch(`${API_URL}/agenda/notificacoes`, { headers }).then(r => r.ok ? r.json() : [])
        ]);
        if (ativo) setNotificacoes([
          ...chat.map(n => ({ ...n, origem: 'chat', chave: `chat-${n.id}` })),
          ...servicos.map(n => ({ ...n, origem: 'servico', id: n.id_notificacao, chave: `servico-${n.id_notificacao}`, tipo: 'servico' })),
          ...reunioes.map(n => ({ ...n, origem: 'reuniao', id: n.id_notificacao, chave: `reuniao-${n.id_notificacao}`, data_notificacao: n.criada_em }))
        ].sort((a, b) => new Date(b.data_notificacao) - new Date(a.data_notificacao)));
      } catch (e) { if (ativo) setErroNotificacoes(e.message); }
    };
    buscarTodas();
    const intervalo = setInterval(buscarTodas, 15000);
    const socket = io(API_URL, { auth: { token } });
    socket.on("nova-notificacao-chat", item => {
      if (!ativo) return;
      setNotificacoes(lista => lista.some(n => n.chave === `chat-${item.id}`) ? lista : [{ ...item, origem: 'chat', chave: `chat-${item.id}` }, ...lista]);
      setPulso(true);
    });
    socket.on('nova-notificacao-servico', item => {
      if (!ativo) return;
      setNotificacoes(lista => [{ ...item, id: item.id_notificacao, origem: 'servico', chave: `servico-${item.id_notificacao}`, tipo: 'servico', data_notificacao: new Date().toISOString() }, ...lista]);
      setPulso(true);
    });
    socket.on('nova-notificacao-reuniao', item => {
      if (!ativo) return;
      setNotificacoes(lista => [{ ...item, origem: 'reuniao', id: item.id_notificacao, chave: `reuniao-${item.id_notificacao}`, data_notificacao: new Date().toISOString() }, ...lista]);
      setPulso(true);
    });
    return () => { ativo = false; clearInterval(intervalo); socket.disconnect(); };
  }, [usuario?.id_usuario]);
  function tituloNotificacao(item) {
    return item.origem === 'reuniao' ? 'Convite para reunião' : item.origem === 'servico' ? `Ocorrência #${item.id_ocorrencia}` : item.tipo === "privada" ? `Mensagem de ${item.remetente}` : `${item.remetente} • #${item.canal}`;
  }
  function abrirNotificacao(item) {
    marcarComoLida(item.id, item.origem);
    fecharPainel();
    navigate(item.origem === 'reuniao' ? '/admin/agenda' : item.origem === 'servico' ? (usuario?.perfil === 'Administrador' ? '/admin/denuncias' : '/admin/minhas-tarefas') : item.tipo === "privada" ? `/admin/chat?usuario=${item.id_remetente}` : `/admin/chat?canal=${encodeURIComponent(item.canal)}`);
  }
  const headerRef = useRef(null);
  const pesquisaInputRef = useRef(null);
  const mobilePanelRef = useRef(null);
  const mobilePesquisaInputRef = useRef(null);
  const paginas = [
    {
      nome: "Mapa de denúncias",
      descricao: "Visualizar ocorrências no mapa",
      palavras: "mapa localização locais ocorrências",
      caminho: "/admin/mapa"
    },
    {
      nome: "Lista de denúncias",
      descricao: "Consultar denúncias registradas",
      palavras: "denúncias ocorrências lista registros",
      caminho: "/admin/denuncias"
    },
    {
      nome: "Relatórios",
      descricao: "Consultar relatórios e dados",
      palavras: "relatórios gráficos estatísticas indicadores",
      caminho: "/admin/relatorios"
    },
    {
      nome: "Configurações",
      descricao: "Configurar o sistema",
      palavras: "configurações ajustes preferências",
      caminho: "/admin/configuracoes"
    }
  ];
  const resultadosPesquisa = paginas.filter((pagina) =>
    `${pagina.nome} ${pagina.descricao} ${pagina.palavras}`
      .toLocaleLowerCase("pt-BR")
      .includes(termoPesquisa.trim().toLocaleLowerCase("pt-BR"))
  );
  const quantidadeNaoLidas = notificacoes.filter(
    (notificacao) => !notificacao.lida
  ).length;
  const painelAberto =
    pesquisaAberta || notificacoesAberto || perfilAberto;
  const tituloPainel = pesquisaAberta
    ? "Pesquisar páginas"
    : notificacoesAberto
      ? "Notificações"
      : "Meu perfil";
  function fecharPainel() {
    setNotificacoesAberto(false);
    setPerfilAberto(false);
    setPesquisaAberta(false);
  }
  function abrirPagina(pagina) {
    navigate(pagina.caminho);
    setTermoPesquisa("");
    fecharPainel();
  }
  function alternarNotificacoes() {
    setNotificacoesAberto((aberto) => !aberto);
    setPerfilAberto(false);
    setPesquisaAberta(false);
  }
  function alternarPerfil() {
    setPerfilAberto((aberto) => !aberto);
    setNotificacoesAberto(false);
    setPesquisaAberta(false);
  }
  function alternarPesquisa() {
    setPesquisaAberta((aberta) => !aberta);
    setNotificacoesAberto(false);
    setPerfilAberto(false);
  }
  async function marcarComoLida(id, origem = 'chat') {
    const token = localStorage.getItem("token");
    try {
      const r = await fetch(`${API_URL}/${origem === 'reuniao' ? 'agenda/notificacoes' : origem === 'servico' ? 'minhas-notificacoes' : 'chat/notificacoes'}/${id}/lida`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error("Falha ao marcar notificação.");
      setNotificacoes(lista => lista.map(n => n.id === id && n.origem === origem ? { ...n, lida: 1 } : n));
    } catch (erro) { setErroNotificacoes(erro.message); }
  }
  async function marcarTodasComoLidas() {
    const token = localStorage.getItem("token");
    try {
      const r = await fetch(`${API_URL}/chat/notificacoes/lidas/todas`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error("Falha ao marcar notificações.");
      const servicos = notificacoes.filter(n => n.origem === 'servico' && !n.lida);
      const reunioes = notificacoes.filter(n => n.origem === 'reuniao' && !n.lida);
      await Promise.all([...servicos.map(n => fetch(`${API_URL}/minhas-notificacoes/${n.id}/lida`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } })), ...reunioes.map(n => fetch(`${API_URL}/agenda/notificacoes/${n.id}/lida`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }))]);
      setNotificacoes(lista => lista.map(n => ({ ...n, lida: 1 })));
    } catch (erro) { setErroNotificacoes(erro.message); }
  }
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 700px)");
    function atualizarMobile(evento) {
      setMobile(evento.matches);
    }
    mediaQuery.addEventListener("change", atualizarMobile);
    return () => {
      mediaQuery.removeEventListener("change", atualizarMobile);
    };
  }, []);
  useEffect(() => {
    if (pesquisaAberta) {
      const input = mobile
        ? mobilePesquisaInputRef.current
        : pesquisaInputRef.current;
      input?.focus();
    }
  }, [pesquisaAberta, mobile]);
  useEffect(() => {
    function fecharComEscape(evento) {
      if (evento.key === "Escape") {
        fecharPainel();
      }
    }
    document.addEventListener("keydown", fecharComEscape);
    return () => {
      document.removeEventListener("keydown", fecharComEscape);
    };
  }, []);
  useEffect(() => {
    function fecharAoClicarFora(evento) {
      const clicouNoHeader =
        headerRef.current?.contains(evento.target);
      const clicouNoPainel =
        mobilePanelRef.current?.contains(evento.target);
      if (clicouNoHeader || clicouNoPainel) {
        return;
      }
      fecharPainel();
    }
    document.addEventListener("mousedown", fecharAoClicarFora);
    document.addEventListener("touchstart", fecharAoClicarFora);
    return () => {
      document.removeEventListener("mousedown", fecharAoClicarFora);
      document.removeEventListener("touchstart", fecharAoClicarFora);
    };
  }, []);
  useEffect(() => {
    function receberAcao(evento) {
      switch (evento.detail) {
        case "pesquisa":
          setPesquisaAberta((aberto) => !aberto);
          setNotificacoesAberto(false);
          setPerfilAberto(false);
          break;
        case "notificacoes":
          setNotificacoesAberto((aberto) => !aberto);
          setPerfilAberto(false);
          setPesquisaAberta(false);
          break;
        case "perfil":
          setPerfilAberto((aberto) => !aberto);
          setNotificacoesAberto(false);
          setPesquisaAberta(false);
          break;
        default:
          break;
      }
    }
    window.addEventListener(HEADER_EVENT, receberAcao);
    return () => {
      window.removeEventListener(HEADER_EVENT, receberAcao);
    };
  }, []);
  return (
    <>
      <header className="header" ref={headerRef}>
        <div className="header-welcome">
          <h1>
            Olá, {primeiroNome}! <span>👋</span>
          </h1>
          <p>Aqui está o resumo das denúncias de hoje.</p>
        </div>
        <div className="header-actions">
          <button
            className="header-icon mobile-search-button"
            type="button"
            onClick={alternarPesquisa}
            aria-label={pesquisaAberta ? "Fechar pesquisa" : "Abrir pesquisa"}
            aria-expanded={pesquisaAberta}
          >
            {pesquisaAberta ? <FaTimes /> : <FaSearch />}
          </button>
          <div
            className={`header-search ${pesquisaAberta ? "search-open" : ""
              }`}
          >
            <input
              ref={pesquisaInputRef}
              type="text"
              placeholder="Pesquisar páginas..."
              aria-label="Pesquisar páginas"
              autoComplete="off"
              value={termoPesquisa}
              onChange={(evento) =>
                setTermoPesquisa(evento.target.value)
              }
              onKeyDown={(evento) => {
                if (
                  evento.key === "Enter" &&
                  resultadosPesquisa.length > 0
                ) {
                  abrirPagina(resultadosPesquisa[0]);
                }
                if (evento.key === "Escape") {
                  fecharPainel();
                  setTermoPesquisa("");
                }
              }}
            />
            <FaSearch />
            {termoPesquisa.trim() !== "" && (
              <div className="pesquisa-resultados">
                {resultadosPesquisa.length > 0 ? (
                  resultadosPesquisa.map((pagina) => (
                    <button
                      key={pagina.caminho}
                      type="button"
                      className="pesquisa-resultado"
                      onClick={() => abrirPagina(pagina)}
                    >
                      <strong>{pagina.nome}</strong>
                      <span>{pagina.descricao}</span>
                    </button>
                  ))
                ) : (
                  <p className="pesquisa-sem-resultados">
                    Nenhuma página encontrada.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="header-dropdown">
            <button
              className={`header-icon ${pulso ? "sininho-pulso" : ""}`}
              onAnimationEnd={() => setPulso(false)}
              type="button"
              onClick={alternarNotificacoes}
              aria-label="Notificações"
              aria-expanded={notificacoesAberto}
            >
              <FaBell />
              {quantidadeNaoLidas > 0 && (
                <span className="notification-dot">
                  {quantidadeNaoLidas}
                </span>
              )}
            </button>
            {notificacoesAberto && (
              <div className="header-popup notifications-popup">
                <div className="popup-header">
                  <strong>Notificações</strong>
                  {quantidadeNaoLidas > 0 && (
                    <button
                      type="button"
                      className="popup-text-button"
                      onClick={marcarTodasComoLidas}
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
                <div className="notifications-list">
                  {erroNotificacoes && <p role="alert">{erroNotificacoes}</p>}
                  {notificacoes.length === 0 ? (
                    <p className="popup-empty">
                      Nenhuma notificação.
                    </p>
                  ) : (
                    notificacoes.map((notificacao) => (
                      <div
                        key={notificacao.chave || notificacao.id}
                        className={`notification-item ${notificacao.lida ? "is-read" : "is-unread"
                          }`}
                      >
                        <div className="notification-content" role="button" tabIndex={0} onClick={() => abrirNotificacao(notificacao)} onKeyDown={e => { if (e.key === "Enter") abrirNotificacao(notificacao); }}>
                          <strong>{tituloNotificacao(notificacao)}</strong>
                          <p>{notificacao.mensagem}</p>
                          <span>{new Date(notificacao.data_notificacao).toLocaleString("pt-BR")}</span>
                        </div>
                        {!notificacao.lida && (
                          <button
                            type="button"
                            className="notification-read-button"
                            title="Marcar como lida"
                            aria-label={`Marcar ${tituloNotificacao(notificacao)} como lida`}
                            onClick={() =>
                              marcarComoLida(notificacao.id, notificacao.origem)
                            }
                          >
                            <FaCheck />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            className="header-icon"
            type="button"
            onClick={alternarTema}
            aria-label={
              temaClaro ? "Ativar tema escuro" : "Ativar tema claro"
            }
            title={temaClaro ? "Tema escuro" : "Tema claro"}
          >
            {temaClaro ? <FaMoon /> : <FaSun />}
          </button>
          <div className="header-dropdown">
            <button
              type="button"
              className="header-profile"
              onClick={alternarPerfil}
              aria-expanded={perfilAberto}
              aria-label="Abrir menu do perfil"
            >
              <div className="profile-avatar">{inicial}</div>
              <div className="profile-info">
                <strong>{nomeCompleto}</strong>
                <span>{tipoUsuario}</span>
              </div>
              <FaChevronDown
                className={`profile-arrow ${perfilAberto ? "arrow-open" : ""
                  }`}
              />
            </button>
            {perfilAberto && (
              <div className="header-popup profile-popup">
                <div className="profile-popup-info">
                  <div className="profile-avatar">{inicial}</div>
                  <div>
                    <strong>{nomeCompleto}</strong>
                    <p>{tipoUsuario}</p>
                  </div>
                </div>
                <div className="popup-divider" />
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => {
                    navigate("/admin/configuracoes");
                  }}
                >
                  <FaUser />
                  <span>Meu perfil</span>
                </button>
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => {
                    sair();
                  }}
                >
                  <FaSignOutAlt />
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {mobile &&
        painelAberto &&
        createPortal(
          <div
            className="mobile-panel-overlay"
            onMouseDown={(evento) => {
              if (evento.target === evento.currentTarget) {
                fecharPainel();
              }
            }}
            onTouchStart={(evento) => {
              if (evento.target === evento.currentTarget) {
                fecharPainel();
              }
            }}
          >
            <section
              ref={mobilePanelRef}
              className="mobile-panel"
              role="dialog"
              aria-modal="true"
              aria-label={tituloPainel}
            >
              <div className="mobile-panel-handle" />
              <div className="mobile-panel-header">
                <h2>{tituloPainel}</h2>
                <button
                  type="button"
                  className="mobile-panel-close"
                  onClick={fecharPainel}
                  aria-label="Fechar painel"
                >
                  <FaTimes />
                </button>
              </div>
              {pesquisaAberta && (
                <div className="mobile-panel-content">
                  <div className="mobile-panel-search">
                    <FaSearch />
                    <input
                      ref={mobilePesquisaInputRef}
                      type="text"
                      placeholder="Pesquisar páginas..."
                      aria-label="Pesquisar páginas"
                      autoComplete="off"
                      value={termoPesquisa}
                      onChange={(evento) =>
                        setTermoPesquisa(evento.target.value)
                      }
                      onKeyDown={(evento) => {
                        if (
                          evento.key === "Enter" &&
                          resultadosPesquisa.length > 0
                        ) {
                          abrirPagina(resultadosPesquisa[0]);
                        }
                        if (evento.key === "Escape") {
                          fecharPainel();
                          setTermoPesquisa("");
                        }
                      }}
                    />
                  </div>
                  {termoPesquisa.trim() !== "" && (
                    <div className="mobile-panel-results">
                      {resultadosPesquisa.length > 0 ? (
                        resultadosPesquisa.map((pagina) => (
                          <button
                            key={pagina.caminho}
                            type="button"
                            onClick={() => abrirPagina(pagina)}
                          >
                            <strong>{pagina.nome}</strong>
                            <span>{pagina.descricao}</span>
                          </button>
                        ))
                      ) : (
                        <p>Nenhuma página encontrada.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {notificacoesAberto && (
                <div className="mobile-panel-content">
                  <div className="mobile-panel-notification-heading">
                    <span>
                      {quantidadeNaoLidas} não lida(s)
                    </span>
                    {quantidadeNaoLidas > 0 && (
                      <button
                        type="button"
                        onClick={marcarTodasComoLidas}
                      >
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>
                  <div className="mobile-panel-notifications">
                    {notificacoes.length === 0 ? (
                      <p className="popup-empty">
                        Nenhuma notificação.
                      </p>
                    ) : (
                      notificacoes.map((notificacao) => (
                        <div
                          key={notificacao.chave || notificacao.id}
                          className={`notification-item ${notificacao.lida ? "is-read" : "is-unread"
                            }`}
                        >
                          <div className="notification-content" role="button" tabIndex={0} onClick={() => abrirNotificacao(notificacao)} onKeyDown={e => { if (e.key === "Enter") abrirNotificacao(notificacao); }}>
                            <strong>{tituloNotificacao(notificacao)}</strong>
                            <p>{notificacao.mensagem}</p>
                            <span>{new Date(notificacao.data_notificacao).toLocaleString("pt-BR")}</span>
                          </div>
                          {!notificacao.lida && (
                            <button
                              type="button"
                              className="notification-read-button"
                              title="Marcar como lida"
                              aria-label={`Marcar ${tituloNotificacao(notificacao)} como lida`}
                              onClick={() =>
                                marcarComoLida(notificacao.id, notificacao.origem)
                              }
                            >
                              <FaCheck />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              {perfilAberto && (
                <div className="mobile-panel-content">
                  <div className="mobile-panel-profile">
                    <div className="profile-avatar">{inicial}</div>
                    <div>
                      <strong>{nomeCompleto}</strong>
                      <p>{tipoUsuario}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={() => {
                      fecharPainel();
                      alert(
                        "A tela Meu Perfil será implementada na próxima etapa."
                      );
                    }}
                  >
                    <FaUser />
                    <span>Meu perfil</span>
                  </button>
                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={() => {
                      sair();
                    }}
                  >
                    <FaSignOutAlt />
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </section>
          </div>,
          document.body
        )}
    </>
  );
}
export default Header;
