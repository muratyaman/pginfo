-- Database: demo

-- DROP DATABASE IF EXISTS demo;

CREATE DATABASE demo
    WITH 
    OWNER = murat
    ENCODING = 'UTF8'
    LC_COLLATE = 'C'
    LC_CTYPE = 'C'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;



-- Table: public.options

-- DROP TABLE IF EXISTS public.options;

CREATE TABLE IF NOT EXISTS public.options
(
    bool boolean NOT NULL,
    "bigint" bigint NOT NULL,
    bigserial bigint NOT NULL DEFAULT nextval('options_bigserial_seq'::regclass),
    double double precision NOT NULL,
    "integer" integer NOT NULL,
    money money NOT NULL,
    "numeric" numeric NOT NULL,
    "real" real NOT NULL,
    serial integer NOT NULL DEFAULT nextval('options_serial_seq'::regclass),
    "smallint" smallint NOT NULL,
    smallserial smallint NOT NULL DEFAULT nextval('options_smallserial_seq'::regclass),
    char10 character(10) COLLATE pg_catalog."default" NOT NULL DEFAULT 'def10'::bpchar,
    varchar20 character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'def20'::character varying,
    text text COLLATE pg_catalog."default" NOT NULL,
    "bit" bit(1) NOT NULL,
    varbit4 bit varying(4) NOT NULL,
    bytea bytea NOT NULL,
    date date NOT NULL DEFAULT now(),
    "interval" interval NOT NULL,
    timetz time with time zone NOT NULL,
    "time" time without time zone NOT NULL,
    timestamptz timestamp with time zone NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    tsquery tsquery NOT NULL,
    tsvector tsvector NOT NULL,
    cidr cidr NOT NULL,
    inet inet NOT NULL,
    macaddr macaddr NOT NULL,
    macaddr8 macaddr8 NOT NULL,
    box box NOT NULL,
    circle circle NOT NULL,
    line line NOT NULL,
    lseg lseg NOT NULL,
    path path NOT NULL,
    point point NOT NULL,
    polygon polygon NOT NULL,
    json json NOT NULL,
    jsonb jsonb NOT NULL,
    txidsnapshot txid_snapshot NOT NULL,
    uuid uuid NOT NULL,
    xml xml NOT NULL,
    varchar_arr_dim1 character varying[] COLLATE pg_catalog."default" NOT NULL,
    int_arr_dim2 integer[] NOT NULL,
    CONSTRAINT options_pkey PRIMARY KEY (uuid),
    CONSTRAINT unique_options_uuid UNIQUE (uuid)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.options
    OWNER to murat;
