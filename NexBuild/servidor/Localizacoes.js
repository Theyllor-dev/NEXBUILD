import { db } from "./db.js";

function normalizarCoordenadas(latitude, longitude) {
  const vazia = (v) => v === null || v === undefined || v === "";
  if (vazia(latitude) && vazia(longitude)) return [null, null];
  if (vazia(latitude) || vazia(longitude)) {
    throw new Error("Informe latitude e longitude juntas.");
  }
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
    lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error("Coordenadas geográficas inválidas.");
  }
  return [lat, lon];
}

export async function listarLocalizacoes() {
  const [localizacoes] = await db.execute("SELECT * FROM localizacoes");
  return localizacoes;
}

export async function buscarLocalizacao(idOcorrencia) {
  const [localizacoes] = await db.execute(
    "SELECT * FROM localizacoes WHERE id_ocorrencia = ?",
    [idOcorrencia],
  );
  return localizacoes[0] || null;
}

export async function criarLocalizacao(dados) {
  const [latitude, longitude] = normalizarCoordenadas(
    dados.latitude,
    dados.longitude,
  );
  const [resultado] = await db.execute(
    `INSERT INTO localizacoes
       (id_ocorrencia, endereco, bairro, cidade, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      dados.id_ocorrencia,
      dados.endereco,
      dados.bairro,
      dados.cidade,
      latitude,
      longitude,
    ],
  );
  return { id_localizacao: resultado.insertId };
}
