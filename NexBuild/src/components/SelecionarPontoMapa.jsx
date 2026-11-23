import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./SelecionarPontoMapa.css";

const icone = L.divIcon({
  className: "",
  html: '<div style="width:20px;height:20px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 1px 8px #333"></div>',
  iconSize: [26, 26], iconAnchor: [13, 13],
});
function CliqueMapa({ onSelect }) {
  useMapEvents({ click(e) { onSelect({ latitude: e.latlng.lat, longitude: e.latlng.lng }); } });
  return null;
}
function Centralizar({ ponto }) {
  const map = useMap();
  useEffect(() => {
    if (ponto) map.setView([ponto.latitude, ponto.longitude], Math.max(map.getZoom(), 16));
  }, [map, ponto?.latitude, ponto?.longitude]);
  return null;
}
export default function SelecionarPontoMapa({ ponto, onSelect }) {
  return (
    <section className="selecionar-ponto-mapa" aria-label="Selecionar localização no mapa">
      <p className="selecionar-ponto-mapa__instrucao">Clique no local exato do problema. Amplie o mapa para conferir a rua e o número.</p>
      <MapContainer center={[-28.6775, -49.3697]} zoom={12} scrollWheelZoom className="selecionar-ponto-mapa__mapa">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <CliqueMapa onSelect={onSelect} />
        <Centralizar ponto={ponto} />
        {ponto && <Marker position={[ponto.latitude, ponto.longitude]} icon={icone} draggable eventHandlers={{ dragend(e) { const p = e.target.getLatLng(); onSelect({ latitude: p.lat, longitude: p.lng }); } }} />}
      </MapContainer>
      <small className="selecionar-ponto-mapa__ajuda">O marcador pode ser arrastado para ajustar a posição. Não marque um ponto aproximado se não souber onde fica o problema.</small>
    </section>
  );
}
