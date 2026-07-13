import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const PONTOS_MAX_POR_ENVIO = 600;
const TAMANHO_MAX_FOTO = 200000;

function normalizarNome(nome) {
  return typeof nome === 'string' ? nome.trim().slice(0, 30).toLowerCase() : '';
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const verificar = req.query?.verificar;

    if (verificar) {
      const nomeNormalizado = normalizarNome(verificar);

      if (!nomeNormalizado) {
        return res.status(200).json(null);
      }

      const [jogador] = await sql`
        SELECT jogador_id, nome, pontos, foto
        FROM ranking
        WHERE nome_normalizado = ${nomeNormalizado}
        ORDER BY pontos DESC
        LIMIT 1
      `;

      return res.status(200).json(jogador ?? null);
    }

    const ranking = await sql`
      SELECT jogador_id, nome, pontos, foto
      FROM ranking
      ORDER BY pontos DESC, atualizado_em ASC
      LIMIT 20
    `;
    return res.status(200).json(ranking);
  }

  if (req.method === 'POST') {
    const { jogador_id: jogadorId, nome, pontos, foto } = req.body ?? {};

    const nomeLimpo = typeof nome === 'string' ? nome.trim().slice(0, 30) : '';
    const pontosNum = Number(pontos);
    const nomeNormalizado = normalizarNome(nomeLimpo);
    const fotoLimpa =
      typeof foto === 'string' && foto.startsWith('data:image/') && foto.length <= TAMANHO_MAX_FOTO
        ? foto
        : null;

    if (!nomeLimpo) {
      return res.status(400).json({ erro: 'Nome inválido.' });
    }

    if (!Number.isInteger(pontosNum) || pontosNum < 1 || pontosNum > PONTOS_MAX_POR_ENVIO) {
      return res.status(400).json({ erro: 'Pontuação inválida.' });
    }

    const idValido =
      typeof jogadorId === 'string' && /^[0-9a-f-]{36}$/i.test(jogadorId) ? jogadorId : null;

    if (idValido) {
      const atualizados = await sql`
        UPDATE ranking
        SET pontos = pontos + ${pontosNum},
            nome = ${nomeLimpo},
            nome_normalizado = ${nomeNormalizado},
            foto = COALESCE(${fotoLimpa}, foto),
            atualizado_em = now()
        WHERE jogador_id = ${idValido}
        RETURNING jogador_id
      `;

      if (atualizados.length > 0) {
        return res.status(200).json({ ok: true, jogador_id: idValido });
      }

      await sql`
        INSERT INTO ranking (jogador_id, nome, nome_normalizado, pontos, foto)
        VALUES (${idValido}, ${nomeLimpo}, ${nomeNormalizado}, ${pontosNum}, ${fotoLimpa})
      `;
      return res.status(200).json({ ok: true, jogador_id: idValido });
    }

    const [novo] = await sql`
      INSERT INTO ranking (nome, nome_normalizado, pontos, foto)
      VALUES (${nomeLimpo}, ${nomeNormalizado}, ${pontosNum}, ${fotoLimpa})
      RETURNING jogador_id
    `;
    return res.status(200).json({ ok: true, jogador_id: novo.jogador_id });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ erro: 'Método não permitido.' });
}
