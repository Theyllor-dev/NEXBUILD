
import { useEffect, useMemo, useState } from "react";
import { buscarPontosMapa } from "../../dados";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import MapaDenuncias from "../../components/MapaDenuncias";
import "./Mapa.css";

function Mapa() {
  const [ocorrenciasDemo, setOcorrenciasDemo] = useState([]);
  const [erroMapa, setErroMapa] = useState("");

  useEffect(() => {
    let ativo = true;
    let emAndamento = false;
    const atualizar = async () => {
      if (emAndamento || document.hidden) return;
      emAndamento = true;
      try {
        const pontos = await buscarPontosMapa();
        if (ativo) {
          setOcorrenciasDemo(pontos);
          setErroMapa("");
          setSelecionada((id) => id != null && !pontos.some((p) => p.id === id) ? null : id);
        }
      } catch (erro) {
        if (ativo) setErroMapa("Não foi possível atualizar as ocorrências no mapa.");
      } finally {
        emAndamento = false;
      }
    };
    const aoVisivel = () => { if (!document.hidden) atualizar(); };
    const aoFoco = () => atualizar();
    const aoAlterar = () => atualizar();
    atualizar();
    const intervalo = window.setInterval(atualizar, 15000);
    window.addEventListener("focus", aoFoco);
    document.addEventListener("visibilitychange", aoVisivel);
    window.addEventListener("nexbuild:ocorrencias-alteradas", aoAlterar);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.removeEventListener("focus", aoFoco);
      document.removeEventListener("visibilitychange", aoVisivel);
      window.removeEventListener("nexbuild:ocorrencias-alteradas", aoAlterar);
    };
  }, []);

  const [gravidade, setGravidade] = useState("Todas");
  const [status, setStatus] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState(null);

  const [origemRota, setOrigemRota] = useState(null);
  const [rota, setRota] = useState(null);
  const [carregandoRota, setCarregandoRota] = useState(false);
  const [mensagemRota, setMensagemRota] = useState("");

  const ocorrenciasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return ocorrenciasDemo.filter((ocorrencia) => {
      const correspondeBusca = [
        ocorrencia.titulo,
        ocorrencia.categoria,
        ocorrencia.endereco,
        ocorrencia.descricao,
      ].some((campo) =>
        String(campo ?? "").toLowerCase().includes(termo)
      );

      const correspondeGravidade =
        gravidade === "Todas" ||
        ocorrencia.gravidade === gravidade;

      const correspondeStatus =
        status === "Todos" ||
        ocorrencia.status === status;

      return (
        correspondeBusca &&
        correspondeGravidade &&
        correspondeStatus
      );
    });
  }, [busca, gravidade, status, ocorrenciasDemo]);

  const ocorrenciaSelecionada = ocorrenciasFiltradas.find(
    (item) => item.id === selecionada
  );

  const semCoordenadas = ocorrenciasFiltradas.filter((o) => !Array.isArray(o.posicao)).length;

  const total = ocorrenciasDemo.length;

  const alta = ocorrenciasDemo.filter(
    (item) => item.gravidade === "Alta"
  ).length;

  const atendimento = ocorrenciasDemo.filter(
    (item) => item.status === "Em atendimento"
  ).length;

  const resolvidas = ocorrenciasDemo.filter(
    (item) => item.status === "Resolvida"
  ).length;

  function limparRota() {
    setOrigemRota(null);
    setRota(null);
    setMensagemRota("");
  }

  function mudarGravidade(valor) {
    setGravidade(valor);
    setSelecionada(null);
    limparRota();
  }

  function mudarStatus(valor) {
    setStatus(valor);
    setSelecionada(null);
    limparRota();
  }

  function selecionarOcorrencia(id) {
    const novaSelecao = selecionada === id ? null : id;

    setSelecionada(novaSelecao);
    limparRota();
  }

  async function tracarRota() {
    if (!ocorrenciaSelecionada?.posicao) {
      setMensagemRota("Selecione uma ocorrência válida.");
      return;
    }

    if (!navigator.geolocation) {
      setMensagemRota(
        "Seu navegador não oferece suporte à localização."
      );
      return;
    }

    setCarregandoRota(true);
    setOrigemRota(null);
    setRota(null);
    setMensagemRota("Obtendo sua localização...");

    navigator.geolocation.getCurrentPosition(
      async (posicaoAtual) => {
        const origem = [
          posicaoAtual.coords.latitude,
          posicaoAtual.coords.longitude,
        ];

        setOrigemRota(origem);
        setMensagemRota("Calculando o trajeto...");

        try {
          const [latitude, longitude] =
            ocorrenciaSelecionada.posicao;

          const url =
            "https://router.project-osrm.org/route/v1/driving/" +
            `${origem[1]},${origem[0]};` +
            `${longitude},${latitude}` +
            "?overview=full&geometries=geojson";

          const resposta = await fetch(url);

          if (!resposta.ok) {
            throw new Error(
              "Falha ao consultar o serviço de rotas."
            );
          }

          const dados = await resposta.json();

          if (dados.code !== "Ok" || !dados.routes?.length) {
            throw new Error("Não foi encontrada uma rota.");
          }

          const trajeto = dados.routes[0];

          setRota({
            coordenadas: trajeto.geometry.coordinates.map(
              ([lon, lat]) => [lat, lon]
            ),
            distancia: trajeto.distance,
            duracao: trajeto.duration,
          });

          setMensagemRota("Rota calculada com sucesso!");
        } catch (erro) {
          setMensagemRota(
            erro.message || "Erro ao calcular a rota."
          );
        } finally {
          setCarregandoRota(false);
        }
      },
      (erro) => {
        setCarregandoRota(false);

        if (erro.code === 1) {
          setMensagemRota(
            "Permita o acesso à localização no navegador."
          );
        } else if (erro.code === 3) {
          setMensagemRota(
            "A localização demorou demais. Tente novamente."
          );
        } else {
          setMensagemRota(
            "Não foi possível obter sua localização."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  function abrirNoGoogleMaps() {
    if (!ocorrenciaSelecionada?.posicao) {
      setMensagemRota(
        "Selecione uma ocorrência primeiro."
      );
      return;
    }

    const [latitude, longitude] =
      ocorrenciaSelecionada.posicao;

    const url =
      `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="admin">
      <Sidebar />

      <main className="admin-content">
        <Header />

        <section className="pagina-mapa">

          <div className="mapa-cabecalho">
            <div>
              <span className="mapa-etiqueta">
                MONITORAMENTO URBANO
              </span>

              <h1>Mapa de ocorrências</h1>

              <p>
                Acompanhe os registros e localize os atendimentos.
              </p>
            </div>

            <span className="mapa-status">
              <span className="status-ponto" />
              Central de ocorrências
            </span>
          </div>

          <div className="mapa-indicadores">

            <div className="mapa-indicador">
              <div className="indicador-topo">
                <span>Total de ocorrências</span>
                <span className="indicador-icone roxo">◎</span>
              </div>
              <strong>{total}</strong>
              <small>Registros cadastrados</small>
            </div>

            <div className="mapa-indicador">
              <div className="indicador-topo">
                <span>Alta gravidade</span>
                <span className="indicador-icone vermelho">!</span>
              </div>
              <strong>{alta}</strong>
              <small>Precisam de atenção</small>
            </div>

            <div className="mapa-indicador">
              <div className="indicador-topo">
                <span>Em atendimento</span>
                <span className="indicador-icone azul">↗</span>
              </div>
              <strong>{atendimento}</strong>
              <small>Em processo de resolução</small>
            </div>



          </div>

          {erroMapa && (
            <p role="alert" className="mapa-aviso">
              {erroMapa}
            </p>
          )}

          <div className="mapa-layout">

            <div className="mapa-painel-principal">
              <div className="mapa-painel-cabecalho">
                <div>
                  <h3>Mapa de ocorrências</h3>
                  <p>Distribuição geográfica dos registros</p>
                </div>

                <span className="mapa-contador">
                  {ocorrenciasFiltradas.length} ocorrência(s)
                </span>
              </div>

              {semCoordenadas > 0 && (
                <p role="status" className="mapa-aviso">
                  {semCoordenadas} ocorrência(s) sem latitude/longitude no MySQL: aparecem na lista, mas não podem ser marcadas no mapa.
                </p>
              )}

              <div className="mapa-conteudo">
                <MapaDenuncias
                  ocorrencias={ocorrenciasFiltradas}
                  ocorrenciaSelecionada={selecionada}
                  aoSelecionarOcorrencia={selecionarOcorrencia}
                  habilitarRotas={false}
                  origemRota={origemRota}
                  coordenadasRota={rota?.coordenadas ?? null}
                />
                {ocorrenciaSelecionada && (
                  <div className="mapa-detalhe-flutuante" role="region" aria-label="Ocorrência selecionada">
                    <div className="mapa-detalhe-topo">
                      <span className="mapa-detalhe-tag">OCORRÊNCIA #{ocorrenciaSelecionada.id}</span>
                      <button type="button" className="mapa-detalhe-fechar" aria-label="Fechar detalhes" onClick={() => selecionarOcorrencia(ocorrenciaSelecionada.id)}>×</button>
                    </div>
                    <h4>{ocorrenciaSelecionada.titulo}</h4>
                    <p>{ocorrenciaSelecionada.endereco || "Endereço não informado"}</p>
                    <div className="mapa-detalhe-chips">
                      <span>{ocorrenciaSelecionada.status}</span>
                      <span>{ocorrenciaSelecionada.gravidade} gravidade</span>
                      <span>{ocorrenciaSelecionada.categoria}</span>
                    </div>
                    <button type="button" className="mapa-detalhe-acao" onClick={abrirNoGoogleMaps} disabled={!ocorrenciaSelecionada.posicao}>Ver trajeto ↗</button>
                  </div>
                )}

              </div>

              <div className="mapa-legenda">
                <span>
                  <i className="legenda-ponto ponto-alta" />
                  Alta gravidade
                </span>

                <span>
                  <i className="legenda-ponto ponto-media" />
                  Média gravidade
                </span>

                <span>
                  <i className="legenda-ponto ponto-baixa" />
                  Baixa gravidade
                </span>
              </div>

              <details className="mapa-rota-expansivel">
                <summary>Traçar rota até uma ocorrência <span>Expandir ▾</span></summary>
                <section className="painel-rota">

                  <div className="painel-rota-cabecalho">
                    <div>
                      <span className="painel-rota-etiqueta">
                        NAVEGAÇÃO
                      </span>

                      <h3>Traçar rota</h3>

                      <p>
                        Encontre o caminho até o local da ocorrência.
                      </p>
                    </div>

                    <span
                      className={`painel-rota-status ${carregandoRota
                          ? "is-carregando"
                          : rota
                            ? "is-concluida"
                            : ""
                        }`}
                    >
                      <span className="painel-rota-status-ponto" />

                      {carregandoRota
                        ? "Calculando"
                        : rota
                          ? "Rota calculada"
                          : "Aguardando"}
                    </span>
                  </div>

                  <div className="painel-rota-locais">

                    <div className="painel-rota-local">
                      <span className="painel-rota-icone origem">
                        <span />
                      </span>

                      <div>
                        <small>ORIGEM</small>
                        <strong>Minha localização</strong>
                      </div>
                    </div>

                    <div className="painel-rota-conector" />

                    <div className="painel-rota-local">
                      <span className="painel-rota-icone destino">
                        <span />
                      </span>

                      <div>
                        <small>DESTINO</small>

                        <strong>
                          {ocorrenciaSelecionada
                            ? ocorrenciaSelecionada.titulo
                            : "Selecione uma ocorrência"}
                        </strong>

                        {ocorrenciaSelecionada?.endereco && (
                          <span>
                            {ocorrenciaSelecionada.endereco}
                          </span>
                        )}
                      </div>
                    </div>

                  </div>

                  <div className="painel-rota-acoes">

                    <button
                      type="button"
                      className="painel-rota-botao"
                      onClick={tracarRota}
                      disabled={
                        carregandoRota ||
                        !ocorrenciaSelecionada?.posicao
                      }
                    >
                      {carregandoRota
                        ? "Calculando rota..."
                        : rota
                          ? "Atualizar rota"
                          : "Calcular rota"}
                    </button>

                    {rota && (
                      <button
                        type="button"
                        className="painel-rota-limpar"
                        onClick={limparRota}
                      >
                        Limpar rota
                      </button>
                    )}

                    <button
                      type="button"
                      className="painel-rota-botao"
                      onClick={abrirNoGoogleMaps}
                      disabled={!ocorrenciaSelecionada?.posicao}
                    >
                      Como chegar
                    </button>

                  </div>

                  {rota && (
                    <div className="painel-rota-metricas">

                      <div className="painel-rota-metrica">
                        <span>Distância</span>

                        <strong>
                          {(rota.distancia / 1000).toLocaleString(
                            "pt-BR",
                            { maximumFractionDigits: 1 }
                          )} km
                        </strong>
                      </div>

                      <div className="painel-rota-divisor" />

                      <div className="painel-rota-metrica">
                        <span>Tempo estimado</span>

                        <strong>
                          {Math.round(rota.duracao / 60)} min
                        </strong>
                      </div>

                      <div className="painel-rota-divisor" />

                      <div className="painel-rota-metrica">
                        <span>Modalidade</span>
                        <strong>Carro</strong>
                      </div>

                    </div>
                  )}

                  {mensagemRota && (
                    <p
                      className={`painel-rota-mensagem ${rota ? "sucesso" : ""
                        }`}
                      role="status"
                    >
                      {mensagemRota}
                    </p>
                  )}

                  {!ocorrenciaSelecionada && (
                    <p className="painel-rota-ajuda">
                      Selecione uma ocorrência na lista ou diretamente
                      no mapa para definir o destino.
                    </p>
                  )}

                </section>
              </details>
            </div>

            <aside className="mapa-lista-painel">

              <div className="mapa-lista-cabecalho">
                <div>
                  <h3>Ocorrências recentes</h3>

                  <p>
                    {ocorrenciasFiltradas.length} registro(s)
                    encontrado(s)
                  </p>
                </div>

                <span className="mapa-lista-icone">≡</span>
              </div>

              {ocorrenciasFiltradas.length === 0 ? (
                <p className="mapa-aviso">
                  Nenhuma ocorrência encontrada com esses filtros.
                </p>
              ) : (
                ocorrenciasFiltradas.map((ocorrencia) => (
                  <button
                    type="button"
                    key={ocorrencia.id}
                    className={`mapa-ocorrencia ${selecionada === ocorrencia.id
                        ? "selecionada"
                        : ""
                      }`}
                    onClick={() =>
                      selecionarOcorrencia(ocorrencia.id)
                    }
                    aria-pressed={selecionada === ocorrencia.id}
                  >
                    <div className="ocorrencia-linha">
                      <span className="ocorrencia-categoria">
                        {ocorrencia.categoria}
                      </span>

                      <span
                        className={`ocorrencia-gravidade ${String(ocorrencia.gravidade).toLowerCase()}`}
                      >
                        {ocorrencia.gravidade}
                      </span>
                    </div>

                    <h4>{ocorrencia.titulo}</h4>
                    <p>{ocorrencia.endereco}</p>

                    <div className="ocorrencia-rodape">
                      <span>● {ocorrencia.status}</span>
                      <span>#{ocorrencia.id}</span>
                    </div>

                    {selecionada === ocorrencia.id && (
                      <p className="ocorrencia-descricao">
                        {ocorrencia.descricao}
                      </p>
                    )}
                  </button>
                ))
              )}

              <p className="mapa-aviso">
                Dados consultados pela API conectada ao MySQL.
              </p>

            </aside>
          </div>

          <div className="mapa-rodape">
            <span>Central de monitoramento urbano</span>
            <span>Dados atualizados da API</span>
          </div>

        </section>
      </main>
    </div>
  );
}

export default Mapa;
