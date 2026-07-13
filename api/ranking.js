import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const ranking = await sql`
      SELECT nome, pontos
      FROM ranking
      ORDER BY pontos DESC, atualizado_em ASC
      LIMIT 20
    `;
    return res.status(200).json(ranking);
  }

  if (req.method === 'POST') {
    const { nome, pontos } = req.body ?? {};

    const nomeLimpo = typeof nome === 'string' ? nome.trim().slice(0, 30) : '';
    const pontosNum = Number(pontos);

    if (!nomeLimpo) {
      return res.status(400).json({ erro: 'Nome inválido.' });
    }

    if (!Number.isInteger(pontosNum) || pontosNum < 1 || pontosNum > 600) {
      return res.status(400).json({ erro: 'Pontuação inválida.' });
    }

    const nomeNormalizado = nomeLimpo.toLowerCase();

    await sql`
      INSERT INTO ranking (nome, nome_normalizado, pontos)
      VALUES (${nomeLimpo}, ${nomeNormalizado}, ${pontosNum})
      ON CONFLICT (nome_normalizado)
      DO UPDATE SET
        pontos = ranking.pontos + EXCLUDED.pontos,
        nome = EXCLUDED.nome,
        atualizado_em = now()
    `;

    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ erro: 'Método não permitido.' });
}
