CREATE DATABASE projeto_integrador;

USE projeto_integrador;

CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    cargo VARCHAR(50) NOT NULL,
    setor VARCHAR(50) NOT NULL,
    perfil VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'Ativo',
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categorias (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT
);

CREATE TABLE equipes (
    id_equipe INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    especialidade VARCHAR(100) NOT NULL
);

CREATE TABLE ocorrencias (
    id_ocorrencia INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NULL,
    id_categoria INT NOT NULL,
    titulo VARCHAR(100) NOT NULL,
    descricao TEXT NOT NULL,
    prioridade VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Aberta',
    data_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    prazo DATE NULL,
    data_resolucao DATETIME NULL,
    observacao_ia TEXT,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria)
);

CREATE TABLE localizacoes (
    id_localizacao INT AUTO_INCREMENT PRIMARY KEY,
    id_ocorrencia INT NOT NULL,
    endereco VARCHAR(255) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    FOREIGN KEY (id_ocorrencia) REFERENCES ocorrencias(id_ocorrencia) ON DELETE CASCADE
);

CREATE TABLE historico_ocorrencias (
    id_historico INT AUTO_INCREMENT PRIMARY KEY,
    id_ocorrencia INT NOT NULL,
    id_usuario INT NOT NULL,
    status_anterior VARCHAR(30),
    novo_status VARCHAR(30) NOT NULL,
    observacao TEXT,
    data_alteracao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_ocorrencia) REFERENCES ocorrencias(id_ocorrencia) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

CREATE TABLE atendimentos (
    id_atendimento INT AUTO_INCREMENT PRIMARY KEY,
    id_ocorrencia INT NOT NULL,
    id_equipe INT NOT NULL,
    data_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_fim DATETIME NULL,
    observacao TEXT,
    FOREIGN KEY (id_ocorrencia) REFERENCES ocorrencias(id_ocorrencia) ON DELETE CASCADE,
    FOREIGN KEY (id_equipe) REFERENCES equipes(id_equipe)
);

CREATE TABLE notificacoes (
    id_notificacao INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_ocorrencia INT NOT NULL,
    mensagem TEXT NOT NULL,
    lida TINYINT(1) DEFAULT 0,
    data_notificacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_ocorrencia) REFERENCES ocorrencias(id_ocorrencia) ON DELETE CASCADE
);

CREATE TABLE anexos (
    id_anexo INT AUTO_INCREMENT PRIMARY KEY,
    id_ocorrencia INT NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    caminho_arquivo VARCHAR(500) NOT NULL,
    data_upload DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_ocorrencia) REFERENCES ocorrencias(id_ocorrencia) ON DELETE CASCADE
);

USE projeto_integrador;
 
CREATE TABLE IF NOT EXISTS mensagens_chat (
    id_mensagem INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    canal VARCHAR(40) NOT NULL DEFAULT 'geral',
    mensagem TEXT NOT NULL,
    data_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE,
    INDEX idx_chat_canal_data (canal, data_envio)
);

CREATE TABLE notas (
    id_nota INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    conteudo TEXT NOT NULL,
    tipo VARCHAR(30) NOT NULL DEFAULT 'Manual',
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE);
    
    CREATE TABLE IF NOT EXISTS os_etapas (
  id_etapa INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_ocorrencia INT NOT NULL,
  codigo VARCHAR(40) NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  concluida TINYINT(1) NOT NULL DEFAULT 0,
  id_responsavel INT NULL,
  data_conclusao DATETIME NULL,
  UNIQUE KEY uq_os_etapa (id_ocorrencia, codigo),
  KEY idx_os_etapas_ocorrencia (id_ocorrencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS os_eventos (
  id_evento INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_ocorrencia INT NOT NULL,
  id_usuario INT NOT NULL,
  tipo VARCHAR(60) NOT NULL,
  descricao TEXT NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_os_eventos_ocorrencia (id_ocorrencia, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS os_relatorios (
  id_relatorio INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_ocorrencia INT NOT NULL,
  atividades TEXT NOT NULL,
  materiais TEXT NOT NULL,
  observacoes TEXT NULL,
  id_autor INT NOT NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_os_relatorio_ocorrencia (id_ocorrencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS os_orcamentos (
  id_orcamento INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_ocorrencia INT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  observacoes TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pendente',
  id_autor INT NOT NULL,
  id_aprovador INT NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_os_orcamento_ocorrencia (id_ocorrencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS os_conclusoes (
  id_conclusao INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_ocorrencia INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Solicitada',
  id_solicitante INT NOT NULL,
  id_administrador INT NULL,
  observacao TEXT NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_os_conclusao_ocorrencia (id_ocorrencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A tabela os_anexos já existe no seu banco, mas a versão anterior
-- pode não ter todos os campos usados pelo server.js.
CREATE TABLE IF NOT EXISTS os_anexos (
  id_anexo INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_ocorrencia INT NOT NULL,
  id_usuario INT NULL,
  nome_original VARCHAR(255) NULL,
  nome_arquivo VARCHAR(255) NULL,
  tipo_mime VARCHAR(120) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_os_anexos_ocorrencia (id_ocorrencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Acrescenta apenas colunas ausentes em os_anexos, sem apagar registros.
DELIMITER $$
DROP PROCEDURE IF EXISTS nexbuild_completar_os_anexos$$
CREATE PROCEDURE nexbuild_completar_os_anexos()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='os_anexos' AND COLUMN_NAME='id_usuario') THEN
    ALTER TABLE os_anexos ADD COLUMN id_usuario INT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='os_anexos' AND COLUMN_NAME='nome_original') THEN
    ALTER TABLE os_anexos ADD COLUMN nome_original VARCHAR(255) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='os_anexos' AND COLUMN_NAME='tipo_mime') THEN
    ALTER TABLE os_anexos ADD COLUMN tipo_mime VARCHAR(120) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='os_anexos' AND COLUMN_NAME='criado_em') THEN
    ALTER TABLE os_anexos ADD COLUMN criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END$$
DELIMITER ;
CALL nexbuild_completar_os_anexos();
DROP PROCEDURE nexbuild_completar_os_anexos;

SHOW TABLES LIKE 'os_%';
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    

INSERT INTO usuarios
(nome, email, senha, cargo, setor, perfil, status)
VALUES
('João Silva', 'joao@email.com', '123456', 'Funcionário', 'Atendimento', 'Usuário', 'Ativo'),
('Adm', 'adm@admin.com', 'adm123', 'Administrador', 'Administração', 'Administrador', 'Ativo'),
('Carlos Oliveira', 'carlos@email.com', '123456', 'Funcionário', 'Atendimento', 'Usuário', 'Ativo'),
('Ana Santos', 'ana@email.com', '123456', 'Funcionário', 'Atendimento', 'Usuário', 'Ativo');

INSERT INTO categorias (nome, descricao) VALUES
('Pavimentação', 'Problemas relacionados a ruas, estradas e calçadas'),
('Iluminação', 'Problemas relacionados à iluminação pública'),
('Saneamento', 'Problemas relacionados à água e esgoto'),
('Estrutura', 'Problemas em pontes, viadutos e estruturas'),
('Construção', 'Problemas relacionados a obras e construções'),
('Segurança', 'Situações que apresentam risco para a população');

INSERT INTO equipes (nome, especialidade) VALUES
('Equipe de Pavimentação', 'Obras viárias'),
('Equipe Elétrica', 'Iluminação pública'),
('Equipe Hidráulica', 'Saneamento'),
('Equipe de Estruturas', 'Pontes e estruturas'),
('Equipe de Construção', 'Construção civil');

INSERT INTO ocorrencias
(id_usuario, id_categoria, titulo, descricao, prioridade, status, observacao_ia) VALUES
(1, 1, 'Buraco na pista', 'Grande buraco localizado próximo a uma escola.', 'Alta', 'Aberta',
'A IA identificou uma situação de risco para veículos e pedestres devido à localização.'),
(2, 2, 'Poste sem iluminação', 'Poste localizado na rua principal está sem iluminação.', 'Média', 'Em análise',
'A ocorrência apresenta impacto na segurança e visibilidade da região.'),
(3, 3, 'Vazamento de água', 'Há um vazamento de água próximo a uma residência.', 'Alta', 'Aberta',
'A IA classificou como prioridade alta devido ao desperdício de água e possível dano à infraestrutura.'),
(4, 4, 'Esgoto', 'Há um vazamento de esgoto próximo a um hospital.', 'Alta', 'Aberta',
'A IA classificou como prioridade alta devido a possível dano à infraestrutura.');

 
INSERT INTO localizacoes
(id_ocorrencia, endereco, bairro, cidade, latitude, longitude) VALUES
(1, 'Rua João Silva, 150', 'Centro', 'Criciúma', -28.6775, -49.3697),
(2, 'Rua das Flores, 300', 'Santa Bárbara', 'Criciúma', -28.6785, -49.3650),
(3, 'Avenida Principal, 500', 'Próspera', 'Criciúma', -28.6720, -49.3500),
(4, 'Rua Raposo Távares, 235', 'Santa Catarina', 'Criciúma', -28.7420, -49.3400);

INSERT INTO historico_ocorrencias
(id_ocorrencia, id_usuario, status_anterior, novo_status, observacao) VALUES
(1, 1, NULL, 'Aberta', 'Ocorrência registrada pelo funcionário.'),
(2, 3, NULL, 'Aberta', 'Ocorrência registrada pelo funcionário.'),
(2, 2, 'Aberta', 'Em análise', 'Administrador iniciou a análise da ocorrência.'),
(3, 4, NULL, 'Aberta', 'Ocorrência registrada pelo funcionário.');
INSERT INTO atendimentos
(id_ocorrencia, id_equipe, observacao) VALUES
(1, 1, 'Equipe de pavimentação será responsável pela avaliação do problema.'),
(2, 2, 'Equipe elétrica deverá verificar o poste.'),
(3, 3, 'Equipe hidráulica deverá verificar o vazamento.');
INSERT INTO notificacoes
(id_usuario, id_ocorrencia, mensagem) VALUES
(2, 1, 'Nova ocorrência de alta prioridade registrada.'),
(2, 2, 'A ocorrência de iluminação está aguardando análise.'),
(2, 3, 'Nova ocorrência de alta prioridade registrada.');
INSERT INTO anexos
(id_ocorrencia, nome_arquivo, caminho_arquivo) VALUES
(1, 'buraco.jpg', '/uploads/buraco.jpg'),
(2, 'poste.jpg', '/uploads/poste.jpg'),
(3, 'vazamento.jpg', '/uploads/vazamento.jpg');

CREATE TABLE IF NOT EXISTS atribuicoes_ocorrencias (
  id_atribuicao INT AUTO_INCREMENT PRIMARY KEY,
  id_ocorrencia INT NOT NULL,
  id_funcionario INT NOT NULL,
  id_administrador INT NOT NULL,
  data_atribuicao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_encerramento DATETIME NULL,
  CONSTRAINT fk_atr_ocorrencia FOREIGN KEY (id_ocorrencia)
    REFERENCES ocorrencias(id_ocorrencia) ON DELETE CASCADE,
  CONSTRAINT fk_atr_funcionario FOREIGN KEY (id_funcionario)
    REFERENCES usuarios(id_usuario),
  CONSTRAINT fk_atr_administrador FOREIGN KEY (id_administrador)
    REFERENCES usuarios(id_usuario),
  INDEX idx_atr_funcionario_ativa (id_funcionario, data_encerramento),
  INDEX idx_atr_ocorrencia_ativa (id_ocorrencia, data_encerramento)
);
 
 SHOW TABLES LIKE 'atribuicoes_ocorrencias';


-- Atualiza SOMENTE as contas ficticias deste script, caso ja tenham sido criadas.
UPDATE usuarios SET senha = '$2y$10$fUG28qLiRHY/PwrJFuct9e8gvot3OlTL8OheaXSpGZzNUN7vcvI1C' WHERE email = 'admin.nexbuild@example.com';
UPDATE usuarios SET senha = '$2y$10$D1klSj5Q0eTbhvoeB7xn0.wcXjnf7FaTswxNAQaUsezyK3FTaspvC' WHERE email IN (
  'mariana.nexbuild@example.com',
  'pedro.nexbuild@example.com',
  'camila.nexbuild@example.com'
);

-- Atribui ocorrencias de exemplo somente se elas existirem e ainda
-- nao tiverem qualquer atribuicao ativa. Nunca usa id_usuario como responsavel.
INSERT INTO atribuicoes_ocorrencias (id_ocorrencia, id_funcionario, id_administrador)
SELECT o.id_ocorrencia, f.id_usuario, a.id_usuario
FROM ocorrencias o
JOIN usuarios f ON f.email = 'mariana.nexbuild@example.com'
JOIN usuarios a ON a.email = 'admin.nexbuild@example.com'
WHERE o.titulo = 'Buraco na pista'
  AND NOT EXISTS (
    SELECT 1 FROM atribuicoes_ocorrencias x
    WHERE x.id_ocorrencia = o.id_ocorrencia AND x.data_encerramento IS NULL
  );

INSERT INTO atribuicoes_ocorrencias (id_ocorrencia, id_funcionario, id_administrador)
SELECT o.id_ocorrencia, f.id_usuario, a.id_usuario
FROM ocorrencias o
JOIN usuarios f ON f.email = 'pedro.nexbuild@example.com'
JOIN usuarios a ON a.email = 'admin.nexbuild@example.com'
WHERE o.titulo = 'Poste sem iluminação'
  AND NOT EXISTS (
    SELECT 1 FROM atribuicoes_ocorrencias x
    WHERE x.id_ocorrencia = o.id_ocorrencia AND x.data_encerramento IS NULL
  );

INSERT INTO atribuicoes_ocorrencias (id_ocorrencia, id_funcionario, id_administrador)
SELECT o.id_ocorrencia, f.id_usuario, a.id_usuario
FROM ocorrencias o
JOIN usuarios f ON f.email = 'camila.nexbuild@example.com'
JOIN usuarios a ON a.email = 'admin.nexbuild@example.com'
WHERE o.titulo = 'Vazamento de água'
  AND NOT EXISTS (
    SELECT 1 FROM atribuicoes_ocorrencias x
    WHERE x.id_ocorrencia = o.id_ocorrencia AND x.data_encerramento IS NULL
  );

-- Conferencia
SELECT id_usuario, nome, email, cargo, perfil, status
FROM usuarios WHERE email LIKE '%.nexbuild@example.com';

SELECT o.id_ocorrencia, o.titulo, f.nome AS funcionario, a.nome AS atribuido_por
FROM atribuicoes_ocorrencias x
JOIN ocorrencias o ON o.id_ocorrencia = x.id_ocorrencia
JOIN usuarios f ON f.id_usuario = x.id_funcionario
JOIN usuarios a ON a.id_usuario = x.id_administrador
WHERE x.data_encerramento IS NULL
  AND a.email = 'admin.nexbuild@example.com';

  SELECT
    o.id_ocorrencia,
    o.titulo,
    l.endereco,
    l.bairro,
    l.cidade,
    l.latitude,
    l.longitude
FROM ocorrencias o
LEFT JOIN localizacoes l
    ON o.id_ocorrencia = l.id_ocorrencia
WHERE l.latitude IS NULL
   OR l.longitude IS NULL;

USE projeto_integrador;

SELECT
    o.id_ocorrencia,
    o.titulo,
    o.prioridade,
    l.endereco,
    l.bairro,
    l.cidade,
    l.latitude,
    l.longitude
FROM ocorrencias o
LEFT JOIN localizacoes l
    ON o.id_ocorrencia = l.id_ocorrencia
WHERE o.id_ocorrencia IN (5, 6);


SELECT
    id_ocorrencia,
    titulo,
    observacao_ia
FROM ocorrencias
WHERE id_ocorrencia = 12;

ALTER TABLE ocorrencias
ADD COLUMN status_ia ENUM(
  'pendente',
  'processando',
  'concluida',
  'erro'
) NOT NULL DEFAULT 'pendente';

UPDATE ocorrencias
SET status_ia = CASE
  WHEN observacao_ia IS NOT NULL
       AND TRIM(observacao_ia) <> ''
    THEN 'concluida'
  ELSE 'pendente'
END;



USE projeto_integrador;
-- Execute uma vez, após fazer backup do banco.
ALTER TABLE usuarios ADD COLUMN id_equipe INT NULL;
ALTER TABLE usuarios ADD CONSTRAINT fk_usuario_equipe FOREIGN KEY (id_equipe) REFERENCES equipes(id_equipe) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS atribuicoes_equipes (
 id_atribuicao INT AUTO_INCREMENT PRIMARY KEY,
 id_ocorrencia INT NOT NULL,
 id_equipe INT NOT NULL,
 id_administrador INT NOT NULL,
 data_atribuicao DATETIME DEFAULT CURRENT_TIMESTAMP,
 data_encerramento DATETIME NULL,
 FOREIGN KEY (id_ocorrencia) REFERENCES ocorrencias(id_ocorrencia) ON DELETE CASCADE,
 FOREIGN KEY (id_equipe) REFERENCES equipes(id_equipe),
 FOREIGN KEY (id_administrador) REFERENCES usuarios(id_usuario),
 INDEX idx_equipe_ativa (id_equipe,data_encerramento),
 INDEX idx_ocorrencia_ativa (id_ocorrencia,data_encerramento)
);
SHOW COLUMNS FROM usuarios LIKE 'id_equipe';


ALTER TABLE usuarios
ADD COLUMN id_equipe INT NULL;


SELECT id_usuario, nome, cargo, perfil, tipo_usuario, status
FROM usuarios
WHERE id_usuario = 2;


UPDATE usuarios
SET
    perfil = CASE
        WHEN cargo = 'Administrador' THEN 'Administrador'
        ELSE 'Usuário'
    END,
    tipo_usuario = CASE
        WHEN cargo = 'Administrador' THEN 'Administrador'
        WHEN cargo IN ('Funcionário', 'Funcionario') THEN 'Funcionário'
        ELSE 'Cidadão'
    END
WHERE id_usuario > 0;


SELECT DISTINCT cargo, perfil, tipo_usuario
FROM usuarios;

-- Verificar as equipes cadastradas
SELECT id_equipe, nome, especialidade
FROM equipes
ORDER BY nome, id_equipe;

-- Verificar os funcionários e suas equipes
SELECT
    id_usuario,
    nome,
    cargo,
    tipo_usuario,
    status,
    id_equipe
FROM usuarios
ORDER BY id_usuario;


SELECT id_equipe, nome, especialidade
FROM equipes
ORDER BY id_equipe;
 
 
 SELECT DATABASE();

SHOW COLUMNS FROM ocorrencias LIKE 'prazo';

ALTER TABLE ocorrencias
ADD COLUMN prazo DATE NULL;

SHOW COLUMNS FROM ocorrencias LIKE 'prazo';


SELECT id_ocorrencia, titulo, status, data_registro
FROM ocorrencias
ORDER BY id_ocorrencia;


SELECT id_ocorrencia, titulo, status, data_registro
FROM ocorrencias
ORDER BY data_registro ASC, id_ocorrencia ASC
LIMIT 3;


SELECT COUNT(*) AS total_para_excluir
FROM ocorrencias
WHERE id_ocorrencia NOT IN (
    SELECT id_ocorrencia
    FROM (
        SELECT id_ocorrencia
        FROM ocorrencias
        ORDER BY data_registro ASC, id_ocorrencia ASC
        LIMIT 3
    ) AS antigas
);

SELECT
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME = 'ocorrencias';