import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { API_URL } from "../api";
import "./Denuncia.css";
import SelecionarPontoMapa from "../components/SelecionarPontoMapa";

const MAX_DESCRICAO = 500;
const MIN_DESCRICAO = 10;
const ETAPAS = [
  { id: "lugar", titulo: "Local", campos: ["cep", "cidade", "bairro", "rua"] },
  { id: "problema", titulo: "Detalhes", campos: ["categoria", "descricao", "gravidade", "nome", "anonimo"] },
];
const ULTIMA = ETAPAS.length - 1;
const CATEGORIAS = [
  "Vazamento de água ou esgoto",
  "Buraco ou rua danificada",
  "Iluminação pública",
  "Lixo ou entulho acumulado",
  "Alagamento ou drenagem",
  "Árvores e áreas verdes",
  "Outro assunto",
];
const GRAVIDADES = [
  {
    value: "baixa",
    nivel: 1,
    titulo: "Pode esperar",
    desc: "Incomoda, mas não há risco agora.",
  },
  {
    value: "media",
    nivel: 2,
    titulo: "Merece atenção",
    desc: "Atrapalha o dia a dia de quem passa por ali.",
  },
  {
    value: "alta",
    nivel: 3,
    titulo: "É urgente",
    desc: "Oferece risco à saúde ou à segurança.",
  },
];
const obrigatorio = (mensagem) => ({
  validate: (v) => (v ?? "").trim().length > 0 || mensagem,
});

function Denuncia() {
  const {
    register,
    handleSubmit,
    trigger,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onTouched",
    defaultValues: { gravidade: "media", anonimo: false, categoria: "" },
  });
  const [tema, setTema] = useState(() => {
    try { return localStorage.getItem('nexbuild-denuncia-tema') === 'claro' ? 'claro' : 'escuro'; }
    catch { return 'escuro'; }
  });
  useEffect(() => {
    try { localStorage.setItem('nexbuild-denuncia-tema', tema); } catch { /* storage indisponível */ }
  }, [tema]);
  const alternarTema = () => setTema(t => t === 'escuro' ? 'claro' : 'escuro');
  const barraTema = (
    <div className="nex-denuncia-topbar">
      <a href="/" className="nex-denuncia-marca" aria-label="Voltar à página inicial">
        <span className="nex-denuncia-marca-icon">N</span>
        <span>NEXBUILD</span>
      </a>
      <div className="nex-denuncia-top-actions">
        <a href="/" className="nex-denuncia-home" aria-label="Voltar para a Home">
          <span aria-hidden="true">←</span> Voltar
        </a>
        <span className="nex-denuncia-status"><i aria-hidden="true" /> SISTEMA DE OCORRÊNCIAS</span>
        <button className="nex-denuncia-tema" type="button" onClick={alternarTema}
          aria-label={tema === 'escuro' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          title={tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}>
          <span aria-hidden="true">{tema === 'escuro' ? '☀' : '☾'}</span>
          {tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}
        </button>
      </div>
    </div>
  );
  const [etapa, setEtapa] = useState(0);
  const [enviado, setEnviado] = useState(null);
  const [erroEnvio, setErroEnvio] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [avisoCep, setAvisoCep] = useState("");
  const [coords, setCoords] = useState(null);
  const [mostrarMapaEscolha, setMostrarMapaEscolha] = useState(false);
  const [msgLocal, setMsgLocal] = useState("");
  const [copiado, setCopiado] = useState(false);
  const tituloRef = useRef(null);
  const ultimoCep = useRef("");
  const enviando = useRef(false);
  const preenchendoPeloGps = useRef(false);
  const ultimaBuscaAutomatica = useRef("");
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [enderecoConfirmado, setEnderecoConfirmado] = useState("");
  const anonimo = watch("anonimo");
  const descricao = watch("descricao") ?? "";
  const cidadeAtual = watch("cidade");
  const bairroAtual = watch("bairro");
  const ruaAtual = watch("rua");
  const cepAtual = watch("cep");
  useEffect(() => {
    if (preenchendoPeloGps.current) {
      preenchendoPeloGps.current = false;
      return;
    }
    setCoords(null);
    setEnderecoConfirmado("");
    setMsgLocal("");
    ultimaBuscaAutomatica.current = "";
  }, [cidadeAtual, bairroAtual, ruaAtual, cepAtual]);

  useEffect(() => {
    tituloRef.current?.focus();
  }, [etapa, enviado]);

  async function buscarCep(e) {
    const cep = e.target.value.replace(/\D/g, "");
    if (cep.length !== 8) {
      setAvisoCep("");
      return;
    }
    if (cep === ultimoCep.current) return;
    ultimoCep.current = cep;
    setAvisoCep("");
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!r.ok) throw new Error("ViaCEP indisponível");
      const d = await r.json();
      if (ultimoCep.current !== cep) return;
      if (d.erro) {
        setAvisoCep(
          "Não encontramos esse CEP. Preencha o endereço manualmente.",
        );
        return;
      }
      const preencher = (campo, valor) => {
        if (valor) setValue(campo, valor, { shouldValidate: true });
      };
      preencher("cidade", d.localidade);
      preencher("bairro", d.bairro);
      preencher("rua", d.logradouro);
      setAvisoCep(
        "Endereço encontrado. Confira e acrescente o número ou referência.",
      );
    } catch {
      ultimoCep.current = "";
      setAvisoCep(
        "Não conseguimos buscar o CEP agora. Preencha o endereço manualmente.",
      );
    } finally {
      setBuscandoCep(false);
    }
  }

  async function localizarEndereco() {
    const cidade = String(cidadeAtual || "").trim();
    const bairro = String(bairroAtual || "").trim();
    const rua = String(ruaAtual || "").trim();
    if (!cidade || !bairro || !rua) {
      setMsgLocal("Preencha cidade, bairro e rua antes de localizar.");
      return;
    }
    setBuscandoEndereco(true);
    setCoords(null);
    setEnderecoConfirmado("");
    setMsgLocal("Consultando a localização do endereço…");
    try {
      const resposta = await fetch(`${API_URL}/geocodificar-endereco`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cidade, bairro, rua, cep: cepAtual || "" }),
      });
      const resultado = await resposta.json().catch(() => ({}));
      if (!resposta.ok)
        throw new Error(
          resultado.erro || "Não foi possível localizar o endereço.",
        );
      setCoords({
        latitude: resultado.latitude,
        longitude: resultado.longitude,
      });
      setEnderecoConfirmado(
        resultado.endereco_encontrado || "Endereço localizado",
      );
      setMsgLocal(
        "Ponto encontrado. Confira o endereço abaixo antes de enviar.",
      );
      setMostrarMapaEscolha(true);
    } catch (erro) {
      setMsgLocal(erro.message || "Não foi possível localizar o endereço.");
    } finally {
      setBuscandoEndereco(false);
    }
  }

  // Busca automática com pausa de digitação. O botão manual continua disponível.
  useEffect(() => {
    if (etapa !== 0 || buscandoCep || buscandoEndereco || coords) return;
    const cidade = String(cidadeAtual || "").trim();
    const bairro = String(bairroAtual || "").trim();
    const rua = String(ruaAtual || "").trim();
    if (!cidade || !bairro || rua.length < 5) return;
    const chave = [cidade, bairro, rua, cepAtual || ""].join("|").toLowerCase();
    if (ultimaBuscaAutomatica.current === chave) return;
    const timer = setTimeout(() => {
      ultimaBuscaAutomatica.current = chave;
      void localizarEndereco();
    }, 1300);
    return () => clearTimeout(timer);
  }, [etapa, cidadeAtual, bairroAtual, ruaAtual, cepAtual, buscandoCep, buscandoEndereco, coords]);

  function marcarMinhaPosicao() {
    if (!navigator.geolocation) {
      setMsgLocal("Seu navegador não oferece geolocalização. Preencha o endereço manualmente.");
      return;
    }
    setMsgLocal("Obtendo GPS e consultando endereço…");
    navigator.geolocation.getCurrentPosition(
      async ({ coords: c }) => {
        const ponto = { latitude: c.latitude, longitude: c.longitude };
        // Primeiro preenche o endereço; só depois confirma as coordenadas,
        // pois o efeito que observa mudanças dos campos limpa coords.
        try {
          const resposta = await fetch(`${API_URL}/geocodificar-reverso`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ponto),
          });
          const dados = await resposta.json().catch(() => ({}));
          if (!resposta.ok) throw new Error(dados.erro || "Endereço não encontrado.");
          preenchendoPeloGps.current = true;
          if (dados.cidade) setValue("cidade", dados.cidade, { shouldValidate: true });
          if (dados.bairro) setValue("bairro", dados.bairro, { shouldValidate: true });
          if (dados.rua) setValue("rua", dados.rua, { shouldValidate: true });
          // Evita a limpeza das coordenadas causada pelo efeito após preencher os campos.
          setTimeout(() => {
            setCoords(ponto);
            setEnderecoConfirmado(dados.endereco_encontrado || "Localização do GPS");
            setMsgLocal("GPS localizado. Confira e complete os campos antes de continuar.");
          }, 0);
        } catch (erro) {
          setCoords(ponto);
          setEnderecoConfirmado("Localização obtida pelo GPS; endereço não identificado");
          setMsgLocal(`${erro.message} Preencha cidade, bairro e rua manualmente; se alterar o endereço, confirme o ponto novamente.`);
        }
      },
      () => {
        setCoords(null);
        setMsgLocal("Não foi possível obter o GPS. Use a busca pelo endereço.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function avancar() {
    const ok = await trigger(ETAPAS[etapa].campos);
    if (ok) setEtapa((e) => Math.min(e + 1, ULTIMA));
  }
  function aoEnviarFormulario(e) {
    if (etapa < ULTIMA) {
      e.preventDefault();
      void avancar();
      return;
    }
    return handleSubmit(enviar, aoInvalido)(e);
  }
  function aoInvalido(errs) {
    const i = ETAPAS.findIndex((et) => et.campos.some((c) => errs[c]));
    if (i >= 0) setEtapa(i);
  }

  async function enviar(dados) {
    if (enviando.current) return;

    // Tenta localizar automaticamente pelo endereço antes de exigir confirmação no mapa.
    let ponto = coords;
    if (!ponto) {
      setBuscandoEndereco(true);
      setErroEnvio("");
      try {
        const resposta = await fetch(`${API_URL}/geocodificar-endereco`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cidade: dados.cidade.trim(), bairro: dados.bairro.trim(),
            rua: dados.rua.trim(), cep: (dados.cep || "").trim(),
          }),
        });
        const resultado = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(resultado.erro || "Endereço não localizado.");
        ponto = { latitude: Number(resultado.latitude), longitude: Number(resultado.longitude) };
        setCoords(ponto);
        setEnderecoConfirmado(resultado.endereco_encontrado || "Endereço localizado automaticamente");
      } catch {
        setEtapa(0);
        setMostrarMapaEscolha(true);
        setErroEnvio("Não foi possível localizar essa rua automaticamente. Selecione o local exato clicando no mapa abaixo e depois envie novamente.");
        return;
      } finally {
        setBuscandoEndereco(false);
      }
    }
    const latitude = Number(ponto?.latitude);
    const longitude = Number(ponto?.longitude);
    if (!ponto || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      setEtapa(0);
      setMostrarMapaEscolha(true);
      setErroEnvio("Selecione um ponto válido no mapa.");
      return;
    }

    enviando.current = true;
    setErroEnvio("");
    const corpo = {
      // O backend público não vincula a denúncia a uma conta sem autenticação.
      id_usuario: null,
      nome: dados.anonimo ? "" : (dados.nome ?? "").trim(),
      anonimo: Boolean(dados.anonimo),
      categoria: dados.categoria,
      titulo: `${dados.categoria}: ${dados.descricao.trim().slice(0, 90)}`,
      descricao: dados.descricao.trim(),
      gravidade: dados.gravidade,
      prioridade: dados.gravidade,
      cep: (dados.cep ?? "").trim(),
      cidade: dados.cidade.trim(),
      bairro: dados.bairro.trim(),
      rua: dados.rua.trim(),
      latitude,
      longitude,
    };
    try {
      const resp = await fetch(`${API_URL}/denuncia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const resultado = await resp.json().catch(() => ({}));
      if (!resp.ok)
        throw new Error(
          resultado.erro || `Não foi possível registrar (erro ${resp.status}).`,
        );
      setEnviado(resultado && typeof resultado === "object" ? resultado : {});
    } catch (e) {
      setErroEnvio(
        e.message ||
          "Não conseguimos enviar agora. Confira a conexão e tente novamente.",
      );
    } finally {
      enviando.current = false;
    }
  }

  function recomecar() {
    reset({ gravidade: "media", anonimo: false, categoria: "" });
    ultimoCep.current = "";
    setAvisoCep("");
    setCoords(null);
    setMostrarMapaEscolha(false);
    setEnderecoConfirmado("");
    setMsgLocal("");
    setCopiado(false);
    setErroEnvio("");
    setEtapa(0);
    setEnviado(null);
  }
  async function copiarProtocolo(texto) {
    try {
      await navigator.clipboard.writeText(String(texto));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      setErroEnvio("Não foi possível copiar. Anote o número do protocolo.");
    }
  }

  if (enviado) {
    const protocolo =
      enviado.protocolo ??
      (enviado.id_ocorrencia
        ? `#${enviado.id_ocorrencia}`
        : enviado.id
          ? `#${enviado.id}`
          : null);
    return (
      <main className={`relato nex-denuncia ${tema === "claro" ? "nex-denuncia--claro" : "nex-denuncia--escuro"}`}>
      <div className="nex-ambient nex-ambient--one" aria-hidden="true" />
      <div className="nex-ambient nex-ambient--two" aria-hidden="true" />
      {barraTema}
        <section className="cartao sucesso" aria-labelledby="sucesso-titulo">
          <div className="sucesso__selo" aria-hidden="true">
            ✓
          </div>
          <h1 id="sucesso-titulo" ref={tituloRef} tabIndex={-1}>
            Obrigado por cuidar do seu bairro
          </h1>
          <p className="sucesso__lead">
            Seu relato foi enviado. A equipe poderá conferir as informações e
            encaminhar o problema para quem resolve.
          </p>
          {protocolo && (
            <div className="protocolo">
              <span className="protocolo__rotulo">Número do seu relato</span>
              <strong className="protocolo__codigo">{protocolo}</strong>
              <button
                type="button"
                className="botao botao--suave"
                onClick={() => copiarProtocolo(protocolo)}
              >
                {copiado ? "Copiado!" : "Copiar número"}
              </button>
              <small>Guarde este número para consultar o relato.</small>
            </div>
          )}
          <h2 className="sucesso__subtitulo">O que acontece agora</h2>
          <ol className="linha-tempo">
            <li className="linha-tempo__item is-feito">
              <span className="linha-tempo__marcador">✓</span>
              <div>
                <strong>Recebemos seu relato</strong>
                <p>O registro foi enviado ao sistema.</p>
              </div>
            </li>
            <li className="linha-tempo__item">
              <span className="linha-tempo__marcador">2</span>
              <div>
                <strong>As informações serão conferidas</strong>
                <p>
                  A equipe responsável poderá verificar o local e a descrição.
                </p>
              </div>
            </li>
            <li className="linha-tempo__item">
              <span className="linha-tempo__marcador">3</span>
              <div>
                <strong>O caso poderá ser encaminhado</strong>
                <p>O andamento depende da análise da equipe responsável.</p>
              </div>
            </li>
          </ol>
          <button
            type="button"
            className="botao botao--primario"
            onClick={recomecar}
          >
            Relatar outro problema
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={`relato nex-denuncia ${tema === "claro" ? "nex-denuncia--claro" : "nex-denuncia--escuro"}`}>
      <div className="nex-ambient nex-ambient--one" aria-hidden="true" />
      <div className="nex-ambient nex-ambient--two" aria-hidden="true" />
      {barraTema}
      <header className="relato__topo">
        <span className="selo"><span className="nex-pulse" aria-hidden="true" /> NEXBUILD · PORTAL INTELIGENTE</span>
        <h1>Registrar ocorrência</h1>
        <p>
          Registre o problema em poucos passos.
        </p>
      </header>
      <form className="cartao" onSubmit={aoEnviarFormulario} noValidate>
        <div className="nex-form-head"><div><span className="nex-eyebrow">NOVA OCORRÊNCIA</span><strong>Preencha em duas etapas</strong></div><span className="nex-counter">{String(etapa + 1).padStart(2, "0")} <span>/ {String(ETAPAS.length).padStart(2, "0")}</span></span></div>
        <div className="nex-progress" role="progressbar" aria-label="Progresso do formulário" aria-valuemin={1} aria-valuemax={ETAPAS.length} aria-valuenow={etapa + 1}><span style={{ width: `${((etapa + 1) / ETAPAS.length) * 100}%` }} /></div>
        <ol className="passos" aria-label="Etapas do relato">
          {ETAPAS.map((e, i) => (
            <li
              key={e.id}
              className={`passos__item${i === etapa ? " is-atual" : ""}${i < etapa ? " is-feito" : ""}`}
              aria-current={i === etapa ? "step" : undefined}
            >
              <span className="passos__num">{i < etapa ? "✓" : i + 1}</span>
              <span className="passos__nome">{e.titulo}</span>
            </li>
          ))}
        </ol>
        <section hidden={etapa !== 0} className="etapa">
          <h2 ref={etapa === 0 ? tituloRef : null} tabIndex={-1}>
            Onde aconteceu?
          </h2>
          <p className="etapa__apoio">
            Informe o endereço ou use o GPS.
          </p>
          <div className="nex-address-layout">
            <div className="nex-address-fields">
              <div className="nex-address-section-heading">Dados do endereço</div>
          <div className="campo">
            <label htmlFor="cep">
              CEP <span className="opcional">(opcional)</span>
            </label>
            <input
              id="cep"
              inputMode="numeric"
              maxLength={9}
              placeholder="88800-000"
              autoComplete="postal-code"
              {...register("cep", { onBlur: buscarCep })}
            />
            <small className="dica" aria-live="polite">
              {buscandoCep ? "Procurando o endereço…" : avisoCep}
            </small>
          </div>
          <div className="grade">
            <div className="campo">
              <label htmlFor="cidade">Cidade</label>
              <input
                id="cidade"
                autoComplete="address-level2"
                placeholder="Ex.: Criciúma"
                aria-invalid={!!errors.cidade}
                {...register("cidade", obrigatorio("Informe a cidade."))}
              />
              {errors.cidade && (
                <small className="erro">{errors.cidade.message}</small>
              )}
            </div>
            <div className="campo">
              <label htmlFor="bairro">Bairro</label>
              <input
                id="bairro"
                placeholder="Nome do bairro"
                aria-invalid={!!errors.bairro}
                {...register("bairro", obrigatorio("Informe o bairro."))}
              />
              {errors.bairro && (
                <small className="erro">{errors.bairro.message}</small>
              )}
            </div>
          </div>
          <div className="campo">
            <label htmlFor="rua">Rua e número (ou referência)</label>
            <input
              id="rua"
              autoComplete="street-address"
              placeholder="Rua, número ou ponto de referência"
              aria-invalid={!!errors.rua}
              {...register(
                "rua",
                obrigatorio("Informe a rua ou uma referência."),
              )}
            />
            {errors.rua && <small className="erro">{errors.rua.message}</small>}
          </div>
            </div>
            <div className="local nex-address-map-panel">
              <div className="nex-local-header">
                <div><h3>Localização no mapa</h3><p>Confirme o ponto da ocorrência.</p></div>
                <span className={`nex-local-status ${coords ? "is-ready" : ""}`}>
                  {buscandoEndereco ? "Buscando…" : coords ? "Localizado" : "Não localizado"}
                </span>
              </div>
              <div className="nex-local-actions">
                <button type="button" className="botao botao--contorno" onClick={localizarEndereco} disabled={buscandoEndereco}>
                  {buscandoEndereco ? "Buscando…" : "Buscar endereço"}
                </button>
                <button type="button" className="botao botao--suave" onClick={marcarMinhaPosicao}>
                  Usar GPS
                </button>
              </div>
              <button type="button" className="botao botao--suave nex-map-toggle" onClick={() => setMostrarMapaEscolha((v) => !v)}>
                {mostrarMapaEscolha ? "Ocultar mapa" : "Selecionar ponto no mapa"}
              </button>
              {mostrarMapaEscolha && (
                <div className="nex-local-map">
                  <SelecionarPontoMapa ponto={coords} onSelect={(ponto) => {
                    setCoords(ponto);
                    setEnderecoConfirmado("Ponto escolhido manualmente no mapa");
                    setMsgLocal("Ponto marcado. Confira se está no local correto.");
                    setErroEnvio("");
                  }} />
                </div>
              )}
              {!mostrarMapaEscolha && (
                <div className="nex-map-placeholder">
                  <span aria-hidden="true">⌖</span>
                  <strong>{coords ? "Ponto encontrado" : "Mapa disponível"}</strong>
                  <small>{coords ? "Abra o mapa para ajustar o marcador." : "Informe o endereço ou utilize o GPS."}</small>
                </div>
              )}
              <small className={`dica${coords ? " dica--ok" : ""}`} aria-live="polite">{msgLocal}</small>
            </div>
          </div>
          {coords && (
            <div className="endereco-confirmado nex-address-confirmation">
              <div><strong>Endereço selecionado</strong><span>{enderecoConfirmado}</span></div>
              <small>Confira a posição do marcador antes de continuar.</small>
            </div>
          )}
        </section>
        <section hidden={etapa !== 1} className="etapa">
          <h2 ref={etapa === 1 ? tituloRef : null} tabIndex={-1}>
            O que aconteceu?
          </h2>
          <p className="etapa__apoio">
            Descreva o problema para a equipe.
          </p>
          <div className="campo">
            <label htmlFor="categoria">Que tipo de problema é?</label>
            <select
              id="categoria"
              aria-invalid={!!errors.categoria}
              {...register("categoria", { required: "Escolha uma categoria." })}
            >
              <option value="">Escolha uma opção</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.categoria && (
              <small className="erro">{errors.categoria.message}</small>
            )}
          </div>
          <div className="campo">
            <label htmlFor="descricao">Descreva a situação</label>
            <textarea
              id="descricao"
              rows={5}
              maxLength={MAX_DESCRICAO}
              placeholder="Ex.: O cano estourou há três dias e a água corre pela calçada…"
              aria-invalid={!!errors.descricao}
              {...register("descricao", {
                validate: (v) => {
                  const n = (v ?? "").trim().length;
                  if (!n) return "Conte o que está acontecendo.";
                  if (n < MIN_DESCRICAO)
                    return "Escreva pelo menos 10 caracteres.";
                  return true;
                },
              })}
            />
            <div className="campo__rodape">
              {errors.descricao ? (
                <small className="erro">{errors.descricao.message}</small>
              ) : (
                <span />
              )}
              <small className="dica">
                {descricao.length}/{MAX_DESCRICAO}
              </small>
            </div>
          </div>
          <fieldset className="gravidade">
            <legend>Qual a urgência?</legend>
            <div className="gravidade__lista">
              {GRAVIDADES.map((g) => (
                <label key={g.value} className="gravidade__cartao">
                  <input
                    type="radio"
                    value={g.value}
                    {...register("gravidade", { required: true })}
                  />
                  <span className="gravidade__corpo">
                    <span
                      className={`barras nivel-${g.nivel}`}
                      aria-hidden="true"
                    >
                      <i />
                      <i />
                      <i />
                    </span>
                    <strong>{g.titulo}</strong>
                    <small>{g.desc}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <details className="nex-identificacao-extra">
            <summary>Identificação (opcional)</summary>
          <div className="campo">
            <label htmlFor="nome">
              Como podemos te chamar?{" "}
              <span className="opcional">(opcional)</span>
            </label>
            <input
              id="nome"
              autoComplete="name"
              placeholder="Seu nome ou apelido"
              disabled={anonimo}
              aria-invalid={!!errors.nome}
              {...register("nome", {
                validate: (v) => anonimo || !(v ?? "").trim() || true,
              })}
            />
          </div>
          <label className="opcao-anonima">
            <input type="checkbox" {...register("anonimo")} />
            <span>
              <strong>Prefiro não me identificar</strong>
              <small>Seu nome não será enviado com o relato.</small>
            </span>
          </label>
          </details>
          <p className="nota-envio">
            Ao enviar, o relato será registrado para análise da equipe.
          </p>
        </section>
        {erroEnvio && (
          <p className="alerta" role="alert">
            {erroEnvio}
          </p>
        )}
        <div className="navegacao">
          {etapa > 0 ? (
            <button
              type="button"
              className="botao botao--suave"
              onClick={() => setEtapa((e) => e - 1)}
            >
              Voltar
            </button>
          ) : (
            <span />
          )}
          {etapa < ULTIMA ? (
            <button
              key="continuar"
              type="submit"
              className="botao botao--primario"
            >
              Continuar
            </button>
          ) : (
            <button
              key="enviar"
              type="submit"
              className="botao botao--primario"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Enviando…" : "Enviar meu relato"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
export default Denuncia;
