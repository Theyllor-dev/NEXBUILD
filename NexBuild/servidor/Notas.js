import { db } from "./db.js";

// A tabela notas deve ter id_nota, id_usuario, titulo, conteudo e tipo.
export async function listarNotasDoUsuario(idUsuario) {
  const id = Number(idUsuario);
  if (!Number.isInteger(id) || id <= 0) throw new Error("ID de usuário inválido.");
  const [linhas] = await db.execute(
    `SELECT * FROM notas WHERE id_usuario = ? ORDER BY id_nota DESC`, [id]
  );
  return linhas;
}

export async function criarNota({ id_usuario, titulo, conteudo, tipo = "Geral" }) {
  const [resultado] = await db.execute(
    `INSERT INTO notas (id_usuario, titulo, conteudo, tipo) VALUES (?, ?, ?, ?)`,
    [Number(id_usuario), titulo, conteudo, tipo || "Geral"]
  );
  return { id_nota: resultado.insertId };
}

export async function excluirNota(idNota, idUsuario) {
  const id = Number(idNota);
  const usuario = Number(idUsuario);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(usuario) || usuario <= 0) {
    throw new Error("IDs de nota ou usuário inválidos.");
  }
  const [resultado] = await db.execute(
    `DELETE FROM notas WHERE id_nota = ? AND id_usuario = ?`, [id, usuario]
  );
  return resultado.affectedRows > 0;
}
