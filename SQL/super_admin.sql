create table if not exists app_super_admin (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  full_name     text,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- mientras pruebas, quita RLS en esta tabla para evitar bloqueos
alter table app_super_admin disable row level security;

-- usuario de prueba con clave: Admin123!
insert into app_super_admin (email, full_name, password_hash)
values (
  'superadmin@accrom.test',
  'Super Admin',
  '$2b$10$P7Ob5fdsfZkcbNqU4DM4hemjfFA0Qhr3sfXvN0LwEZN9w1lB9IAU6'
)
on conflict (email) do update
set full_name = excluded.full_name,
    password_hash = excluded.password_hash;


    select * from app_super_admin

update app_super_admin
set password_hash = '$2b$10$P7Ob5fdsfZkcbNqU4DM4hemjfFA0Qhr3sfXvN0LwEZN9w1lB9IAU6' -- Admin123!
where lower(email) = lower('superadmin@accrom.test');


