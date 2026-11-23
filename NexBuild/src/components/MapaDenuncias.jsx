
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { buscarPontosMapa } from "../dados";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "./MapaDenuncias.css";

function criarIconeDenuncia(gravidade) {
  const nivel = String(gravidade || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const cores = {
    baixa: "#22c55e",
    media: "#eab308",
    alta: "#f97316",
    critica: "#ef4444",
  };

  const cor = cores[nivel] || "#64748b";

  return L.divIcon({
    className: "icone-denuncia",
    html: `
      <div class="ponto-radar" style="--cor-gravidade: ${cor}">
        <div class="onda onda-1"></div>
        <div class="onda onda-2"></div>
        <div class="onda onda-3"></div>
        <div class="ponto-central"></div>
      </div>
    `,
    iconSize: [80, 80],
    iconAnchor: [40, 40],
  });
}

function AjustarMapa({ pontos }) {
  const mapa = useMap();

  useEffect(() => {
    if (pontos.length > 0) {
      mapa.fitBounds(L.latLngBounds(pontos), {
        padding: [40, 40],
        maxZoom: 15,
      });
    }
  }, [mapa, pontos]);

  useEffect(() => {
    const atualizar = () => mapa.invalidateSize();

    const temporizador = setTimeout(atualizar, 200);
    window.addEventListener("resize", atualizar);

    return () => {
      clearTimeout(temporizador);
      window.removeEventListener("resize", atualizar);
    };
  }, [mapa]);

  return null;
}

function MapaDenuncias({
  ocorrencias,
  ocorrenciaSelecionada = null,
  aoSelecionarOcorrencia,
  habilitarRotas = true,
  origemRota = null,
  coordenadasRota = null,
}) {

  // No Dashboard (Admin.jsx), a lista não é passada: carregamos da API.
  // Na página Mapa.jsx, respeitamos a lista recebida e seus filtros.
  const modoAutonomo = ocorrencias === undefined;
  const [pontosAPI, setPontosAPI] = useState([]);
  const [erroAPI, setErroAPI] = useState("");
  const [carregandoAPI, setCarregandoAPI] = useState(modoAutonomo);

  useEffect(() => {
    if (!modoAutonomo) return;
    let ativo = true;
    let emAndamento = false;
    const atualizar = async () => {
      if (emAndamento || document.hidden) return;
      emAndamento = true;
      try {
        const pontos = await buscarPontosMapa();
        if (ativo) {
          setPontosAPI(pontos);
          setErroAPI("");
        }
      } catch (erro) {
        if (ativo) setErroAPI(erro?.message || "Não foi possível carregar as denúncias.");
      } finally {
        emAndamento = false;
        if (ativo) setCarregandoAPI(false);
      }
    };
    const aoVisivel = () => { if (!document.hidden) atualizar(); };
    atualizar();
    const intervalo = window.setInterval(atualizar, 15000);
    window.addEventListener("focus", atualizar);
    window.addEventListener("nexbuild:ocorrencias-alteradas", atualizar);
    document.addEventListener("visibilitychange", aoVisivel);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.removeEventListener("focus", atualizar);
      window.removeEventListener("nexbuild:ocorrencias-alteradas", atualizar);
      document.removeEventListener("visibilitychange", aoVisivel);
    };
  }, [modoAutonomo]);

  const dadosMapa = modoAutonomo ? pontosAPI : ocorrencias;
  const listaOcorrencias = useMemo(() =>
    (Array.isArray(dadosMapa) ? dadosMapa : []).filter((item) => {
      const p = item?.posicao;
      return Array.isArray(p) && p.length === 2 &&
        p.every((v) => v !== null && v !== "" && Number.isFinite(Number(v))) &&
        Math.abs(Number(p[0])) <= 90 && Math.abs(Number(p[1])) <= 180;
    }), [dadosMapa]);

  const [origem, setOrigem] = useState(null);
  const [rota, setRota] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

 

  const selecionada = listaOcorrencias.find(
    (item) => String(item.id) === String(ocorrenciaSelecionada)
  );

  async function tracarRota() {
    if (!selecionada?.posicao) {
      setMensagem("Selecione uma ocorrência com coordenadas válidas.");
      return;
    }

    if (!navigator.geolocation) {
      setMensagem("Seu navegador não oferece geolocalização.");
      return;
    }

    setCarregando(true);
    setMensagem("");
    setRota(null);

    navigator.geolocation.getCurrentPosition(
      async (posicaoAtual) => {
        const pontoOrigem = [
          posicaoAtual.coords.latitude,
          posicaoAtual.coords.longitude,
        ];

        setOrigem(pontoOrigem);

        try {
          const [latDestino, lonDestino] = selecionada.posicao;

          const url =
            "https://router.project-osrm.org/route/v1/driving/" +
            `${pontoOrigem[1]},${pontoOrigem[0]};` +
            `${lonDestino},${latDestino}` +
            "?overview=full&geometries=geojson";

          const resposta = await fetch(url);

          if (!resposta.ok) {
            throw new Error("Não foi possível consultar o serviço de rotas.");
          }

          const dados = await resposta.json();

          if (dados.code !== "Ok" || !dados.routes?.length) {
            throw new Error("Não foi encontrada uma rota para esse destino.");
          }

          const trajeto = dados.routes[0];

          setRota({
            coordenadas: trajeto.geometry.coordinates.map(
              ([longitude, latitude]) => [latitude, longitude]
            ),
            distancia: trajeto.distance,
            duracao: trajeto.duration,
          });

          setMensagem("Rota calculada com sucesso!");
        } catch (erro) {
          setMensagem(
            erro.message || "Erro ao calcular a rota. Tente novamente."
          );
        } finally {
          setCarregando(false);
        }
      },
      (erro) => {
        setCarregando(false);

        if (erro.code === 1) {
          setMensagem("Permita o acesso à localização para traçar a rota.");
        } else if (erro.code === 3) {
          setMensagem("A localização demorou demais. Tente novamente.");
        } else {
          setMensagem("Não foi possível obter sua localização.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  const pontosParaEnquadrar = useMemo(() => {
    if (Array.isArray(coordenadasRota) && coordenadasRota.length) return coordenadasRota;
    if (rota) return rota.coordenadas;

    if (origemRota && selecionada?.posicao) return [origemRota, selecionada.posicao];
    if (origem && selecionada?.posicao) {
      return [origem, selecionada.posicao];
    }

    if (selecionada?.posicao) return [selecionada.posicao];
    return listaOcorrencias.map((item) => item.posicao);
  }, [rota, origem, origemRota, coordenadasRota, selecionada, listaOcorrencias]);

  return (
    <section className="mapa-denuncias">
      {modoAutonomo && carregandoAPI && <p role="status">Carregando ocorrências do banco...</p>}
      {modoAutonomo && erroAPI && <p role="alert">Erro ao buscar denúncias: {erroAPI}</p>}
      {modoAutonomo && !carregandoAPI && !erroAPI && (
        <p role="status" style={{ fontSize: 12, marginBottom: 8 }}>
          {listaOcorrencias.length} denúncia(s) com localização no mapa.
          {Array.isArray(dadosMapa) && dadosMapa.length > listaOcorrencias.length
            ? ` ${dadosMapa.length - listaOcorrencias.length} sem coordenadas válidas.` : ""}
        </p>
      )}
      {habilitarRotas && (
        <div className="controles-rota">
          <button
            type="button"
            onClick={tracarRota}
            disabled={carregando || !selecionada?.posicao}
          >
            {carregando ? "Calculando rota..." : "Traçar rota até a denúncia"}
          </button>

          {rota && (
            <button
              type="button"
              onClick={() => {
                setRota(null);
                setOrigem(null);
                setMensagem("");
              }}
            >
              Limpar rota
            </button>
          )}

          {mensagem && <p role="status">{mensagem}</p>}

          {rota && (
            <p>
              Distância: {(rota.distancia / 1000).toFixed(1)} km
              {" · "}
              Tempo estimado: {Math.round(rota.duracao / 60)} min
            </p>
          )}
        </div>
      )}

      <div className="mapa-area">
        <MapContainer
          center={[-28.6775, -49.3697]}
          zoom={13}
          className="mapa"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />

          <AjustarMapa pontos={pontosParaEnquadrar} />

          {origemRota && (
            <Marker position={origemRota}><Popup>Origem da rota</Popup></Marker>
          )}
          {origem && habilitarRotas && (
            <Marker position={origem}>
              <Popup>Sua localização atual</Popup>
            </Marker>
          )}

          {listaOcorrencias.map((item) => (
              <Marker
                key={item.id}
                position={item.posicao}
                icon={criarIconeDenuncia(item.gravidade)}
                eventHandlers={{
                  click: () => aoSelecionarOcorrencia?.(item.id),
                }}
              >
                <Popup>
                  <strong>Denúncia #{item.id}</strong>
                  <br />
                  {item.titulo}
                  <br />
                  Gravidade: {item.gravidade}
                  <br />
                  Status: {item.status}
                  <br />
                  {item.endereco}
                  {habilitarRotas && (
                    <>
                      <br />
                      <button
                        type="button"
                        onClick={() => aoSelecionarOcorrencia?.(item.id)}
                      >
                        Selecionar ocorrência
                      </button>
                    </>
                  )}
                </Popup>
              </Marker>
            ))}

          {Array.isArray(coordenadasRota) && coordenadasRota.length > 1 && (
            <Polyline positions={coordenadasRota} pathOptions={{ color: "#8b5cf6", weight: 6, opacity: 0.9 }} />
          )}
          {rota && habilitarRotas && (
            <Polyline
              positions={rota.coordenadas}
              pathOptions={{
                color: "#8b5cf6",
                weight: 6,
                opacity: 0.9,
              }}
            />
          )}
        </MapContainer>
      </div>
    </section>
  );
}

export default MapaDenuncias;