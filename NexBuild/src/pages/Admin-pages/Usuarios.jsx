
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../../api";
import {
  FaUsers,
  FaUserCheck,
  FaUserSlash,
  FaSearch,
  FaPlus,
  FaEllipsisV,
  FaFilter,
  FaTimes,
  FaEnvelope,
  FaShieldAlt,
  FaSyncAlt,
  FaUsersCog,
  FaLayerGroup,
} from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import "./AdminPaginas.css";
import "./Usuarios.css";
import "./UsuariosProfissional.css";
const setoresDisponiveis = [
  "Infraestrutura",
  "Atendimento",
  "Administração",
  "Tecnologia",
];
const usuarioInicial = {
  nome: "",
  email: "",
  senha: "",
  setor: "Atendimento",
  cargo: "",
  perfil: "Usuário",
  tipo_usuario: "Funcionário",
  id_equipe: "",
};
async function lerResposta(resposta) {
  const texto = await resposta.text();
  let dados = {};
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = {};
    }
  }
  if (!resposta.ok) {
    throw new Error(
      dados.erro ||
      dados.mensagem ||
      `Erro na requisição (${resposta.status}).`
    );
  }
  return dados;
}
export default function Usuarios() {
  const [usuarioLogado] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "null");
    } catch {
      return null;
    }
  });
  const ehAdministrador =
    usuarioLogado?.perfil === "Administrador";
  const headersAdmin = {
    "Content-Type": "application/json",
    "x-usuario-id": String(usuarioLogado?.id_usuario || ""),
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  };
  const [pesquisa, setPesquisa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioDetalhes, setUsuarioDetalhes] = useState(null);
  const [menuAberto, setMenuAberto] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [equipes, setEquipes] = useState([]);
  const [novaEquipe, setNovaEquipe] = useState({ nome: '', especialidade: '' });
  const [criandoEquipe, setCriandoEquipe] = useState(false);
  async function carregarEquipes() {
    try {
      const r = await fetch(`${API_URL}/equipes-operacionais`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
      setEquipes(await lerResposta(r));
    } catch (e) { setErroPagina(e.message) }
  }
  useEffect(() => { carregarEquipes() }, []);
  async function criarEquipe(e) {
    e.preventDefault(); setCriandoEquipe(true); setErroPagina(''); try {
      const r = await fetch(`${API_URL}/equipes-operacionais`, { method: 'POST', headers: headersAdmin, body: JSON.stringify(novaEquipe) });
      await lerResposta(r); setNovaEquipe({ nome: '', especialidade: '' }); await carregarEquipes();
    } catch (e) { setErroPagina(e.message) } finally { setCriandoEquipe(false) }
  }
  const [equipeSelecionada, setEquipeSelecionada] = useState(null);
  const [equipeFormulario, setEquipeFormulario] = useState({ nome: '', especialidade: '' });
  const [equipeOcupado, setEquipeOcupado] = useState(false);
  const [equipeErro, setEquipeErro] = useState('');
  const [transferencias, setTransferencias] = useState({});
  const equipeAtual = equipes.find(e => String(e.id_equipe) === String(equipeSelecionada)) || null;
  const integrantesEquipe = usuarios.filter(u => u.tipo_usuario === 'Funcionário' && String(u.id_equipe) === String(equipeSelecionada));
  function abrirEquipe(eq) {
    setEquipeSelecionada(eq.id_equipe);
    setEquipeFormulario({ nome: eq.nome, especialidade: eq.especialidade || '' });
    setEquipeErro(''); setTransferencias({});
  }
  async function acaoEquipe(url, method, body, fechar = false) {
    setEquipeOcupado(true); setEquipeErro('');
    try {
      const resposta = await fetch(`${API_URL}${url}`, { method, headers: headersAdmin, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      await lerResposta(resposta);
      await Promise.all([carregarEquipes(), carregarUsuarios()]);
      if (fechar) setEquipeSelecionada(null);
    } catch (e) { setEquipeErro(e.message || 'Não foi possível concluir a operação.'); }
    finally { setEquipeOcupado(false); }
  }
  async function excluirEquipe() {
    if (!equipeAtual || !window.confirm(`Excluir a equipe "${equipeAtual.nome}"? Essa ação não pode ser desfeita.`)) return;
    await acaoEquipe(`/equipes-operacionais/${equipeAtual.id_equipe}`, 'DELETE', undefined, true);
  }
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [formulario, setFormulario] = useState({ ...usuarioInicial });
  const [erro, setErro] = useState("");
  const [erroPagina, setErroPagina] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [alterandoStatus, setAlterandoStatus] = useState(null);
  const carregarUsuarios = useCallback(async () => {
    if (!ehAdministrador) return;
    setCarregando(true);
    setErroPagina("");
    try {
      const resposta = await fetch(`${API_URL}/usuarios`, {
        headers: headersAdmin,
      });
      const dados = await lerResposta(resposta);
      if (!Array.isArray(dados)) {
        throw new Error("O servidor não retornou uma lista de usuários.");
      }
      setUsuarios(
        dados.map((usuario) => ({
          ...usuario,
          id: usuario.id_usuario,
          setor: usuario.setor || "Atendimento",
          perfil: usuario.perfil || "Usuário",
          tipo_usuario: usuario.tipo_usuario || (usuario.perfil === "Administrador" ? "Administrador" : "Cidadão"),
          status: usuario.status || "Ativo",
          id_equipe: usuario.id_equipe || "",
        }))
      );
    } catch (erro) {
      setErroPagina(
        erro.message || "Não foi possível carregar os usuários."
      );
    } finally {
      setCarregando(false);
    }
  }, [ehAdministrador, usuarioLogado?.id_usuario]);
  useEffect(() => {
    carregarUsuarios();
  }, [carregarUsuarios]);
  const usuariosFiltrados = usuarios.filter((usuario) => {
    const termo = pesquisa.trim().toLowerCase();
    const correspondePesquisa =
      (usuario.nome || "").toLowerCase().includes(termo) ||
      (usuario.email || "").toLowerCase().includes(termo) ||
      (usuario.setor || "").toLowerCase().includes(termo) ||
      (usuario.cargo || "").toLowerCase().includes(termo) ||
      (usuario.perfil || "").toLowerCase().includes(termo) ||
      (usuario.tipo_usuario || "").toLowerCase().includes(termo);
    const equipeNome = equipes.find(eq => String(eq.id_equipe) === String(usuario.id_equipe))?.nome || "";
    const correspondeEquipe = equipeNome.toLowerCase().includes(termo);
    const correspondeStatus =
      filtroStatus === "Todos" || usuario.status === filtroStatus;
    return (correspondePesquisa || correspondeEquipe) && correspondeStatus;
  });
  const totalUsuarios = usuarios.length;
  const usuariosAtivos = usuarios.filter(
    (usuario) => usuario.status === "Ativo"
  ).length;
  const totalFuncionarios = usuarios.filter((u) => u.tipo_usuario === "Funcionário").length;
  const totalAdministradores = usuarios.filter((u) => u.perfil === "Administrador").length;
  const usuariosInativos = usuarios.filter(
    (usuario) => usuario.status === "Inativo"
  ).length;
  function abrirCadastro() {
    if (!ehAdministrador || salvando) return;
    setUsuarioEditando(null);
    setFormulario({ ...usuarioInicial });
    setErro("");
    setModalAberto(true);
    setMenuAberto(null);
  }
  function abrirEdicao(usuario) {
    if (!ehAdministrador || salvando) return;
    setUsuarioEditando(usuario.id);
    setFormulario({
      nome: usuario.nome || "",
      email: usuario.email || "",
      senha: "",
      setor: usuario.setor || "Atendimento",
      cargo: usuario.cargo || "",
      perfil: usuario.perfil || "Usuário",
      tipo_usuario: usuario.tipo_usuario || (usuario.perfil === "Administrador" ? "Administrador" : "Cidadão"),
      id_equipe: usuario.id_equipe || "",
    });
    setErro("");
    setModalAberto(true);
    setMenuAberto(null);
  }
  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
    setUsuarioEditando(null);
    setFormulario({ ...usuarioInicial });
    setErro("");
  }
  function atualizarCampo(e) {
    const { name, value } = e.target;
    setFormulario((atual) => ({
      ...atual,
      [name]: value,
    }));
    setErro("");
  }
  async function cadastrarUsuario(e) {
    e.preventDefault();
    if (!ehAdministrador || salvando) return;
    const nome = formulario.nome.trim();
    const email = formulario.email.trim().toLowerCase();
    const cargo = formulario.cargo.trim();
    const setor = formulario.setor;
    const perfil = formulario.tipo_usuario === "Administrador" ? "Administrador" : "Usuário";
    const tipo_usuario = formulario.tipo_usuario;
    const senha = formulario.senha;
    if (tipo_usuario === 'Funcionário' && !formulario.id_equipe) { setErro('Selecione a equipe do funcionário.'); return; }
    if (!nome || !email || !cargo || !setor) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }
    if (
      usuarioEditando === null &&
      senha.trim().length < 6
    ) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (!["Cidadão", "Funcionário", "Administrador"].includes(tipo_usuario)) {
      setErro("Selecione um tipo de usuário válido.");
      return;
    }
    const emailJaExiste = usuarios.some(
      (usuario) =>
        usuario.email?.toLowerCase() === email &&
        String(usuario.id) !== String(usuarioEditando)
    );
    if (emailJaExiste) {
      setErro("Já existe um usuário cadastrado com esse e-mail.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const editando = usuarioEditando !== null;
      const url = editando
        ? `${API_URL}/usuarios/${usuarioEditando}`
        : `${API_URL}/usuario`;
      const corpo = {
        nome,
        email,
        cargo,
        setor,
        perfil,
        tipo_usuario,
      };
      if (!editando) {
        corpo.senha = senha;
      }
      const resposta = await fetch(url, {
        method: editando ? "PUT" : "POST",
        headers: headersAdmin,
        body: JSON.stringify(corpo),
      });
      const resultado = await lerResposta(resposta);
      if (tipo_usuario === 'Funcionário') {
        const id = editando ? usuarioEditando : resultado.usuario?.id_usuario;
        if (!id) throw new Error('Usuário salvo, mas o servidor não retornou o ID para vincular a equipe.');
        const vinculo = await fetch(`${API_URL}/usuarios/${id}/equipe`, { method: 'PUT', headers: headersAdmin, body: JSON.stringify({ id_equipe: Number(formulario.id_equipe) }) });
        await lerResposta(vinculo);
      }
      setModalAberto(false);
      setUsuarioEditando(null);
      setFormulario({ ...usuarioInicial });
      await carregarUsuarios();
    } catch (erro) {
      setErro(
        erro.message || "Não foi possível salvar o usuário."
      );
    } finally {
      setSalvando(false);
    }
  }
  async function alterarStatus(usuarioId) {
    if (!ehAdministrador || alterandoStatus !== null) return;
    const usuario = usuarios.find(
      (item) => String(item.id) === String(usuarioId)
    );
    if (!usuario) return;
    if (String(usuario.id) === String(usuarioLogado?.id_usuario)) {
      setErroPagina(
        "Você não pode alterar o status da sua própria conta nesta tela."
      );
      setMenuAberto(null);
      return;
    }
    const novoStatus =
      usuario.status === "Ativo" ? "Inativo" : "Ativo";
    setErroPagina("");
    setAlterandoStatus(usuarioId);
    try {
      const resposta = await fetch(
        `${API_URL}/usuarios/${usuarioId}/status`,
        {
          method: "PATCH",
          headers: headersAdmin,
          body: JSON.stringify({ status: novoStatus }),
        }
      );
      await lerResposta(resposta);
      setMenuAberto(null);
      await carregarUsuarios();
    } catch (erro) {
      setErroPagina(
        erro.message || "Não foi possível alterar o status."
      );
    } finally {
      setAlterandoStatus(null);
    }
  }
  if (!usuarioLogado) {
    return (
      <div className="admin">
        <main className="admin-content">
          <section className="pagina-usuarios">
            <h1>Gerenciamento de usuários</h1>
            <p>Faça login para acessar esta página.</p>
          </section>
        </main>
      </div>
    );
  }
  return (
    <div className="admin">
      <Sidebar />
      <main className="admin-content">
        <Header />
        <section className="pagina-usuarios">
          <div className="usuarios-topo">
            <div>
              <h1>Gerenciamento de usuários</h1>
              <p className="usuarios-subtitulo">
                Gerencie os membros e os acessos da equipe.
              </p>
            </div>
            {ehAdministrador && (
              <button
                type="button"
                className="btn-novo-usuario"
                onClick={abrirCadastro}
              >
                <FaPlus />
                Novo usuário
              </button>
            )}
          </div>
          {ehAdministrador && <section className="nex-equipes">
            <div className="nex-equipes-heading"><div><h2>Equipes operacionais</h2><p>Selecione uma equipe para gerenciar integrantes, especialidade e configurações.</p></div><span className="nex-equipes-total">{equipes.length} equipes</span></div>
            <div className="nex-equipes-grid">
              {equipes.map(eq => <button type="button" key={eq.id_equipe} className="nex-equipe-card nex-equipe-interativa" onClick={() => abrirEquipe(eq)} aria-label={`Gerenciar ${eq.nome}`}>
                <div className="nex-equipe-card-top"><span className="nex-equipe-symbol"><FaUsers /></span><span className="nex-equipe-count">{eq.integrantes}/3</span></div>
                <strong>{eq.nome}</strong><div className="nex-equipe-specialty">{eq.especialidade || 'Sem especialidade'}</div>
                <div className="nex-equipe-progress"><span style={{ width: `${Math.min(100, Number(eq.integrantes || 0) / 3 * 100)}%` }} /></div>
                <small>{usuarios.filter(u => u.tipo_usuario === 'Funcionário' && String(u.id_equipe) === String(eq.id_equipe)).map(u => u.nome).join(', ') || 'Nenhum funcionário vinculado'} · Gerenciar</small>
              </button>)}
            </div>
            <form className="nex-equipes-form" onSubmit={criarEquipe}>
              <input aria-label="Nome da nova equipe" placeholder="Ex.: Equipe Hidráulica" value={novaEquipe.nome} onChange={e => setNovaEquipe(v => ({ ...v, nome: e.target.value }))} required maxLength={100} />
              <input aria-label="Especialidade" placeholder="Ex.: Saneamento" value={novaEquipe.especialidade} onChange={e => setNovaEquipe(v => ({ ...v, especialidade: e.target.value }))} required maxLength={100} />
              <button type="submit" disabled={criandoEquipe}>{criandoEquipe ? 'Criando...' : 'Criar equipe'}</button>
            </form>
          </section>}
          {!ehAdministrador && (
            <div className="usuarios-aviso-permissao">
              <FaShieldAlt />
              <span>
                Você tem acesso somente à visualização.
                Apenas administradores podem cadastrar ou editar usuários.
              </span>
            </div>
          )}
          {erroPagina && (
            <div className="usuarios-form-erro" role="alert">
              {erroPagina}
              <button
                type="button"
                onClick={() => setErroPagina("")}
                aria-label="Fechar mensagem"
              >
                <FaTimes />
              </button>
            </div>
          )}
          <div className="usuarios-indicadores">
            <div className="usuario-card">
              <div className="usuario-card-icone">
                <FaUsers />
              </div>
              <div>
                <span>Total de usuários</span>
                <h2>{totalUsuarios}</h2>
              </div>
            </div>
            <div className="usuario-card">
              <div className="usuario-card-icone usuario-card-ativo">
                <FaUserCheck />
              </div>
              <div>
                <span>Usuários ativos</span>
                <h2>{usuariosAtivos}</h2>
              </div>
            </div>
            <div className="usuario-card">
              <div className="usuario-card-icone usuario-card-inativo">
                <FaUserSlash />
              </div>
              <div>
                <span>Usuários inativos</span>
                <h2>{usuariosInativos}</h2>
              </div>
            </div>
          </div>
          <div className="usuarios-conteudo">
            <div className="usuarios-lista-topo">
              <div>
                <div className="nex-section-eyebrow">DIRETÓRIO DE ACESSOS</div><h2>Usuários cadastrados</h2>
                <p>
                  {usuariosFiltrados.length} usuário(s) encontrado(s)
                </p>
              </div>
              <div className="usuarios-ferramentas">
                <div className="usuarios-busca">
                  <FaSearch />
                  <input
                    className="search-user"
                    type="search"
                    placeholder="Buscar usuário..."
                    value={pesquisa}
                    onChange={(e) => setPesquisa(e.target.value)}
                    aria-label="Buscar usuário"
                  />
                </div>
                <div className="usuarios-filtro">
                  <FaFilter />
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    aria-label="Filtrar por status"
                  >
                    <option value="Todos">Todos os status</option>
                    <option value="Ativo">Ativos</option>
                    <option value="Inativo">Inativos</option>
                  </select>
                </div>
              </div>
            </div>
            {carregando ? (
              <div className="usuarios-vazio">
                <p>Carregando usuários...</p>
              </div>
            ) : usuariosFiltrados.length > 0 ? (
              <div className="usuarios-tabela-wrapper">
                <table className="usuarios-tabela">
                  <thead>
                    <tr>
                      <th>USUÁRIO</th>
                      <th>SETOR</th>
                      <th>CARGO</th>
                      <th>TIPO DE USUÁRIO</th>
                      <th>TIPO DE ACESSO</th>
                      <th>STATUS</th>
                      {ehAdministrador && <th>AÇÕES</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.map((usuario) => (
                      <tr key={usuario.id}>
                        <td>
                          <button type="button" className="usuario-identidade nex-perfil-abrir" onClick={() => setUsuarioDetalhes(usuario)} aria-label={`Ver perfil de ${usuario.nome}`}>
                            <div className="usuario-avatar">
                              {(usuario.nome || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div className="usuario-dados">
                              <strong>{usuario.nome}</strong>
                              <span>
                                <FaEnvelope />
                                {usuario.email}
                              </span>
                            </div>
                          </button>
                        </td>
                        <td>{usuario.setor}</td>
                        <td>{usuario.cargo}</td>
                        <td>
                          <span className="usuario-perfil">
                            <FaShieldAlt />
                            {usuario.tipo_usuario}
                          </span>
                        </td>
                        <td>{usuario.perfil}</td>
                        <td>
                          <span
                            className={`usuario-status ${usuario.status === "Ativo"
                              ? "status-ativo"
                              : "status-inativo"
                              }`}
                          >
                            {usuario.status}
                          </span>
                        </td>
                        {ehAdministrador && (
                          <td>
                            <div className="usuario-acoes">
                              <button
                                type="button"
                                className="usuario-menu-botao"
                                aria-label={`Ações para ${usuario.nome}`}
                                aria-expanded={menuAberto === usuario.id}
                                onClick={() =>
                                  setMenuAberto(
                                    menuAberto === usuario.id
                                      ? null
                                      : usuario.id
                                  )
                                }
                              >
                                <FaEllipsisV />
                              </button>
                              {menuAberto === usuario.id && (
                                <div className="usuario-menu">
                                  <button type="button" onClick={() => { setUsuarioDetalhes(usuario); setMenuAberto(null); }}>Ver perfil</button>
                                  <button
                                    type="button"
                                    onClick={() => abrirEdicao(usuario)}
                                  >
                                    Editar usuário
                                  </button>
                                  <button
                                    type="button"
                                    disabled={alterandoStatus !== null}
                                    onClick={() =>
                                      alterarStatus(usuario.id)
                                    }
                                  >
                                    {alterandoStatus === usuario.id
                                      ? "Alterando..."
                                      : usuario.status === "Ativo"
                                        ? "Desativar usuário"
                                        : "Ativar usuário"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="usuarios-vazio">
                <div className="usuarios-vazio-icone">
                  <FaUsers />
                </div>
                <h3>
                  {usuarios.length === 0
                    ? "Nenhum usuário cadastrado"
                    : "Nenhum usuário encontrado"}
                </h3>
                <p>
                  {usuarios.length === 0
                    ? "Os usuários cadastrados aparecerão aqui."
                    : "Tente alterar a pesquisa ou o filtro."}
                </p>
                {ehAdministrador && usuarios.length === 0 && (
                  <button
                    type="button"
                    className="btn-novo-usuario"
                    onClick={abrirCadastro}
                  >
                    <FaPlus />
                    Cadastrar primeiro usuário
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
        {ehAdministrador && equipeAtual && <div className="nex-equipe-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !equipeOcupado) setEquipeSelecionada(null) }}>
          <section className="nex-equipe-modal" role="dialog" aria-modal="true" aria-labelledby="nex-equipe-titulo">
            <div className="nex-equipe-modal-topo"><div><span className="nex-section-eyebrow">GESTÃO DE EQUIPES</span><h2 id="nex-equipe-titulo">{equipeAtual.nome}</h2><p>Gerencie os dados e a composição desta equipe.</p></div><button type="button" className="nex-equipe-icon-btn" disabled={equipeOcupado} onClick={() => setEquipeSelecionada(null)} aria-label="Fechar"><FaTimes /></button></div>
            <div className="nex-equipe-modal-corpo">
              <h3>Informações da equipe</h3>
              <form className="nex-equipe-edit-form" onSubmit={e => { e.preventDefault(); void acaoEquipe(`/equipes-operacionais/${equipeAtual.id_equipe}`, 'PUT', equipeFormulario) }}>
                <label>Nome<input required maxLength={100} value={equipeFormulario.nome} onChange={e => setEquipeFormulario(v => ({ ...v, nome: e.target.value }))} /></label>
                <label>Especialidade<input required maxLength={100} value={equipeFormulario.especialidade} onChange={e => setEquipeFormulario(v => ({ ...v, especialidade: e.target.value }))} /></label>
                <button type="submit" className="nex-equipe-btn-principal" disabled={equipeOcupado}>Salvar informações</button>
              </form>
              <div className="nex-equipe-members-head"><h3>Funcionários vinculados</h3><span>{integrantesEquipe.filter(u => u.status === 'Ativo').length}/3 ativos</span></div>
              {integrantesEquipe.length === 0 && <p className="nex-equipe-vazio">Nenhum funcionário vinculado.</p>}
              {integrantesEquipe.map(u => <div className="nex-equipe-membro" key={u.id}>
                <div className="nex-equipe-membro-info"><span className="nex-equipe-mini-avatar">{(u.nome || '?')[0].toUpperCase()}</span><div><strong>{u.nome}</strong><small>{u.cargo || 'Funcionário'} · {u.status}</small></div></div>
                <div className="nex-equipe-membro-acoes"><select aria-label={`Transferir ${u.nome}`} disabled={equipeOcupado} value={transferencias[u.id] ?? ''} onChange={e => setTransferencias(v => ({ ...v, [u.id]: e.target.value }))}>
                  <option value="">Transferir para...</option>{equipes.filter(eq => String(eq.id_equipe) !== String(equipeAtual.id_equipe)).map(eq => <option key={eq.id_equipe} value={eq.id_equipe} disabled={Number(eq.integrantes) >= 3 && u.status === 'Ativo'}>{eq.nome} ({eq.integrantes}/3)</option>)}
                </select><button type="button" disabled={equipeOcupado || !transferencias[u.id]} onClick={() => void acaoEquipe(`/usuarios/${u.id}/equipe`, 'PUT', { id_equipe: Number(transferencias[u.id]) })}>Transferir</button>
                  <button type="button" className="nex-equipe-btn-danger-ghost" disabled={equipeOcupado} onClick={() => { if (window.confirm(`Desvincular ${u.nome} desta equipe? A conta será mantida.`)) void acaoEquipe(`/usuarios/${u.id}/equipe`, 'DELETE') }}>Remover</button></div>
              </div>)}
              <h3>Adicionar funcionário</h3><div className="nex-equipe-adicionar">{usuarios.filter(u => u.tipo_usuario === 'Funcionário' && !u.id_equipe).length === 0 ? <p className="nex-equipe-vazio">Não há funcionários sem equipe.</p> : usuarios.filter(u => u.tipo_usuario === 'Funcionário' && !u.id_equipe).map(u => <div className="nex-equipe-membro" key={u.id}><strong>{u.nome}</strong><button type="button" disabled={equipeOcupado || (Number(equipeAtual.integrantes) >= 3 && u.status === 'Ativo')} onClick={() => void acaoEquipe(`/usuarios/${u.id}/equipe`, 'PUT', { id_equipe: Number(equipeAtual.id_equipe) })}>Adicionar</button></div>)}</div>
              {equipeErro && <p className="nex-equipe-erro" role="alert">{equipeErro}</p>}
              <div className="nex-equipe-modal-rodape"><button type="button" className="nex-equipe-btn-excluir" disabled={equipeOcupado || integrantesEquipe.length > 0} title={integrantesEquipe.length ? 'Remova ou transfira todos os integrantes primeiro' : ''} onClick={excluirEquipe}>Excluir equipe</button><button type="button" disabled={equipeOcupado} onClick={() => setEquipeSelecionada(null)}>Concluir</button></div>
            </div>
          </section>
        </div>}
        {usuarioDetalhes && (
          <div className="nex-perfil-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setUsuarioDetalhes(null); }}>
            <section className="nex-perfil-modal" role="dialog" aria-modal="true" aria-labelledby="nex-perfil-titulo">
              <div className="nex-perfil-topo">
                <span className="nex-perfil-eyebrow">NEXBUILD · PERFIL DO COLABORADOR</span>
                <button type="button" className="nex-perfil-fechar" onClick={() => setUsuarioDetalhes(null)} aria-label="Fechar perfil"><FaTimes /></button>
              </div>
              <div className="nex-perfil-cabecalho">
                <div className="nex-perfil-avatar">{(usuarioDetalhes.nome || '?').charAt(0).toUpperCase()}</div>
                <div><h2 id="nex-perfil-titulo">{usuarioDetalhes.nome}</h2><p>{usuarioDetalhes.email}</p>
                  <span className={`usuario-status ${usuarioDetalhes.status === 'Ativo' ? 'status-ativo' : 'status-inativo'}`}>{usuarioDetalhes.status}</span>
                </div>
              </div>
              <h3 className="nex-perfil-secao">Informações profissionais</h3>
              <div className="nex-perfil-grid">
                <div><small>Cargo</small><strong>{usuarioDetalhes.cargo || 'Não informado'}</strong></div>
                <div><small>Setor</small><strong>{usuarioDetalhes.setor || 'Não informado'}</strong></div>
                <div className="nex-perfil-equipe"><small>Equipe operacional</small><strong>{equipes.find(eq => String(eq.id_equipe) === String(usuarioDetalhes.id_equipe))?.nome || (usuarioDetalhes.tipo_usuario === 'Funcionário' ? 'Não vinculada' : 'Não se aplica')}</strong><span>{equipes.find(eq => String(eq.id_equipe) === String(usuarioDetalhes.id_equipe))?.especialidade || ''}</span></div>
                <div><small>Tipo de usuário</small><strong>{usuarioDetalhes.tipo_usuario || 'Não informado'}</strong></div>
                <div><small>Nível de acesso</small><strong>{usuarioDetalhes.perfil || 'Usuário'}</strong></div>
                <div><small>Identificador</small><strong>#{usuarioDetalhes.id}</strong></div>
              </div>
              <div className="nex-perfil-rodape">
                <button type="button" className="nex-perfil-secundario" onClick={() => setUsuarioDetalhes(null)}>Fechar</button>
                {ehAdministrador && <button type="button" className="nex-perfil-primario" onClick={() => { const usuario = usuarioDetalhes; setUsuarioDetalhes(null); abrirEdicao(usuario); }}>Editar usuário</button>}
              </div>
            </section>
          </div>
        )}
        {ehAdministrador && modalAberto && (
          <div
            className="usuarios-modal-fundo"
            onClick={(e) => {
              if (
                e.target === e.currentTarget &&
                !salvando
              ) {
                fecharModal();
              }
            }}
          >
            <div
              className="usuarios-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-modal-usuario"
            >
              <div className="usuarios-modal-topo">
                <div>
                  <h2 id="titulo-modal-usuario">
                    {usuarioEditando !== null
                      ? "Editar usuário"
                      : "Cadastrar usuário"}
                  </h2>
                  <p>
                    Defina os dados e o acesso do membro da equipe.
                  </p>
                </div>
                <button
                  type="button"
                  className="usuarios-modal-fechar"
                  onClick={fecharModal}
                  disabled={salvando}
                  aria-label="Fechar modal"
                >
                  <FaTimes />
                </button>
              </div>
              <form onSubmit={cadastrarUsuario}>
                <label htmlFor="nome">Nome completo</label>
                <input
                  id="nome"
                  name="nome"
                  type="text"
                  placeholder="Ex.: João da Silva"
                  value={formulario.nome}
                  onChange={atualizarCampo}
                  autoComplete="name"
                  required
                />
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Ex.: joao@empresa.com"
                  value={formulario.email}
                  onChange={atualizarCampo}
                  autoComplete="email"
                  required
                />
                {usuarioEditando === null && (
                  <>
                    <label htmlFor="senha">Senha inicial</label>
                    <input
                      id="senha"
                      name="senha"
                      type="password"
                      placeholder="Mínimo de 6 caracteres"
                      value={formulario.senha}
                      onChange={atualizarCampo}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </>
                )}
                <label htmlFor="setor">Setor</label>
                <select
                  id="setor"
                  name="setor"
                  value={formulario.setor}
                  onChange={atualizarCampo}
                  required
                >
                  {setoresDisponiveis.map((setor) => (
                    <option key={setor} value={setor}>
                      {setor}
                    </option>
                  ))}
                </select>
                {formulario.tipo_usuario === 'Funcionário' && <>
                  <label htmlFor="id_equipe">Equipe responsável (máximo 3 funcionários)</label>
                  <select id="id_equipe" name="id_equipe" value={formulario.id_equipe} onChange={atualizarCampo} required>
                    <option value="">Selecione Hidráulica, Elétrica, Pavimentação...</option>
                    {equipes.map(eq => <option key={eq.id_equipe} value={eq.id_equipe} disabled={Number(eq.integrantes) >= 3 && Number(formulario.id_equipe) !== Number(eq.id_equipe)}>
                      {eq.nome} — {eq.integrantes}/3 integrantes
                    </option>)}
                  </select>
                </>}
                <label htmlFor="cargo">Cargo</label>
                <input
                  id="cargo"
                  name="cargo"
                  type="text"
                  placeholder="Ex.: Analista de infraestrutura"
                  value={formulario.cargo}
                  onChange={atualizarCampo}
                  required
                />
                <label htmlFor="tipo_usuario">Tipo de usuário</label>
                <select
                  id="tipo_usuario"
                  name="tipo_usuario"
                  value={formulario.tipo_usuario}
                  onChange={atualizarCampo}
                  required
                >
                  <option value="Cidadão">Cidadão</option>
                  <option value="Funcionário">Funcionário</option>
                  <option value="Administrador">Administrador</option>
                </select>
                <p>Tipo de acesso: {formulario.tipo_usuario === "Administrador" ? "Administrador" : "Usuário"}</p>
                {erro && (
                  <p className="usuarios-form-erro" role="alert">
                    {erro}
                  </p>
                )}
                <div className="usuarios-modal-acoes">
                  <button
                    type="button"
                    className="usuarios-btn-cancelar"
                    onClick={fecharModal}
                    disabled={salvando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-novo-usuario"
                    disabled={salvando}
                  >
                    {salvando
                      ? "Salvando..."
                      : usuarioEditando !== null
                        ? "Salvar alterações"
                        : "Cadastrar usuário"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
