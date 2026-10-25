// [SRP] datos iniciales aislados — crea un admin por defecto (idempotente).
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@portfolio.dev';
  const passwordHash = await argon2.hash('admin12345');
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: 'Admin', email, passwordHash, role: Role.admin },
  });
  console.log(`Seeded admin: ${email} / admin12345`);

  // Proyectos de ejemplo (idempotente por slug).
  const projects = [
    {
      title: 'Web App con Vue & Supabase',
      slug: 'web-app-con-vue-supabase',
      description: 'Aplicación de notas colaborativas en tiempo real.',
      link: 'https://github.com/tu_usuario/vue-notes-app',
      techs: ['Vue', 'Supabase', 'TailwindCSS'],
      featured: true,
    },
    {
      title: 'API con Node y Mongo',
      slug: 'api-con-node-y-mongo',
      description: 'API REST para tareas, usuarios y autenticación.',
      link: 'https://github.com/tu_usuario/task-api',
      techs: ['Node.js', 'Express', 'MongoDB'],
      featured: false,
    },
  ];
  for (const p of projects) {
    await prisma.project.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }
  console.log(`Seeded ${projects.length} projects`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
