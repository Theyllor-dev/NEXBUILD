import { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";

import {
  FaBrain,
  FaTrash,
  FaSearch,
  FaFileAlt,
  FaSyncAlt,
  FaCamera,
  FaImage,
  FaKeyboard,
  FaTimes,
  FaCopy,
  FaSave,
} from "react-icons/fa";

import Sidebar from "../../components/Sidebar";

import Header from "../../components/Header";

import { API_URL } from "../../api";

import { buscarNotas, criarNota, removerNota } from "../../dados";

import "./AdminPaginas.css";

import "./Notas.css";

function Notas() {
  const [notas, setNotas] = useState([]);

  const [erroNotas, setErroNotas] = useState("");

  const [modo, setModo] = useState("digital");

  const [titulo, setTitulo] = useState("");

  const [conteudo, setConteudo] = useState("");

  const [busca, setBusca] = useState("");

  const [resumoIA, setResumoIA] = useState("");

  const [carregandoIA, setCarregandoIA] = useState(false);

  const [erroIA, setErroIA] = useState("");

  const [foto, setFoto] = useState(null);

  const [transcricao, setTranscricao] = useState("");
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [progressoOCR, setProgressoOCR] = useState(0);

  const [mensagemFoto, setMensagemFoto] = useState("");

  const [salvando, setSalvando] = useState(false);

  const inputArquivoRef = useRef(null);

  const inputCameraRef = useRef(null);

  const fotoUrlRef = useRef(null);

  // ==========================================

  // NORMALIZAR NOTAS

  // ==========================================

  function paraNota(nota) {
    return {
      id: nota.id_nota ?? nota.id,

      titulo: nota.titulo || "Sem título",

      conteudo: nota.conteudo || "",

      tipo: nota.tipo || "Manual",

      data: nota.data_criacao ?? nota.data,
    };
  }

  // ==========================================

  // CARREGAR NOTAS DO BANCO

  // ==========================================

  async function carregarNotas() {
    try {
      const resultado = await buscarNotas();

      if (!Array.isArray(resultado)) {
        throw new Error("O servidor não retornou uma lista de notas.");
      }

      setNotas(resultado.map(paraNota));

      setErroNotas("");
    } catch (erro) {
      console.error("Erro ao carregar notas:", erro);

      setErroNotas(erro.message || "Erro ao carregar notas.");
    }
  }

  useEffect(() => {
    carregarNotas();
  }, []);

  // ==========================================

  // ADICIONAR NOTA

  // ==========================================

  async function adicionarNota(evento) {
    evento.preventDefault();

    if (!titulo.trim() || !conteudo.trim()) {
      return;
    }

    setSalvando(true);

    setErroNotas("");

    try {
      await criarNota(
        titulo.trim(),

        conteudo.trim(),

        "Manual",
      );

      setTitulo("");

      setConteudo("");

      await carregarNotas();
    } catch (erro) {
      setErroNotas(erro.message || "Erro ao salvar anotação.");
    } finally {
      setSalvando(false);
    }
  }

  // ==========================================

  // EXCLUIR NOTA

  // ==========================================

  async function excluirNota(id) {
    try {
      await removerNota(id);

      setNotas((atuais) => atuais.filter((nota) => nota.id !== id));

      setResumoIA("");

      setErroIA("");
    } catch (erro) {
      setErroNotas(erro.message || "Erro ao excluir nota.");
    }
  }

  // ==========================================

  // SELECIONAR IMAGEM

  // ==========================================

  function selecionarFoto(arquivo) {
    setMensagemFoto("");

    setTranscricao("");

    if (!arquivo) return;

    if (!arquivo.type.startsWith("image/")) {
      setMensagemFoto("Selecione um arquivo de imagem válido.");

      return;
    }

    if (arquivo.size > 10 * 1024 * 1024) {
      setMensagemFoto("A imagem deve ter no máximo 10 MB.");

      return;
    }

    if (fotoUrlRef.current) {
      URL.revokeObjectURL(fotoUrlRef.current);
    }

    const url = URL.createObjectURL(arquivo);

    fotoUrlRef.current = url;

    setFoto({
      arquivo,

      url,

      nome: arquivo.name || "Foto do caderno",
    });
  }

  async function transcreverFoto() {
    if (!foto?.arquivo || transcrevendo) return;

    setTranscrevendo(true);
    setProgressoOCR(0);
    setMensagemFoto("");

    try {
      const resultado = await Tesseract.recognize(foto.arquivo, "por", {
        logger: (evento) => {
          if (evento.status === "recognizing text") {
            setProgressoOCR(Math.round(evento.progress * 100));
          }
        },
      });

      const texto = resultado.data.text.trim();
      if (!texto) {
        setMensagemFoto(
          "Não foi possível reconhecer texto. Tente uma foto mais nítida.",
        );
        return;
      }

      setTranscricao(texto);
      setMensagemFoto("Transcrição pronta! Revise o texto antes de salvar.");
    } catch (erro) {
      console.error("Erro na transcrição:", erro);
      setMensagemFoto(
        "Falha ao transcrever a imagem. Verifique a conexão e tente novamente.",
      );
    } finally {
      setTranscrevendo(false);
    }
  }

  function removerFoto() {
    if (fotoUrlRef.current) {
      URL.revokeObjectURL(fotoUrlRef.current);

      fotoUrlRef.current = null;
    }

    setFoto(null);

    setTranscricao("");

    setMensagemFoto("");

    if (inputArquivoRef.current) {
      inputArquivoRef.current.value = "";
    }

    if (inputCameraRef.current) {
      inputCameraRef.current.value = "";
    }
  }

  useEffect(() => {
    return () => {
      if (fotoUrlRef.current) {
        URL.revokeObjectURL(fotoUrlRef.current);
      }
    };
  }, []);

  // ==========================================

  // SALVAR TRANSCRIÇÃO MANUAL

  // ==========================================

  async function salvarTranscricao() {
    if (transcrevendo || !transcricao.trim()) {
      setMensagemFoto("Digite algum texto antes de salvar.");

      return;
    }

    setSalvando(true);

    setMensagemFoto("");

    try {
      await criarNota(
        titulo.trim() || "Transcrição de caderno",

        transcricao.trim(),

        "Transcrição",
      );

      setTitulo("");

      removerFoto();

      await carregarNotas();

      setMensagemFoto("Transcrição salva no histórico.");
    } catch (erro) {
      setMensagemFoto(erro.message || "Erro ao salvar transcrição.");
    } finally {
      setSalvando(false);
    }
  }

  // ==========================================

  // COPIAR TRANSCRIÇÃO

  // ==========================================

  async function copiarTranscricao() {
    try {
      await navigator.clipboard.writeText(transcricao);

      setMensagemFoto("Texto copiado com sucesso.");
    } catch {
      setMensagemFoto("Não foi possível copiar automaticamente.");
    }
  }

  // ==========================================

  // GERAR ANÁLISE COM OLLAMA

  // ==========================================

  async function gerarResumoIA() {
    if (!notas.some((nota) => nota.tipo !== "Transcrição")) {
      setErroIA("Cadastre pelo menos uma nota para analisar.");

      return;
    }

    setCarregandoIA(true);

    setErroIA("");

    setResumoIA("");

    try {
      const url = `${API_URL.replace(/\/$/, "")}/notas/ia`;

      console.log("[IA] Enviando requisição:", url);

      const resposta = await fetch(url, {
        signal: AbortSignal.timeout(180000),

        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          notas: notas
            .filter((nota) => nota.tipo !== "Transcrição")
            .slice(0, 10)
            .map((nota) => ({
              titulo: nota.titulo,

              conteudo: nota.conteudo.slice(0, 500),

              tipo: nota.tipo,
            })),
        }),
      });

      const respostaTexto = await resposta.text();

      let resultado;

      try {
        resultado = JSON.parse(respostaTexto);
      } catch {
        throw new Error(
          `O servidor não retornou JSON válido (HTTP ${resposta.status}). Confira a URL da API.`,
        );
      }

      console.log("[IA] Status HTTP:", resposta.status);

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ||
            resultado.mensagem ||
            `Erro HTTP ${resposta.status}`,
        );
      }

      if (typeof resultado.resumo !== "string" || !resultado.resumo.trim()) {
        throw new Error(
          "O backend respondeu, mas o campo 'resumo' está vazio.",
        );
      }

      setResumoIA(resultado.resumo.trim());
    } catch (erro) {
      console.error("[IA] Falha:", erro);

      setErroIA(erro.message || "Não foi possível conectar ao servidor.");
    } finally {
      setCarregandoIA(false);
    }
  }

  // ==========================================

  // PESQUISA

  // ==========================================

  const notasFiltradas = notas.filter((nota) =>
    `${nota.titulo} ${nota.conteudo}`

      .toLowerCase()

      .includes(busca.toLowerCase()),
  );

  function formatarData(valor) {
    if (!valor) return "Sem data";

    const data = new Date(valor);

    return Number.isNaN(data.getTime())
      ? "Sem data"
      : data.toLocaleString("pt-BR");
  }

  // ==========================================

  // INTERFACE

  // ==========================================

  return (
    <div className="admin">
      <Sidebar />

      <main className="admin-content">
        <Header />

        <section className="notas-pagina">
          <header className="notas-cabecalho">
            <div>
              <span className="notas-etiqueta">
                <FaBrain /> ESPAÇO DE ANOTAÇÕES
              </span>

              <h1>Notas inteligentes</h1>

              <p>
                Registre ideias, organize suas informações e analise suas notas
                com inteligência artificial.
              </p>
            </div>

            <div className="notas-total">
              <FaFileAlt />

              <span>{notas.length} notas salvas</span>
            </div>
          </header>

          {erroNotas && (
            <p className="notas-erro" role="alert">
              {erroNotas}
            </p>
          )}

          {/* CRIAÇÃO DE NOTAS */}

          <section className="notas-area-criacao">
            <div
              className="notas-abas"
              role="tablist"
              aria-label="Forma de anotação"
            >
              <button
                type="button"
                role="tab"
                aria-selected={modo === "digital"}
                className={modo === "digital" ? "ativa" : ""}
                onClick={() => setModo("digital")}
              >
                <FaKeyboard />
                Escrever
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={modo === "foto"}
                className={modo === "foto" ? "ativa" : ""}
                onClick={() => setModo("foto")}
              >
                <FaCamera />
                Foto do caderno
              </button>
            </div>

            {modo === "digital" ? (
              <section className="notas-editor">
                <div className="notas-secao-titulo">
                  <div>
                    <h2>Nova anotação</h2>

                    <p>Escreva diretamente no editor.</p>
                  </div>

                  <FaKeyboard />
                </div>

                <form onSubmit={adicionarNota}>
                  <label htmlFor="nota-titulo">Título</label>

                  <input
                    id="nota-titulo"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex.: Problemas recorrentes no bairro"
                    maxLength={120}
                    required
                  />

                  <label htmlFor="nota-conteudo">Sua anotação</label>

                  <textarea
                    id="nota-conteudo"
                    value={conteudo}
                    onChange={(e) => setConteudo(e.target.value)}
                    placeholder="Escreva suas ideias, observações ou decisões..."
                    rows={7}
                    required
                  />

                  <div className="notas-editor-rodape">
                    <span>{conteudo.length} caracteres</span>

                    <button
                      className="notas-botao-principal"
                      type="submit"
                      disabled={salvando}
                    >
                      <FaSave />

                      {salvando ? "Salvando..." : "Salvar anotação"}
                    </button>
                  </div>
                </form>
              </section>
            ) : (
              <section className="notas-editor">
                <div className="notas-secao-titulo">
                  <div>
                    <h2>Digitalizar caderno</h2>

                    <p>Selecione uma imagem e registre o texto da anotação.</p>
                  </div>

                  <FaCamera />
                </div>

                <div className="notas-upload-opcoes">
                  <button
                    type="button"
                    className="notas-upload-card"
                    onClick={() => inputCameraRef.current?.click()}
                    disabled={transcrevendo}
                  >
                    <span className="notas-upload-icone">
                      <FaCamera />
                    </span>

                    <strong>Tirar foto</strong>

                    <span>Abrir câmera do dispositivo</span>
                  </button>

                  <button
                    type="button"
                    className="notas-upload-card"
                    onClick={() => inputArquivoRef.current?.click()}
                    disabled={transcrevendo}
                  >
                    <span className="notas-upload-icone">
                      <FaImage />
                    </span>

                    <strong>Enviar imagem</strong>

                    <span>Escolher imagem salva</span>
                  </button>
                </div>

                <input
                  ref={inputCameraRef}
                  className="notas-input-arquivo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-label="Tirar foto do caderno"
                  onChange={(e) => {
                    selecionarFoto(e.target.files?.[0]);

                    e.target.value = "";
                  }}
                />

                <input
                  ref={inputArquivoRef}
                  className="notas-input-arquivo"
                  type="file"
                  accept="image/*"
                  aria-label="Escolher imagem do caderno"
                  onChange={(e) => {
                    selecionarFoto(e.target.files?.[0]);

                    e.target.value = "";
                  }}
                />

                {foto && (
                  <div className="notas-foto-preview">
                    <div className="notas-foto-cabecalho">
                      <div>
                        <strong>Imagem selecionada</strong>

                        <span>{foto.nome}</span>
                      </div>

                      <button
                        type="button"
                        className="notas-botao-icon"
                        onClick={removerFoto}
                        disabled={transcrevendo}
                        aria-label="Remover imagem"
                      >
                        <FaTimes />
                      </button>
                    </div>

                    <img src={foto.url} alt="Prévia da foto do caderno" />

                    <div className="notas-aviso-ia">
                      <FaBrain />

                      <p>
                        A transcrição da foto é feita automaticamente por OCR,
                        sem usar a IA de análise. Revise o texto antes de
                        salvar.
                      </p>
                    </div>

                    <div className="notas-ocr-acoes">
                      <button
                        type="button"
                        className="notas-botao-principal notas-ocr-botao"
                        onClick={transcreverFoto}
                        disabled={transcrevendo || salvando}
                      >
                        {transcrevendo ? (
                          <FaSyncAlt className="notas-girando" />
                        ) : (
                          <FaFileAlt />
                        )}
                        {transcrevendo
                          ? `Transcrevendo... ${progressoOCR}%`
                          : "Transcrever foto"}
                      </button>
                      {transcrevendo && (
                        <div
                          className="notas-ocr-progresso"
                          role="progressbar"
                          aria-label="Progresso da transcrição"
                          aria-valuenow={progressoOCR}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <span style={{ width: `${progressoOCR}%` }} />
                        </div>
                      )}
                    </div>

                    <label htmlFor="nota-titulo-foto">Título da anotação</label>

                    <input
                      id="nota-titulo-foto"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex.: Reunião sobre infraestrutura"
                      maxLength={120}
                    />

                    <div className="notas-transcricao-cabecalho">
                      <div>
                        <h3>Texto transcrito</h3>

                        <p>
                          Confira e edite o texto reconhecido antes de salvar.
                        </p>
                      </div>

                      <span>EDITÁVEL</span>
                    </div>

                    <textarea
                      className="notas-transcricao"
                      value={transcricao}
                      onChange={(e) => setTranscricao(e.target.value)}
                      placeholder="Digite o texto da imagem..."
                      rows={8}
                    />

                    <div className="notas-editor-rodape">
                      <span>{transcricao.length} caracteres</span>

                      <div className="notas-acoes-transcricao">
                        <button
                          type="button"
                          className="notas-botao-secundario"
                          onClick={copiarTranscricao}
                          disabled={!transcricao.trim()}
                        >
                          <FaCopy />
                          Copiar
                        </button>

                        <button
                          type="button"
                          className="notas-botao-principal"
                          onClick={salvarTranscricao}
                          disabled={
                            salvando || transcrevendo || !transcricao.trim()
                          }
                        >
                          <FaSave />
                          Salvar texto
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {mensagemFoto && (
                  <p className="notas-mensagem" role="status">
                    {mensagemFoto}
                  </p>
                )}
              </section>
            )}
          </section>

          {/* ANÁLISE INTELIGENTE */}

          <section className="notas-ia-resumo">
            <div className="notas-secao-titulo">
              <div>
                <h2>Análise inteligente</h2>

                <p>
                  Identifique padrões, prioridades e sugestões nas notas salvas.
                </p>
              </div>

              <FaBrain />
            </div>

            <button
              className="notas-botao-secundario"
              type="button"
              onClick={gerarResumoIA}
              disabled={
                carregandoIA ||
                !notas.some((nota) => nota.tipo !== "Transcrição")
              }
            >
              {carregandoIA ? (
                <FaSyncAlt className="notas-girando" />
              ) : (
                <FaBrain />
              )}

              {carregandoIA ? "Analisando notas..." : "Analisar notas salvas"}
            </button>

            {carregandoIA && (
              <div className="ia-carregamento" role="status">
                <div className="ia-digitando" aria-hidden="true">
                  <span></span>

                  <span></span>

                  <span></span>
                </div>

                <p className="notas-texto-suave">IA analisando suas notas...</p>
              </div>
            )}

            {erroIA && (
              <p className="notas-erro" role="alert">
                {erroIA}
              </p>
            )}

            {resumoIA && (
              <div className="notas-resumo">
                <h3>
                  <FaBrain />
                  Resultado da análise
                </h3>

                <div className="notas-resumo-texto">{resumoIA}</div>

                <button
                  className="notas-botao-secundario"
                  type="button"
                  onClick={() =>
                    navigator.clipboard

                      .writeText(resumoIA)

                      .catch(() =>
                        setErroIA("Não foi possível copiar a análise."),
                      )
                  }
                >
                  <FaCopy />
                  Copiar análise
                </button>
              </div>
            )}

            {!resumoIA && !erroIA && !carregandoIA && (
              <p className="notas-texto-suave">
                O resultado da análise aparecerá aqui.
              </p>
            )}
          </section>

          {/* HISTÓRICO */}

          <section className="notas-historico">
            <div className="notas-lista-cabecalho">
              <div>
                <h2>Histórico</h2>

                <p>Pesquise, consulte e organize suas anotações.</p>
              </div>

              <div className="notas-busca">
                <FaSearch />

                <input
                  aria-label="Pesquisar notas"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Pesquisar notas..."
                />
              </div>
            </div>

            <div className="notas-historico-resumo">
              <span>{notas.length} notas registradas</span>

              <span>{notasFiltradas.length} resultados</span>
            </div>

            {notasFiltradas.length === 0 ? (
              <div className="notas-vazio">
                <FaFileAlt />

                <p>Nenhuma anotação encontrada.</p>
              </div>
            ) : (
              <div className="notas-lista-itens">
                {notasFiltradas.map((nota) => (
                  <article className="notas-item" key={nota.id}>
                    <div className="notas-item-conteudo">
                      <div className="notas-item-meta">
                        <span>{nota.tipo}</span>

                        <time>{formatarData(nota.data)}</time>
                      </div>

                      <h3>{nota.titulo}</h3>

                      <p>{nota.conteudo}</p>
                    </div>

                    <button
                      className="notas-botao-icon notas-excluir"
                      type="button"
                      onClick={() => excluirNota(nota.id)}
                      aria-label={`Excluir nota ${nota.titulo}`}
                      title="Excluir nota"
                    >
                      <FaTrash />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

export default Notas;
