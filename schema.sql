CREATE TABLE IF NOT EXISTS players (
 id TEXT PRIMARY KEY,
 username TEXT NOT NULL DEFAULT '',
 first_name TEXT NOT NULL DEFAULT '',
 last_name TEXT NOT NULL DEFAULT '',
 balance INTEGER NOT NULL DEFAULT 100 CHECK(balance >= 0),
 xp INTEGER NOT NULL DEFAULT 0 CHECK(xp >= 0),
 level INTEGER NOT NULL DEFAULT 0 CHECK(level >= 0),
 blocked INTEGER NOT NULL DEFAULT 0,
 last_seen INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS players_last_seen ON players(last_seen);
CREATE TABLE IF NOT EXISTS professions (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 pay INTEGER NOT NULL DEFAULT 0,
 level INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO professions(id,name,pay,level) VALUES
 ('loader','Грузчик',100,0),
 ('hairdresser','Парикмахер',250,10),
 ('businessman','Бизнесмен',500,25);