
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { acionarHeader } from "./HeaderEvents";

import {
  FaFileAlt,
  FaClock,
  FaExclamationTriangle,
  FaMapMarkedAlt,
  FaCalendarAlt,
  FaUsers,
  FaLayerGroup,
  FaCog,
  FaArrowLeft,
  FaHeadset,
  FaPencilRuler,
  FaBars,
  FaTimes,
  FaSearch,
  FaBell,
  FaUser,
  FaPlus,
  FaHome,
  FaComments,
  FaSun,
  FaMoon,
} from "react-icons/fa";

import { useTema } from "../context/TemaContext";
import "./Sindebar.css";

const itensPrincipais = [
  { to: "/admin", label: "Dashboard", icon: FaFileAlt },
  { to: "/admin/minhas-tarefas", label: "Minhas tarefas", icon: FaClock },
  { to: "/admin/denuncias", label: "Denúncias", icon: FaFileAlt },
  { to: "/admin/analise", label: "Em análise", icon: FaClock },
  {
    to: "/admin/alta-gravidade",
    label: "Alta gravidade",
    icon: FaExclamationTriangle,
  },
  { to: "/admin/mapa", label: "Mapa", icon: FaMapMarkedAlt },
  { to: "/admin/agenda", label: "Agenda", icon: FaCalendarAlt },
  {
    to: "/admin/nota-inteligente",
    label: "Notas inteligentes",
    icon: FaPencilRuler,
  },
  {
    to: "/admin/chat",
    label: "Chat",
    icon: FaComments,
  },
];

const itensConfiguracao = [
  { to: "/admin/usuarios", label: "Usuários", icon: FaUsers },
  { to: "/admin/categorias", label: "Categorias", icon: FaLayerGroup },
  {
    to: "/admin/configuracoes",
    label: "Configurações",
    icon: FaCog,
  },
];

function Sidebar() {
  const [atalhosAbertos, setAtalhosAbertos] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { temaClaro, alternarTema } = useTema();

  useEffect(() => {
    setMenuAberto(false);
    setAtalhosAbertos(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuAberto) return;

    function fecharComEscape(evento) {
      if (evento.key === "Escape") {
        setMenuAberto(false);
      }
    }

    document.addEventListener("keydown", fecharComEscape);

    return () => {
      document.removeEventListener("keydown", fecharComEscape);
    };
  }, [menuAberto]);

  function rotaAtiva(to) {
    if (to === "/admin") {
      return location.pathname === "/admin";
    }

    return (
      location.pathname === to ||
      location.pathname.startsWith(`${to}/`)
    );
  }

  function renderItem(item) {
    const Icone = item.icon;
    const ativo = rotaAtiva(item.to);

    return (
      <Link
        key={item.to}
        to={item.to}
        className={`menu-item ${ativo ? "menu-item-ativo" : ""}`}
        aria-current={ativo ? "page" : undefined}
        onClick={() => { setMenuAberto(false); setAtalhosAbertos(false); }}
      >
        <Icone />
        <span>{item.label}</span>
      </Link>
    );
  }
  

  return (
    <>
      <div className="mobile-topbar">
        <Link
          to="/admin"
          className="mobile-brand"
          aria-label="NexBuild, início"
        >
          <span className="logo-icon">N</span>
          <span>
            <strong>NexBuild</strong>
            <small>Painel administrativo</small>
          </span>
        </Link>

        <button
          type="button"
          className={`mobile-menu-toggle ${
            menuAberto ? "is-open" : ""
          }`}
          onClick={() => setMenuAberto((aberto) => !aberto)}
          aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuAberto}
          aria-controls="sidebar-navegacao"
        >
          {menuAberto ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {menuAberto && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Fechar menu"
          onClick={() => setMenuAberto(false)}
        />
      )}

      <aside
        id="sidebar-navegacao"
        className={`sidebar ${
          menuAberto ? "sidebar-mobile-aberta" : ""
        }`}
      >
        <div className="sidebar-logo">
          <div className="logo-icon">N</div>

          <div className="topo">
            <span>Painel Administrativo</span>
          </div>
        </div>

        <nav
          className="sidebar-menu"
          aria-label="Navegação administrativa"
        >
          <p className="menu-title">PRINCIPAL</p>
          {itensPrincipais.map(renderItem)}

          <p className="menu-title">CONFIGURAÇÕES</p>
          {itensConfiguracao.map(renderItem)}
        </nav>

        <div className="sidebar-footer">
          <Link to="/denuncia" className="back-site" onClick={() => setMenuAberto(false)}><FaArrowLeft /> Voltar para o site</Link>

          <div className="support-card">
            <FaHeadset />
            <div>
              <strong>Precisa de ajuda?</strong>
              <span>Fale com o suporte</span>
            </div>
          </div>
        </div>
      </aside>

      <>
          <button className={`mobile-fullmenu-overlay ${atalhosAbertos ? "aberto" : ""}`} type="button" aria-label="Fechar menu" tabIndex={atalhosAbertos ? 0 : -1} onClick={() => setAtalhosAbertos(false)} />
          <section className={`mobile-fullmenu ${atalhosAbertos ? "aberto" : ""}`} aria-label="Todas as páginas do painel" aria-hidden={!atalhosAbertos} inert={!atalhosAbertos} id="mobile-fullmenu">
            <div className="mobile-fullmenu-header">
              <div><strong>Todas as páginas</strong><span>Escolha para onde deseja ir</span></div>
              <button type="button" onClick={() => setAtalhosAbertos(false)} aria-label="Fechar menu"><FaTimes /></button>
            </div>
            <div className="mobile-fullmenu-scroll">
              <p className="mobile-fullmenu-section">PRINCIPAL</p>
              <div className="mobile-fullmenu-grid">{itensPrincipais.map(renderItem)}</div>
              <p className="mobile-fullmenu-section">CONFIGURAÇÕES</p>
              <div className="mobile-fullmenu-grid">{itensConfiguracao.map(renderItem)}</div>
              <p className="mobile-fullmenu-section">ACESSO RÁPIDO</p>
              <div className="mobile-fullmenu-tools">
                <button type="button" onClick={() => { acionarHeader("pesquisa"); setAtalhosAbertos(false); }}><FaSearch /> Pesquisar</button>
                <button type="button" onClick={() => { acionarHeader("notificacoes"); setAtalhosAbertos(false); }}><FaBell /> Notificações</button>
                <button type="button" onClick={() => { acionarHeader("perfil"); setAtalhosAbertos(false); }}><FaUser /> Perfil</button>
                <button type="button" onClick={alternarTema}>{temaClaro ? <FaMoon /> : <FaSun />} Alternar tema</button>
              </div>
            </div>
          </section>
        </>
      <nav className="mobile-bottom-nav" aria-label="Atalhos principais">
        {[
          { to: "/admin", label: "Início", icon: FaHome },
          { to: "/admin/denuncias", label: "Denúncias", icon: FaFileAlt },
          { to: "/admin/mapa", label: "Mapa", icon: FaMapMarkedAlt },
          { to: "/admin/agenda", label: "Agenda", icon: FaCalendarAlt },
        ].map((item) => {
          const Icone = item.icon;
          const ativo = rotaAtiva(item.to);
          return <Link key={item.to} to={item.to} className={`mobile-bottom-item ${ativo ? "ativo" : ""}`} aria-current={ativo ? "page" : undefined} onClick={() => setAtalhosAbertos(false)}><Icone /><span>{item.label}</span></Link>;
        })}
        <button type="button" className={`mobile-bottom-item mobile-bottom-more ${atalhosAbertos ? "ativo" : ""}`} onClick={() => setAtalhosAbertos((aberto) => !aberto)} aria-expanded={atalhosAbertos} aria-controls="mobile-fullmenu" aria-label={atalhosAbertos ? "Fechar todas as páginas" : "Ver todas as páginas"}>
          {atalhosAbertos ? <FaTimes /> : <FaBars />}<span>Menu</span>
        </button>
      </nav>
    </>
  );
}

export default Sidebar;
