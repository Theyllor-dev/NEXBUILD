
import { db } from "./db.js";

export async function listarOcorrencias() {
    const [ocorrencias] = await db.execute(
        `SELECT
            o.*,
            u.nome AS usuario_nome,
            c.nome AS categoria_nome,
            l.endereco AS rua,
            l.bairro AS bairro,
            l.cidade AS cidade,
            l.latitude AS latitude,
            l.longitude AS longitude
        FROM ocorrencias o
        LEFT JOIN usuarios u
            ON o.id_usuario = u.id_usuario
        LEFT JOIN categorias c
            ON o.id_categoria = c.id_categoria
        LEFT JOIN localizacoes l
            ON o.id_ocorrencia = l.id_ocorrencia
        ORDER BY o.data_registro DESC`
    );

    return ocorrencias;
}

export async function buscarOcorrenciaPorId(id) {
    const [ocorrencias] = await db.execute(
        `SELECT
            o.*,
            u.nome AS usuario_nome,
            c.nome AS categoria_nome,
            l.endereco AS rua,
            l.bairro AS bairro,
            l.cidade AS cidade,
            l.latitude AS latitude,
            l.longitude AS longitude
        FROM ocorrencias o
        LEFT JOIN usuarios u
            ON o.id_usuario = u.id_usuario
        LEFT JOIN categorias c
            ON o.id_categoria = c.id_categoria
        LEFT JOIN localizacoes l
            ON o.id_ocorrencia = l.id_ocorrencia
        WHERE o.id_ocorrencia = ?`,
        [id]
    );

    return ocorrencias[0] || null;
}

export async function criarOcorrencia(dados) {
    const [resultado] = await db.execute(
        `INSERT INTO ocorrencias
        (
            id_usuario,
            id_categoria,
            titulo,
            descricao,
            prioridade,
            status,
            observacao_ia,
            prazo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            dados.id_usuario,
            dados.id_categoria,
            dados.titulo,
            dados.descricao,
            dados.prioridade,
            dados.status || "Aberta",
            dados.observacao_ia || null,
            dados.prazo || null
        ]
    );

    return {
        id_ocorrencia: resultado.insertId
    };
}

export async function atualizarOcorrencia(id, dados = {}) {
    const idOcorrencia = Number(id);
    if (!Number.isSafeInteger(idOcorrencia) || idOcorrencia <= 0) {
        throw new Error("ID da ocorrência inválido.");
    }

    const atual = await buscarOcorrenciaPorId(idOcorrencia);
    if (!atual) return null;

    // PUT parcial: campos não enviados mantêm os valores atuais.
    // mysql2.execute não permite undefined em parâmetros.
    const campos = ["titulo", "descricao", "prioridade", "status", "observacao_ia", "prazo"];
    const valores = campos.map((campo) => {
        const recebido = dados?.[campo];
        const valor = recebido === undefined ? atual[campo] : recebido;
        if (campo === "prazo" && valor === "") return null;
        return valor ?? null;
    });

    const [resultado] = await db.execute(
        `UPDATE ocorrencias
         SET titulo = ?, descricao = ?, prioridade = ?, status = ?,
             observacao_ia = ?, prazo = ?
         WHERE id_ocorrencia = ?`,
        [...valores, idOcorrencia]
    );

    return resultado;
}

export async function excluirOcorrencia(id) {
    const [resultado] = await db.execute(
        `DELETE FROM ocorrencias
         WHERE id_ocorrencia = ?`,
        [id]
    );

    return resultado;
}
