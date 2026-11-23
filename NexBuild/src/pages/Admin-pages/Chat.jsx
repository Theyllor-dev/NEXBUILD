
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useSearchParams } from "react-router-dom";
import {
  FaComments,
  FaPaperPlane,
  FaUsers,
  FaHashtag,
} from "react-icons/fa";
import Header from "../../components/Header";
import { API_URL } from "../../api";
import Sidebar from "../../components/Sidebar";
import "./Chat.css";

const canais = [
  { id: "geral", nome: "Geral" },
  { id: "infraestrutura", nome: "Infraestrutura" },
  { id: "atendimento", nome: "Atendimento" },
  { id: "administracao", nome: "Administração" },
  { id: "tecnologia", nome: "Tecnologia" },
];

function Chat() {
  const [params] = useSearchParams();
  const usuario = (() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "null");
    } catch {
      return null;
    }
  })();
  const idUsuario = Number(usuario?.id_usuario);
  const nome = String(usuario?.nome || usuario?.email || "Usuário");
  const [canal, setCanal] = useState(() => canais.some(c => c.id === params.get("canal")) ? params.get("canal") : "geral");
  const [destinatario, setDestinatario] = useState(() => Number(params.get("usuario")) || null);
  const [usuarios, setUsuarios] = useState([]);
  const [equipesChat,setEquipesChat]=useState([]);
  useEffect(()=>{
    fetch(`${API_URL}/equipes-operacionais`,{headers:{Authorization:`Bearer ${localStorage.getItem('token')||''}`}})
    .then(r=>r.ok?r.json():[]).then(async lista=>{
      if(usuario?.perfil==='Administrador')setEquipesChat(lista.map(e=>({id:`equipe-${e.id_equipe}`,nome:e.nome})));
      else {const r=await fetch(`${API_URL}/equipes-operacionais/minha`,{headers:{Authorization:`Bearer ${localStorage.getItem('token')||''}`}});
        if(r.ok){const eq=await r.json();setEquipesChat(eq?[{id:`equipe-${eq.id_equipe}`,nome:eq.nome}]:[])} }
    }).catch(()=>{});
  },[]);
  const [privadas, setPrivadas] = useState({});
  const [mensagem, setMensagem] = useState("");
  const [mensagens, setMensagens] = useState([]);
  const [conectado, setConectado] = useState(false);
  const [erroChat, setErroChat] = useState("");
  const socketRef = useRef(null);
  const mensagensRef = useRef(null);
  const [digitando, setDigitando] = useState([]);
  const digitacaoTimer = useRef(null);
  const digitandoRef = useRef(new Map());

  useEffect(() => {
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
      setErroChat("Entre na sua conta para acessar o chat.");
      return undefined;
    }

    fetch(`${API_URL}/chat/usuarios`, { headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } })
      .then(r => { if (!r.ok) throw new Error("Não foi possível carregar usuários."); return r.json(); })
      .then(setUsuarios).catch(e => setErroChat(e.message));
    const socket = io(API_URL, {
      auth: { token: localStorage.getItem("token") },
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConectado(true);
      setErroChat("");
    });
    socket.on("disconnect", () => setConectado(false));
    socket.on("connect_error", (erro) => {
      setConectado(false);
      setErroChat(erro.message || "Não foi possível conectar ao chat.");
    });
    socket.on("chat-erro", (texto) => setErroChat(texto));
    socket.on("chat-digitando", (dados) => {
      if (!dados || Number(dados.id_usuario) === idUsuario) return;
      const chave = `${dados.tipo}:${dados.alvo}:${dados.id_usuario}`;
      const anterior = digitandoRef.current.get(chave);
      if (anterior) clearTimeout(anterior.timer);
      if (dados.ativo) {
        const timer = setTimeout(() => {
          digitandoRef.current.delete(chave);
          setDigitando([...digitandoRef.current.keys()]);
        }, 2500);
        digitandoRef.current.set(chave, { nome: dados.nome, timer });
      } else digitandoRef.current.delete(chave);
      setDigitando([...digitandoRef.current.keys()]);
    });
    socket.on("historico-mensagens", (dados) => {
      setMensagens((anteriores) => {
        const outras = anteriores.filter((item) => item.canal !== dados.canal);
        return [...outras, ...(dados.mensagens || [])];
      });
    });
    socket.on("historico-privado", ({ usuario, mensagens }) => {
      setPrivadas(anteriores => ({ ...anteriores, [usuario]: mensagens }));
    });
    socket.on("nova-privada", (dados) => {
      const outro = dados.id_usuario === idUsuario ? dados.id_destinatario : dados.id_usuario;
      setPrivadas(anteriores => ({
        ...anteriores,
        [outro]: (anteriores[outro] || []).some(m => m.id === dados.id)
          ? anteriores[outro] : [...(anteriores[outro] || []), dados]
      }));
    });
    socket.on("nova-mensagem", (dados) => {
      setMensagens((anteriores) => {
        if (anteriores.some((item) => item.id === dados.id)) return anteriores;
        return [...anteriores, dados];
      });
    });

    return () => {
      clearTimeout(digitacaoTimer.current);
      digitandoRef.current.forEach(({timer}) => clearTimeout(timer));
      digitandoRef.current.clear();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [idUsuario]);

  useEffect(() => {
    if (conectado && destinatario) socketRef.current?.emit("listar-privadas", destinatario);
  }, [conectado, destinatario]);
  useEffect(() => {
    const id = Number(params.get("usuario"));
    if (id > 0) setDestinatario(id);
    else if ([...canais,...equipesChat].some(c => c.id === params.get("canal"))) {
      setDestinatario(null); setCanal(params.get("canal"));
    }
  }, [params,equipesChat]);
  useEffect(() => {
    if (!conectado || !socketRef.current) return;
    setErroChat("");
    socketRef.current.emit("entrar-canal", canal);
  }, [canal, conectado]);

  useEffect(() => {
    mensagensRef.current?.scrollTo({
      top: mensagensRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [mensagens]);

  function emitirDigitacao(ativo, alvo = destinatario, canalAlvo = canal) {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("chat-digitando", alvo
      ? { tipo: "privada", alvo: Number(alvo), ativo }
      : { tipo: "canal", alvo: canalAlvo, ativo });
  }
  function mudarMensagem(texto) {
    setMensagem(texto);
    clearTimeout(digitacaoTimer.current);
    emitirDigitacao(Boolean(texto.trim()));
    if (texto.trim()) digitacaoTimer.current = setTimeout(() => emitirDigitacao(false), 1200);
  }
  useEffect(() => {
    setDigitando([]);
    setMensagem("");
    return () => clearTimeout(digitacaoTimer.current);
  }, [canal, destinatario]);
  function abrirPrivada(id) {
    setDestinatario(id);
    socketRef.current?.emit("listar-privadas", id);
  }
  function enviarMensagem(e) {
    e.preventDefault();
    const texto = mensagem.trim();
    if (!texto || !socketRef.current?.connected) return;
    if (destinatario) socketRef.current.emit("enviar-privada", { destinatario, texto });
    else socketRef.current.emit("enviar-mensagem", { canal, texto });
    emitirDigitacao(false);
    clearTimeout(digitacaoTimer.current);
    setMensagem("");
  }

  const canalAtual = [...canais,...equipesChat].find((item) => item.id === canal);
  const pessoasDigitando = [...digitandoRef.current.entries()]
    .filter(([chave]) => {
      const [tipo, alvo] = chave.split(":");
      return destinatario ? tipo === "privada" && Number(alvo) === idUsuario : tipo === "canal" && alvo === canal;
    }).map(([, info]) => info.nome);


  return (
    <div className="admin">
      <Sidebar />

      <main className="admin-content">
        <Header />

        <section className="Content-chat">
          <div className="chat-topo">
            <div>
              <h1>
                <FaComments /> Chat interno
              </h1>
              <p>Converse com a equipe do Nexativo.</p>
            </div>

            <span className={`chat-status ${conectado ? "online" : ""}`}>
              <span />
              {conectado ? "Conectado" : "Desconectado"}
            </span>
          </div>

          {erroChat && <p className="chat-erro" role="status">{erroChat}</p>}
          {Number.isInteger(idUsuario) && idUsuario > 0 ? (
            <div className="chat-layout">
              <aside className="chat-canais">
                <h3><FaUsers /> Canais da equipe</h3>

                {[...canais,...equipesChat].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`chat-canal ${
                      !destinatario && canal === item.id ? "ativo" : ""
                    }`}
                    onClick={() => { setDestinatario(null); setCanal(item.id); }}
                  >
                    <FaHashtag />
                    {item.nome}
                  </button>
                ))}

                <h3 className="chat-privados-titulo"><FaUsers /> Mensagens privadas</h3>
                {usuarios.map(pessoa => (
                  <button type="button" key={pessoa.id_usuario}
                    className={`chat-canal ${destinatario === pessoa.id_usuario ? "ativo" : ""}`}
                    onClick={() => abrirPrivada(pessoa.id_usuario)}>
                    <span className="chat-avatar">{pessoa.nome.charAt(0).toUpperCase()}</span>
                    <span>{pessoa.nome}</span>
                  </button>
                ))}
                <div className="chat-usuario">
                  <span className="chat-avatar">
                    {nome.trim().charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <strong>{nome}</strong>
                    <small>Seu perfil</small>
                  </div>
                </div>
              </aside>

              <div className="chat-conversa">
                <header className="chat-conversa-topo">
                  <div>
                    <h2><FaHashtag /> {destinatario ? usuarios.find(u=>u.id_usuario===destinatario)?.nome : canalAtual?.nome}</h2>
                    <p>{destinatario ? "Conversa privada" : "Canal de comunicação interna"}</p>
                  </div>
                </header>

                <div className="chat-mensagens" ref={mensagensRef}>
                  {(destinatario ? (privadas[destinatario] || []) : mensagens.filter((item) => item.canal === canal)).length === 0 ? (
                    <div className="chat-vazio">
                      <FaComments />
                      <h3>Nenhuma mensagem ainda</h3>
                      <p>Envie a primeira mensagem deste canal.</p>
                    </div>
                  ) : (
                    (destinatario ? (privadas[destinatario] || []) : mensagens.filter((item) => item.canal === canal))
                      .map((item, indice) => (
                        <article
                          key={item.id || `${item.nome}-${item.horario}-${indice}`}
                          className={`chat-mensagem ${
                            (item.id_usuario && item.id_usuario === idUsuario) || item.nome === nome ? "minha" : ""
                          }`}
                        >
                          <span className="chat-avatar">
                            {(item.nome || "?").charAt(0).toUpperCase()}
                          </span>

                          <div className="chat-mensagem-corpo">
                            <div className="chat-mensagem-info">
                              <strong>{item.nome}</strong>
                              <time>{item.horario || ""}</time>
                            </div>
                            <p>{item.texto}</p>
                          </div>
                        </article>
                      ))
                  )}
                </div>

                <div className="chat-digitando-area" aria-live="polite">
                  {pessoasDigitando.length > 0 && <div className="chat-digitando">
                    <span className="chat-digitando-bolinhas"><i/><i/><i/></span>
                    <span>{pessoasDigitando.length === 1 ? `${pessoasDigitando[0]} está digitando` : `${pessoasDigitando.length} pessoas estão digitando`}</span>
                  </div>}
                </div>
                <form className="chat-formulario" onSubmit={enviarMensagem}>
                  <input
                    value={mensagem}
                    onChange={(e) => mudarMensagem(e.target.value)}
                    placeholder={
                      conectado
                        ? `Mensagem para ${destinatario ? usuarios.find(u=>u.id_usuario===destinatario)?.nome : canalAtual?.nome}...`
                        : "Aguardando conexão com o servidor..."
                    }
                    maxLength={2000}
                    disabled={!conectado}
                  />

                  <button
                    type="submit"
                    aria-label="Enviar mensagem"
                    disabled={!conectado || !mensagem.trim()}
                  >
                    <FaPaperPlane />
                    <span>Enviar</span>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="chat-identificacao">
              <h2>Entre na sua conta</h2>
              <p>O chat usa o usuário conectado para identificar suas mensagens.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Chat;
