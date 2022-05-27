CREATE TYPE roluri AS ENUM('admin', 'moderator', 'comun');


CREATE TABLE IF NOT EXISTS utilizatori (
   id serial PRIMARY KEY,
   username VARCHAR(50) UNIQUE NOT NULL,
   nume VARCHAR(100) NOT NULL,
   prenume VARCHAR(100) NOT NULL,
   parola VARCHAR(100) NOT NULL,
   rol roluri NOT NULL DEFAULT 'comun',
   email VARCHAR(100) NOT NULL,
   culoare_chat VARCHAR(50) NOT NULL,
   data_adaugare TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS public.prods
(
    id_prods integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    nume character varying COLLATE pg_catalog."default" NOT NULL,
    greutate integer NOT NULL,
    calorii integer,
    pret double NOT NULL,
    CONSTRAINT prods_pkey PRIMARY KEY (id_prods)
)

CREATE USER nume_utilizator WITH ENCRYPTED PASSWORD 'parola';
GRANT ALL PRIVILEGES ON DATABASE nume_baza_date TO nume_utilizator ;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nume_utilizator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nume_utilizator;
